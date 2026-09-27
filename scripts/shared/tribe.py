"""Shared base for sites running The Events Calendar (WordPress "tribe") plugin.

The plugin exposes a public REST API at /wp-json/tribe/events/v1/events that
returns structured events (UTC start/end, venue, categories, cost), so these
sources need no LLM extraction. Subclasses set `base_url`, `source_key` and a
`default_type`; `type_keywords` lets a site refine the event type from its
category names and title.
"""
from __future__ import annotations
import html
import logging
import re
from typing import Any
import requests
from .source import SourceBase, RawCandidate, ExtractedEvent
from .taxonomy import filter_tags

log = logging.getLogger(__name__)

USER_AGENT = "Mozilla/5.0 (dc-events-digest)"
PER_PAGE = 50
MAX_PAGES = 10

# Generic keyword → type hints, checked against category names + title (lowercased).
DEFAULT_TYPE_KEYWORDS: dict[str, tuple[str, ...]] = {
    "music":    ("music", "concert", "dj", "jazz", "band", "choir", "tunes"),
    "food":     ("food", "market", "tasting", "dinner", "brunch", "cooking", "wine", "beer", "cocktail"),
    "arts":     ("art", "film", "theater", "theatre", "comedy", "gallery", "exhibit", "dance", "poetry", "book"),
    "outdoors": ("outdoor", "run club", "hike", "garden", "yoga"),
    "civic":    ("civic", "town hall", "council", "election", "advocacy", "hearing"),
}


def _strip_html(s: str | None, limit: int = 1000) -> str | None:
    if not s:
        return None
    text = re.sub(r"<[^>]+>", " ", s)
    text = html.unescape(re.sub(r"\s+", " ", text)).strip()
    return text[:limit] or None


def _utc_iso(value: str | None) -> str | None:
    """'2026-09-27 13:00:00' (tribe utc_* fields) → '2026-09-27T13:00:00+00:00'."""
    if not value:
        return None
    return value.strip().replace(" ", "T") + "+00:00"


def classify_type(text: str, default: str, keywords: dict[str, tuple[str, ...]] | None = None) -> str:
    t = text.lower()
    for type_name, kws in (keywords or DEFAULT_TYPE_KEYWORDS).items():
        if any(k in t for k in kws):
            return type_name
    return default


def cost_tags(cost: str | None) -> list[str]:
    if cost is None:
        return []
    c = cost.strip().lower()
    if c in ("free", "0", "$0", "$0.00") or "free" in c:
        return ["free"]
    if re.search(r"\d", c):
        return ["ticketed"]
    return []


class TribeEventsSource(SourceBase):
    base_url: str = ""
    default_type: str = "community"
    type_keywords: dict[str, tuple[str, ...]] | None = None
    # Category names that every event on the site carries (e.g. the venue's own
    # name) and therefore say nothing about the event type.
    ignore_categories: frozenset[str] = frozenset()
    default_neighborhood: str | None = None
    per_page: int = PER_PAGE
    max_pages: int = MAX_PAGES

    def _events_url(self) -> str:
        return f"{self.base_url.rstrip('/')}/wp-json/tribe/events/v1/events"

    def fetch(self) -> list[RawCandidate]:
        out: list[RawCandidate] = []
        url: str | None = self._events_url()
        params: dict[str, Any] | None = {"per_page": self.per_page, "start_date": "now", "status": "publish"}
        for _ in range(self.max_pages):
            if not url:
                break
            resp = requests.get(url, params=params, headers={"User-Agent": USER_AGENT}, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            out.extend(data.get("events") or [])
            url = data.get("next_rest_url")
            params = None  # next_rest_url already carries the query string
        log.info("%s: fetched %d events from %s", self.source_key, len(out), self.base_url)
        return out

    def extract(self, raw: RawCandidate) -> list[ExtractedEvent]:
        if raw.get("hide_from_listings") or raw.get("status", "publish") != "publish":
            return []
        title = html.unescape(raw.get("title") or "").strip()
        start_at = _utc_iso(raw.get("utc_start_date"))
        if not title or not start_at:
            return []
        end_at = _utc_iso(raw.get("utc_end_date"))
        if end_at == start_at:
            end_at = None
        venue = raw.get("venue") or {}
        if isinstance(venue, list):  # some sites return a list of venues
            venue = venue[0] if venue else {}
        venue_name = html.unescape(venue.get("venue") or "").strip() or None
        addr_parts = [venue.get("address"), venue.get("city"), " ".join(p for p in (venue.get("state"), venue.get("zip")) if p)]
        venue_address = ", ".join(p.strip() for p in addr_parts if p and p.strip()) or None
        categories = [html.unescape(c.get("name", "")) for c in (raw.get("categories") or []) if isinstance(c, dict)]
        type_hints = [c for c in categories if c.lower() not in {x.lower() for x in self.ignore_categories}]
        cost = (raw.get("cost") or "").strip() or None
        payload = {
            "title": title,
            "description": _strip_html(raw.get("excerpt") or raw.get("description")),
            "start_at": start_at,
            "end_at": end_at,
            "is_all_day": bool(raw.get("all_day")),
            "type": classify_type(" ".join(type_hints + [title]), self.default_type, self.type_keywords),
            "venue_name": venue_name,
            "venue_address": venue_address,
            "neighborhood": self.default_neighborhood,
            "url": raw.get("url") or raw.get("website"),
            "cost_text": cost,
            "tags": filter_tags(cost_tags(cost)),
            "source_url": raw.get("url"),
        }
        return [{"external_id": str(raw["id"]), "payload": payload}]
