"""I.M.P. concert venues: 9:30 Club, The Anthem, Lincoln Theatre, The Atlantis.

Each venue site is a server-rendered WordPress listing. Two themes are in use:
the 9:30 Club theme (`article.event-status-live`) and the newer Anthem /
Lincoln / Atlantis themes (`div.event`, `div.event-list-item`). Cards carry a
date without a year in some themes, so the year is taken from the Ticketmaster
link (…-MM-DD-YYYY/event/…) when present and inferred otherwise.
"""
from __future__ import annotations
import hashlib
import logging
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Callable
import pytz
import requests
from bs4 import BeautifulSoup, Tag
from dateutil import parser as dparser
from scripts.shared.source import SourceBase, RawCandidate, ExtractedEvent, main_for
from scripts.shared.taxonomy import filter_tags
from scripts.shared.tribe import classify_type

log = logging.getLogger(__name__)

USER_AGENT = "Mozilla/5.0 (dc-events-digest)"
ET = pytz.timezone("America/New_York")

_TICKET_DATE_RE = re.compile(r"-(\d{2})-(\d{2})-(\d{4})/")
_TIME_RE = re.compile(r"(\d{1,2}(?::\d{2})?)\s*([ap]\.?m\.?)", re.I)
_TYPE_KEYWORDS = {
    "arts": ("comedy", "comedian", "podcast", "live podcast", "storytelling", "film", "screening", "drag"),
    "community": ("conversation with", "in conversation", "book tour", "lecture", "talk", "trivia"),
}


@dataclass(frozen=True)
class Venue:
    key: str
    name: str
    url: str
    address: str
    neighborhood: str
    card_selector: str
    title_selector: str
    date_selector: str
    ticket_selector: str
    link_selector: str
    time_selector: str | None = None
    card_filter: Callable[[Tag], bool] | None = None


VENUES: list[Venue] = [
    Venue(
        key="930", name="9:30 Club", url="https://www.930.com/",
        address="815 V St NW, Washington, DC 20001", neighborhood="U Street",
        card_selector="article.event-status-live", title_selector=".event-name",
        date_selector=".dates", ticket_selector="a.tickets",
        link_selector=".event-name a, span.more-info a, a.image-url, a[href]",
        time_selector=".doors, .times",
    ),
    Venue(
        key="anthem", name="The Anthem", url="https://theanthemdc.com/",
        address="901 Wharf St SW, Washington, DC 20024", neighborhood="The Wharf",
        card_selector="div.event", title_selector="h3 a", date_selector=".event__date",
        ticket_selector="a.btn-ticketmaster-buy", link_selector="h3 a",
        time_selector=".event__content p",  # all <p> are joined; "Doors: 6:30PM" may not be first
        card_filter=lambda c: set(c.get("class") or []) == {"event"},
    ),
    Venue(
        key="lincoln", name="Lincoln Theatre", url="https://www.thelincolndc.com/",
        address="1215 U St NW, Washington, DC 20009", neighborhood="U Street",
        card_selector="div.event-list-item", title_selector=".item-title", date_selector=".item-date",
        ticket_selector="a.tickets", link_selector="a.more-info, a.list-item-image-wrapper",
        time_selector=".item-subtitle, .item-time",
    ),
    Venue(
        key="atlantis", name="The Atlantis", url="https://theatlantis.com/",
        address="2047 9th St NW, Washington, DC 20001", neighborhood="U Street",
        card_selector="div.event-list-item", title_selector=".item-title", date_selector=".item-date",
        ticket_selector="a.event-button-link", link_selector="a.list-item-image-wrapper, a.event-button--more-info a",
        time_selector=".item-time",
    ),
]
VENUES_BY_KEY = {v.key: v for v in VENUES}


def _text(el: Tag | None) -> str:
    return el.get_text(" ", strip=True) if el else ""


def _texts(card: Tag, selector: str | None) -> str:
    if not selector:
        return ""
    return " ".join(_text(el) for el in card.select(selector))


def _is_cancelled(card: Tag) -> bool:
    if card.select_one(".cancelled, .canceled, .event-status-cancelled"):
        return True
    return bool(re.search(r"\b(cancel+ed|postponed)\b", card.get_text(" ", strip=True), re.I))


def _first_href(card: Tag, selector: str) -> str | None:
    for sel in selector.split(","):
        a = card.select_one(sel.strip())
        if a and a.get("href"):
            return a["href"].strip()
    return None


def _resolve_date(date_text: str, ticket_url: str | None, today: datetime) -> datetime | None:
    """Return the event's calendar date (naive) from the ticket URL or the card text."""
    if ticket_url:
        m = _TICKET_DATE_RE.search(ticket_url)
        if m:
            mm, dd, yyyy = (int(x) for x in m.groups())
            try:
                return datetime(yyyy, mm, dd)
            except ValueError:
                pass
    cleaned = re.sub(r"[·•|]", " ", date_text)
    cleaned = re.sub(r"^\s*(mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+", "", cleaned, flags=re.I).strip()
    if not cleaned:
        return None
    has_year = bool(re.search(r"\b(19|20)\d{2}\b", cleaned))
    try:
        dt = dparser.parse(cleaned, default=datetime(today.year, 1, 1))
    except (ValueError, OverflowError):
        return None
    if not has_year and (dt.date() - today.date()).days < -60:
        dt = dt.replace(year=dt.year + 1)  # listing is for next year's show
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)


def _resolve_time(time_text: str) -> tuple[int, int] | None:
    """Pick the show time: the last time on the card ("DOORS 6pm ... 7pm" → 7pm), else the only one."""
    matches = _TIME_RE.findall(time_text)
    if not matches:
        return None
    hhmm, ampm = matches[-1]
    hour, _, minute = hhmm.partition(":")
    hour, minute = int(hour), int(minute or 0)
    if ampm.lower().startswith("p") and hour < 12:
        hour += 12
    if ampm.lower().startswith("a") and hour == 12:
        hour = 0
    return hour, minute


def parse_venue_html(venue: Venue, html: str, today: datetime | None = None) -> list[RawCandidate]:
    today = today or datetime.now(ET).replace(tzinfo=None)
    soup = BeautifulSoup(html, "html.parser")
    out: list[RawCandidate] = []
    seen: dict[str, int] = {}  # external_id → index in out
    for card in soup.select(venue.card_selector):
        if venue.card_filter and not venue.card_filter(card):
            continue
        title = _text(card.select_one(venue.title_selector))
        if not title:
            continue
        if _is_cancelled(card):
            log.debug("%s: skipping cancelled %r", venue.key, title)
            continue
        ticket_url = _first_href(card, venue.ticket_selector)
        event_url = _first_href(card, venue.link_selector) or ticket_url or venue.url
        date = _resolve_date(_text(card.select_one(venue.date_selector)), ticket_url, today)
        if not date:
            log.debug("%s: no date for %r", venue.key, title)
            continue
        time_text = _texts(card, venue.time_selector) or card.get_text(" ", strip=True)
        hm = _resolve_time(time_text)
        if hm:
            local = ET.localize(date.replace(hour=hm[0], minute=hm[1]))
            is_all_day = False
        else:
            local = ET.localize(date)
            is_all_day = True  # concert with no time on the listing: show on the day
        card_text = card.get_text(" ", strip=True)
        sold_out = "sold out" in card_text.lower()
        external_id = hashlib.sha1(f"{venue.key}|{event_url}".encode()).hexdigest()[:16]
        if external_id in seen:
            # Featured carousel cards repeat list cards (without a time); keep the timed one.
            prior = out[seen[external_id]]
            if prior["is_all_day"] and not is_all_day:
                prior["start_at"], prior["is_all_day"] = local.isoformat(), False
            continue
        seen[external_id] = len(out)
        out.append({
            "external_id": external_id,
            "title": title,
            "start_at": local.isoformat(),
            "end_at": None,
            "is_all_day": is_all_day,
            "type": classify_type(title, "music", _TYPE_KEYWORDS),
            "venue_name": venue.name,
            "venue_address": venue.address,
            "neighborhood": venue.neighborhood,
            "url": event_url,
            "cost_text": "Sold out" if sold_out else None,
            "tags": filter_tags(["ticketed"]),
            "source_url": venue.url,
        })
    return out


class IMPSource(SourceBase):
    source_key = "imp"
    schedule = "0 8 * * *"

    def fetch(self) -> list[RawCandidate]:
        out: list[RawCandidate] = []
        for venue in VENUES:
            try:
                resp = requests.get(venue.url, headers={"User-Agent": USER_AGENT}, timeout=60)
                resp.raise_for_status()
            except requests.RequestException as e:
                log.warning("imp: skipping %s: %s", venue.name, e)
                continue
            items = parse_venue_html(venue, resp.text)
            log.info("imp: %s → %d events", venue.name, len(items))
            out.extend(items)
        return out

    def extract(self, raw: RawCandidate) -> list[ExtractedEvent]:
        eid = raw.pop("external_id")
        return [{"external_id": eid, "payload": raw}]


if __name__ == "__main__":
    main_for(IMPSource)
