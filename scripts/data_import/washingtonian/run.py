from __future__ import annotations
import hashlib
import logging
import feedparser
import requests
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
        "last_run_at": "now()",
    }).execute()


class WashingtonianSource(SourceBase):
    source_key = "washingtonian"
    schedule = "30 6 * * *"

    def fetch(self) -> list[RawCandidate]:
        feed = feedparser.parse(FEED_URL)
        cursor = _last_cursor()
        out: list[RawCandidate] = []
        latest_seen = cursor
        for entry in feed.entries:
            published = entry.get("published") or entry.get("updated")
            if cursor and published and published <= cursor:
                continue
            try:
                resp = requests.get(entry.link, headers={"User-Agent": USER_AGENT}, timeout=20)
                resp.raise_for_status()
            except requests.RequestException as e:
                log.warning("skipping %s: %s", entry.link, e)
                continue
            out.append({"article_url": entry.link, "html": resp.text})
            if not latest_seen or (published and published > latest_seen):
                latest_seen = published
        if latest_seen and latest_seen != cursor:
            _save_cursor(latest_seen)
        return out

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
