from __future__ import annotations
import hashlib
import logging
import re
from datetime import datetime
import requests
from bs4 import BeautifulSoup
from scripts.shared.source import SourceBase, RawCandidate, ExtractedEvent, main_for
from scripts.shared.extraction import extract_events
from scripts.shared.supabase import get_supabase_client

log = logging.getLogger(__name__)

DOC_URL = "https://docs.google.com/document/d/e/2PACX-1vQH4TZ_gxv1qw9Gy-eYuSY4brkLSYcWnG_81nR2ZsQXf1Y2LjqMLzyosyDvPQdJ-Xk4mfkp7a9ehfzq/pub"
USER_AGENT = "Mozilla/5.0 (dc-events-digest)"

NEWSLETTER_INSTRUCTION = (
    "This is a daily newsletter — focus on the events section. "
    "Skip news commentary and political opinion."
)


def _readable_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "header", "footer", "aside"]):
        tag.decompose()
    return soup.get_text(" ", strip=True)


def _doc_publication_date(html: str) -> str:
    """Best-effort: scan for an ISO-ish date near the top of the document."""
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(" ", strip=True)[:1000]
    m = re.search(r"\b(20\d{2})-(\d{2})-(\d{2})\b", text)
    if m:
        return m.group(0)
    return datetime.utcnow().date().isoformat()


def _hash_external_id(doc_date: str, title: str, start_at: str) -> str:
    return hashlib.sha1(f"{doc_date}|{title}|{start_at}".encode()).hexdigest()[:16]


def _last_cursor() -> str | None:
    sb = get_supabase_client()
    rows = sb.table("ingestion_state").select("last_cursor").eq("source", "730dc").execute().data
    return rows[0]["last_cursor"] if rows else None


def _save_cursor(value: str) -> None:
    sb = get_supabase_client()
    sb.table("ingestion_state").upsert({
        "source": "730dc", "last_cursor": value, "last_status": "ok", "last_run_at": "now()"
    }).execute()


class DC730Source(SourceBase):
    source_key = "730dc"
    schedule = "0 7 * * *"

    def fetch(self) -> list[RawCandidate]:
        resp = requests.get(DOC_URL, headers={"User-Agent": USER_AGENT}, timeout=20)
        resp.raise_for_status()
        doc_date = _doc_publication_date(resp.text)
        cursor = _last_cursor()
        if cursor == doc_date:
            log.info("730dc: cursor matches doc date %s — nothing new", doc_date)
            return []
        _save_cursor(doc_date)
        return [{"doc_publication_date": doc_date, "html": resp.text}]

    def extract(self, raw: RawCandidate) -> list[ExtractedEvent]:
        text = _readable_text(raw["html"])
        events = extract_events(
            article_text=text,
            source_url=DOC_URL,
            extra_instructions=NEWSLETTER_INSTRUCTION,
        )
        out: list[ExtractedEvent] = []
        for ev in events:
            eid = _hash_external_id(raw["doc_publication_date"], ev["title"], ev["start_at"])
            payload = {**ev, "url": DOC_URL}
            out.append({"external_id": eid, "payload": payload})
        return out


if __name__ == "__main__":
    main_for(DC730Source)
