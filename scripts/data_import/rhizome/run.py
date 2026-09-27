"""Rhizome DC — community arts space in Takoma (Squarespace site).

Squarespace exposes any collection as JSON with `?format=json`; the events
collection returns `upcoming` and `past` lists with millisecond-epoch UTC
start/end dates, the item's tags and an HTML excerpt (which is where Rhizome
writes the price, e.g. "Saturday September 26 * 7pm * $10-15 * TICKETS").
"""
from __future__ import annotations
import logging
import re
from datetime import datetime, timezone
import requests
from scripts.shared.source import SourceBase, RawCandidate, ExtractedEvent, main_for
from scripts.shared.taxonomy import filter_tags
from scripts.shared.tribe import _strip_html, classify_type

log = logging.getLogger(__name__)

SITE = "https://www.rhizomedc.org"
EVENTS_JSON_URL = f"{SITE}/new-events?format=json"
USER_AGENT = "Mozilla/5.0 (dc-events-digest)"
VENUE_NAME = "Rhizome DC"
VENUE_ADDRESS = "6950 Maple St NW, Washington, DC 20012"
NEIGHBORHOOD = "Takoma"

_COST_RE = re.compile(r"\$\s?\d+(?:\.\d{2})?(?:\s?[-–]\s?\$?\d+(?:\.\d{2})?)?", re.I)
_TAG_TYPES = {
    "music": "music", "concert": "music", "sound": "music",
    "visual art": "arts", "film": "arts", "art": "arts", "exhibit": "arts", "poetry": "arts",
    "theater": "arts", "dance": "arts", "workshop": "arts", "reading": "arts",
    "community": "community", "meetup": "community", "food": "food", "garden": "outdoors",
}


def _epoch_ms_to_iso(ms: int | None) -> str | None:
    if not ms:
        return None
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).replace(microsecond=0).isoformat()


def _type_from_tags(tags: list[str], title: str) -> str:
    for tag in tags:
        t = tag.lower().strip()
        for key, type_name in _TAG_TYPES.items():
            if key == t or (len(key) > 3 and key in t):
                return type_name
    return classify_type(title, "community")


def _cost_and_tags(text: str | None) -> tuple[str | None, list[str]]:
    if not text:
        return None, []
    lowered = text.lower()
    m = _COST_RE.search(text)
    if "free" in lowered and not m:
        return "Free", ["free"]
    if m:
        cost = m.group(0).replace(" ", "")
        if "donation" in lowered or "sliding" in lowered or "nofa" in lowered.replace(" ", ""):
            cost += " suggested donation"
        return cost, ["ticketed"]
    if "donation" in lowered:
        return "Donation", ["free"]
    return None, []


class RhizomeSource(SourceBase):
    source_key = "rhizome"
    schedule = "45 7 * * *"

    def fetch(self) -> list[RawCandidate]:
        resp = requests.get(EVENTS_JSON_URL, headers={"User-Agent": USER_AGENT}, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        items = list(data.get("upcoming") or [])
        log.info("rhizome: %d upcoming events", len(items))
        return items

    def extract(self, raw: RawCandidate) -> list[ExtractedEvent]:
        title = (raw.get("title") or "").strip()
        start_at = _epoch_ms_to_iso(raw.get("startDate"))
        if not title or not start_at or not raw.get("id"):
            return []
        end_at = _epoch_ms_to_iso(raw.get("endDate"))
        if end_at == start_at:
            end_at = None
        tags = [t for t in (raw.get("tags") or []) if isinstance(t, str)]
        excerpt = _strip_html(raw.get("excerpt"), limit=1500)
        cost, cost_tag_list = _cost_and_tags(excerpt)
        payload = {
            "title": title,
            "description": excerpt,
            "start_at": start_at,
            "end_at": end_at,
            "is_all_day": False,
            "type": _type_from_tags(tags, title),
            "venue_name": VENUE_NAME,
            "venue_address": VENUE_ADDRESS,
            "neighborhood": NEIGHBORHOOD,
            "url": SITE + raw.get("fullUrl", "") if raw.get("fullUrl", "").startswith("/") else raw.get("fullUrl") or SITE,
            "cost_text": cost,
            "tags": filter_tags(cost_tag_list),
            "source_url": EVENTS_JSON_URL,
        }
        return [{"external_id": str(raw["id"]), "payload": payload}]


if __name__ == "__main__":
    main_for(RhizomeSource)
