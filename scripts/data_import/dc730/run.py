from __future__ import annotations
import hashlib
import logging
from datetime import datetime, timezone
import pytz
import requests
from bs4 import BeautifulSoup
from scripts.shared.source import SourceBase, RawCandidate, ExtractedEvent, main_for
from scripts.shared.extraction import extract_events
from scripts.shared.supabase import get_supabase_client

log = logging.getLogger(__name__)

DOC_URL = "https://docs.google.com/document/d/e/2PACX-1vQH4TZ_gxv1qw9Gy-eYuSY4brkLSYcWnG_81nR2ZsQXf1Y2LjqMLzyosyDvPQdJ-Xk4mfkp7a9ehfzq/pub"
USER_AGENT = "Mozilla/5.0 (dc-events-digest)"
ET = pytz.timezone("America/New_York")

# The published doc is 730DC's "Weekly Scheduler": one day-by-day section per
# day of the current week (headings like "Wednesday September 23", no year),
# followed by an "on sale now" list and a long-tail list of future dates
# written as M/D. The doc is re-published in place, so there is no stable
# publication date to key on — we key the cursor on the content instead.
NEWSLETTER_INSTRUCTION_TEMPLATE = (
    "This is 730DC's weekly event scheduler, fetched on {fetched_on} (Eastern Time). "
    "Day headings such as 'Wednesday, September 23' have no year: resolve them to the "
    "occurrence of that date nearest to {fetched_on}. Dates written as M/D (for example "
    "'10/8') or M/D-D are the next upcoming occurrence of that date. Each bullet under a "
    "day heading is one event; the parenthesised time such as '( 7pm )' is its start time. "
    "The comma-separated 'Also ||' list holds additional events on that same day with no "
    "time given: include them with the day's date, is_all_day true, and no end time. "
    "Skip news commentary, subscription blurbs, and calls for submissions."
)


def _today_et() -> str:
    return datetime.now(ET).date().isoformat()


def _readable_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "header", "footer", "aside"]):
        tag.decompose()
    return soup.get_text(" ", strip=True)


def _content_fingerprint(text: str) -> str:
    """Stable hash of the doc's readable text; changes only when the doc changes."""
    return hashlib.sha1(text.encode()).hexdigest()[:16]


def _hash_external_id(title: str, start_at: str) -> str:
    # Keyed on the event itself (not the fetch date) so re-fetching an unchanged
    # or lightly edited doc updates the same rows instead of creating new ones.
    return hashlib.sha1(f"{title}|{start_at}".encode()).hexdigest()[:16]


def _last_cursor() -> str | None:
    sb = get_supabase_client()
    rows = sb.table("ingestion_state").select("last_cursor").eq("source", "730dc").execute().data
    return rows[0]["last_cursor"] if rows else None


def _save_cursor(value: str) -> None:
    sb = get_supabase_client()
    sb.table("ingestion_state").upsert({
        "source": "730dc",
        "last_cursor": value,
        "last_status": "ok",
        "last_run_at": datetime.now(timezone.utc).isoformat(),
    }).execute()


class DC730Source(SourceBase):
    source_key = "730dc"
    schedule = "0 7 * * *"

    def __init__(self) -> None:
        self._pending_cursor: str | None = None

    def fetch(self) -> list[RawCandidate]:
        resp = requests.get(DOC_URL, headers={"User-Agent": USER_AGENT}, timeout=20)
        resp.raise_for_status()
        text = _readable_text(resp.text)
        fingerprint = _content_fingerprint(text)
        cursor = _last_cursor()
        if cursor == fingerprint:
            log.info("730dc: doc unchanged since last run (cursor %s) — nothing new", fingerprint)
            return []
        # Only advance the cursor once the run has actually staged the events
        # (see on_success); saving it here would skip the doc forever if
        # extraction failed part-way, and would write during --dry-run.
        self._pending_cursor = fingerprint
        return [{"fetched_on": _today_et(), "text": text}]

    def extract(self, raw: RawCandidate) -> list[ExtractedEvent]:
        text = raw["text"] if "text" in raw else _readable_text(raw["html"])
        fetched_on = raw.get("fetched_on") or _today_et()
        events = extract_events(
            article_text=text,
            source_url=DOC_URL,
            extra_instructions=NEWSLETTER_INSTRUCTION_TEMPLATE.format(fetched_on=fetched_on),
        )
        out: list[ExtractedEvent] = []
        for ev in events:
            eid = _hash_external_id(ev["title"], ev["start_at"])
            payload = {**ev, "url": DOC_URL}
            out.append({"external_id": eid, "payload": payload})
        return out

    def on_success(self) -> None:
        if self._pending_cursor:
            _save_cursor(self._pending_cursor)
            self._pending_cursor = None


if __name__ == "__main__":
    main_for(DC730Source)
