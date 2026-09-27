from __future__ import annotations
import calendar
import hashlib
import logging
from datetime import datetime, timezone
import feedparser
import requests
from dateutil import parser as dparser
from bs4 import BeautifulSoup
from scripts.shared.source import SourceBase, RawCandidate, ExtractedEvent, main_for
from scripts.shared.extraction import extract_events
from scripts.shared.supabase import get_supabase_client

log = logging.getLogger(__name__)

FEED_URL = "https://washingtonian.com/sections/things-to-do/feed/"
USER_AGENT = "Mozilla/5.0 (dc-events-digest)"


def _readable_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "header", "footer", "aside"]):
        tag.decompose()
    return soup.get_text(" ", strip=True)


def _hash_external_id(url: str, title: str, start_at: str) -> str:
    return hashlib.sha1(f"{url}|{title}|{start_at}".encode()).hexdigest()[:16]


def _last_cursor() -> str | None:
    sb = get_supabase_client()
    rows = sb.table("ingestion_state").select("last_cursor").eq("source", "washingtonian").execute().data
    return rows[0]["last_cursor"] if rows else None


def _save_cursor(value: str) -> None:
    sb = get_supabase_client()
    sb.table("ingestion_state").upsert({
        "source": "washingtonian",
        "last_cursor": value,
        "last_status": "ok",
        "last_run_at": datetime.now(timezone.utc).isoformat(),
    }).execute()


def _entry_published(entry) -> datetime | None:
    """Entry publish time as an aware UTC datetime (feedparser's parsed tuple, else the raw string)."""
    parsed = entry.get("published_parsed") or entry.get("updated_parsed")
    if parsed:
        return datetime.fromtimestamp(calendar.timegm(parsed), tz=timezone.utc)
    raw = entry.get("published") or entry.get("updated")
    return _parse_cursor(raw)


def _parse_cursor(value: str | None) -> datetime | None:
    """Cursor values are ISO 8601 now, but older rows hold the feed's RFC 822 string."""
    if not value:
        return None
    try:
        dt = dparser.parse(value)
    except (ValueError, OverflowError):
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


class WashingtonianSource(SourceBase):
    source_key = "washingtonian"
    schedule = "30 6 * * *"

    def __init__(self) -> None:
        self._pending_cursor: datetime | None = None

    def fetch(self) -> list[RawCandidate]:
        feed = feedparser.parse(FEED_URL)
        cursor = _parse_cursor(_last_cursor())
        out: list[RawCandidate] = []
        latest_seen = cursor
        for entry in feed.entries:
            published = _entry_published(entry)
            # Dates are compared as datetimes: comparing the feed's "Sat, 26 Sep …"
            # strings lexically skipped every article for months.
            if cursor and published and published <= cursor:
                continue
            try:
                resp = requests.get(entry.link, headers={"User-Agent": USER_AGENT}, timeout=20)
                resp.raise_for_status()
            except requests.RequestException as e:
                log.warning("skipping %s: %s", entry.link, e)
                continue
            out.append({"article_url": entry.link, "html": resp.text})
            if published and (not latest_seen or published > latest_seen):
                latest_seen = published
        if latest_seen and latest_seen != cursor:
            self._pending_cursor = latest_seen
        log.info("washingtonian: %d new articles since %s", len(out), cursor.isoformat() if cursor else "start")
        return out

    def on_success(self) -> None:
        if self._pending_cursor:
            _save_cursor(self._pending_cursor.isoformat())
            self._pending_cursor = None

    def extract(self, raw: RawCandidate) -> list[ExtractedEvent]:
        url = raw["article_url"]
        text = _readable_text(raw["html"])
        events = extract_events(article_text=text, source_url=url)
        out: list[ExtractedEvent] = []
        for ev in events:
            eid = _hash_external_id(url, ev["title"], ev["start_at"])
            payload = {**ev, "url": url}
            out.append({"external_id": eid, "payload": payload})
        return out


if __name__ == "__main__":
    main_for(WashingtonianSource)
