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

                payload = {
                    "title": title,
                    "start_at": start_iso,
                    "type": _classify_type(li_text),
                    "venue_name": venue_name,
                    "url": url,
                    "tags": _classify_tags(li_text),
                }
                external_id = hashlib.sha1(f"{url}|{start_iso}".encode()).hexdigest()[:16]
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
