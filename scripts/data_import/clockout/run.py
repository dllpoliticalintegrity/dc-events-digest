from __future__ import annotations
import hashlib
import logging
import re
import requests
from datetime import datetime
from bs4 import BeautifulSoup
import pytz

from scripts.shared.source import SourceBase, RawCandidate, ExtractedEvent, main_for
from scripts.shared.dates import parse_et
from scripts.shared.taxonomy import filter_tags

log = logging.getLogger(__name__)

URL = "https://www.clockoutdc.com/events"
USER_AGENT = "Mozilla/5.0 (dc-events-digest)"
ET = pytz.timezone("America/New_York")

# Squarespace event URLs: /events/2026-05-03-cherry-blossom-fest
_EVENT_URL_RE = re.compile(r"/events/(\d{4}-\d{2}-\d{2})-[^/?#]+")

# Heading date like "THURSDAY, 4/30" or "SUNDAY, 5/3"
_HEADING_DATE_RE = re.compile(
    r"(?:MON|TUE|WED|THU|FRI|SAT|SUN)[A-Z]*,?\s+(\d{1,2})/(\d{1,2})",
    re.IGNORECASE,
)

TYPE_KEYWORDS = {
    "music":     ("concert", "show", "gig", "dj", "band", "jazz", "music"),
    "food":      ("market", "tasting", "dinner", "brunch", "pop-up", "food", "restaurant"),
    "arts":      ("gallery", "exhibit", "theater", "comedy", "art", "film", "festival"),
    "outdoors":  ("hike", "park", "outdoor", "garden", "trail"),
    "civic":     ("hearing", "council", "anc", "town hall", "meeting", "vote", "elections", "politics"),
}
TAG_KEYWORDS = {
    "free":       ("free", "no cover", "no charge"),
    "outdoor":    ("outdoor", "outside", "rooftop"),
    "21+":        ("21+", "21 and up", "must be 21"),
    "family":     ("family", "kids", "all ages"),
    "happy-hour": ("happy hour",),
}
_VENUE_RE = re.compile(r"@\s*([^,()\n]+)")
# Trailing "(6-8:30pm, $15)" / "(1pm, free)" / "(9:30-11am, free)" on Clockout titles
_TRAILER_RE = re.compile(r"\s*\(([^()]*)\)\s*$")
_TIME_RE = re.compile(
    r"^(?P<h1>\d{1,2})(?::(?P<m1>\d{2}))?\s*(?P<ap1>am|pm)?\s*(?:[-–]\s*(?P<h2>\d{1,2})(?::(?P<m2>\d{2}))?\s*(?P<ap2>am|pm)?)?$",
    re.I,
)


def _to_24h(h: int, ampm: str | None) -> int:
    ampm = (ampm or "").lower()
    if ampm == "pm" and h < 12:
        return h + 12
    if ampm == "am" and h == 12:
        return 0
    return h


def parse_title_trailer(title: str) -> tuple[str, tuple[int, int] | None, tuple[int, int] | None, str | None]:
    """Split "Film: Seoul (2-4pm, free)" → ("Film: Seoul", (14,0), (16,0), "free").

    Returns (clean_title, start_hm, end_hm, cost_text); start/end are None when
    the trailer has no recognisable time.
    """
    m = _TRAILER_RE.search(title)
    if not m:
        return title.strip(), None, None, None
    parts = [p.strip() for p in m.group(1).split(",")]
    start = end = None
    cost = None
    for part in parts:
        t = _TIME_RE.match(part)
        if t and start is None:
            ap1, ap2 = t.group("ap1"), t.group("ap2")
            ap1 = ap1 or ap2  # "6-8:30pm" → both pm
            start = (_to_24h(int(t.group("h1")), ap1), int(t.group("m1") or 0))
            if t.group("h2"):
                end = (_to_24h(int(t.group("h2")), ap2 or ap1), int(t.group("m2") or 0))
        elif part.startswith("$") or part.lower().startswith("free") or "donation" in part.lower():
            cost = part
    if start is None and cost is None:
        return title.strip(), None, None, None
    return title[: m.start()].strip(), start, end, cost


def _classify_type(text: str) -> str:
    t = text.lower()
    for type_name, kws in TYPE_KEYWORDS.items():
        if any(k in t for k in kws):
            return type_name
    return "community"


def _classify_tags(text: str) -> list[str]:
    t = text.lower()
    found = [tag for tag, kws in TAG_KEYWORDS.items() if any(k in t for k in kws)]
    return filter_tags(found)


def _resolve_date(month: int, day: int, reference_year: int) -> datetime:
    """Return an ET-aware datetime for the given month/day, inferring year."""
    # Try current year first; if that date is in the distant past, try next year
    try:
        dt = ET.localize(datetime(reference_year, month, day, 0, 0, 0))
    except ValueError:
        return None
    # If more than 60 days in the past, assume next year
    now = datetime.now(ET)
    if (dt - now).days < -60:
        try:
            dt = ET.localize(datetime(reference_year + 1, month, day, 0, 0, 0))
        except ValueError:
            return None
    return dt


class ClockoutSource(SourceBase):
    source_key = "clockout"
    schedule = "0 6 * * *"

    def parse_html(self, html: str) -> list[RawCandidate]:
        soup = BeautifulSoup(html, "html.parser")
        seen: set[tuple[str, str]] = set()
        out: list[RawCandidate] = []
        reference_year = datetime.now(ET).year

        # Find all sqs-html-content divs — each one is a date block
        for content_div in soup.find_all("div", class_="sqs-html-content"):
            # Look for a heading that contains a date like "THURSDAY, 4/30"
            h4 = content_div.find("h4")
            if not h4:
                continue
            heading_text = h4.get_text(" ", strip=True)
            m = _HEADING_DATE_RE.search(heading_text)
            if not m:
                continue
            month, day = int(m.group(1)), int(m.group(2))
            block_date = _resolve_date(month, day, reference_year)
            if not block_date:
                continue
            start_iso = block_date.isoformat()

            # Extract events from all <li> elements in this block
            for li in content_div.find_all("li"):
                link = li.find("a", href=True)
                if not link:
                    continue
                href = link.get("href", "").strip()
                if not href or href.startswith("#"):
                    continue
                title = li.get_text(" ", strip=True)
                if not title:
                    title = link.get_text(strip=True)
                if not title:
                    continue

                # Normalize URL
                if href.startswith("//"):
                    url = "https:" + href
                elif href.startswith("/"):
                    url = "https://www.clockoutdc.com" + href
                else:
                    url = href

                # For clockout-native URLs, prefer date from URL slug
                url_match = _EVENT_URL_RE.search(href)
                if url_match:
                    date_from_url = parse_et(url_match.group(1))
                    if date_from_url:
                        start_iso = date_from_url.isoformat()

                dedup_key = (url, start_iso)
                if dedup_key in seen:
                    continue
                seen.add(dedup_key)

                li_text = li.get_text(" ", strip=True)
                venue_match = _VENUE_RE.search(li_text)
                venue_name = venue_match.group(1).strip() if venue_match else None

                clean_title, start_hm, end_hm, cost = parse_title_trailer(title)
                day = datetime.fromisoformat(start_iso).astimezone(ET)
                if start_hm:
                    start_local = ET.localize(datetime(day.year, day.month, day.day, *start_hm))
                    start_iso = start_local.isoformat()
                    end_iso = None
                    if end_hm:
                        end_local = ET.localize(datetime(day.year, day.month, day.day, *end_hm))
                        end_iso = end_local.isoformat() if end_local > start_local else None
                else:
                    end_iso = None

                tags = _classify_tags(li_text)
                if cost and cost.lower().startswith("free") and "free" not in tags:
                    tags = filter_tags(tags + ["free"])

                payload = {
                    "title": clean_title,
                    "start_at": start_iso,
                    "end_at": end_iso,
                    "is_all_day": start_hm is None,
                    "type": _classify_type(li_text),
                    "venue_name": venue_name,
                    "url": url,
                    "cost_text": cost,
                    "tags": tags,
                }
                # Keyed on the URL + calendar day so a time parsed from the title
                # updates the same row instead of creating a second event.
                external_id = hashlib.sha1(f"{url}|{day.date().isoformat()}".encode()).hexdigest()[:16]
                out.append({"external_id": external_id, **payload})

        return out

    def fetch(self) -> list[RawCandidate]:
        resp = requests.get(URL, headers={"User-Agent": USER_AGENT}, timeout=20)
        resp.raise_for_status()
        return self.parse_html(resp.text)

    def extract(self, raw: RawCandidate) -> list[ExtractedEvent]:
        eid = raw.pop("external_id")
        return [{"external_id": eid, "payload": raw}]


if __name__ == "__main__":
    main_for(ClockoutSource)
