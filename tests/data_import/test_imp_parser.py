from datetime import datetime
from pathlib import Path

from scripts.data_import.imp.run import VENUES_BY_KEY, parse_venue_html, _resolve_date, _resolve_time

TODAY = datetime(2026, 9, 27)


def _parse(key):
    html = Path(f"tests/fixtures/imp/{key}.html").read_text()
    return parse_venue_html(VENUES_BY_KEY[key], html, today=TODAY)


def test_930_featured_and_list_cards():
    # Fixture: 2 featured carousel cards, 1 cancelled list card, 1 live list card,
    # and a list card that repeats the first featured show (with its doors time).
    items = _parse("930")
    by_title = {i["title"]: i for i in items}
    assert "josh conway: the plum tour (of The Marías)" not in by_title   # cancelled → skipped
    assert len(items) == 3

    first = by_title["Hamilton Leithauser + Rostam: The Joint Tour"]
    assert first["start_at"] == "2026-11-05T19:00:00-05:00"  # featured card (no time) overridden by list card "Doors: 7 PM"
    assert first["is_all_day"] is False
    assert first["venue_name"] == "9:30 Club" and first["neighborhood"] == "U Street"
    assert first["url"] == "https://www.930.com/e/hamilton-leithauser-rostam-the-joint-tour"
    assert first["type"] == "music" and first["tags"] == ["ticketed"]

    podcast = by_title["Criminal Presents: Don't Worry with Phoebe Judge"]
    assert podcast["start_at"].startswith("2026-11-23")        # "Mon, November 23" + ticket URL year
    assert podcast["is_all_day"] is True                        # featured card only, no time

    prom = by_title["Don't Stop Believing: An 80s Prom Experience"]
    assert prom["start_at"] == "2026-09-26T18:00:00-04:00"     # list card: "Sat 26 Sep" + "Doors: 6 PM"
    assert prom["url"] == "https://www.930.com/e/dont-stop-believing-an-80s-prom-experience"


def test_anthem_cards_parse_mm_dd_date_and_doors_time():
    items = _parse("anthem")
    titles = [i["title"] for i in items]
    assert len(items) == 2
    assert not any("Ravyn Lenae" in t for t in titles)          # card marked CANCELED is skipped
    ringo = items[0]
    assert ringo["title"] == "Ringo Starr and His All Starr Band"
    assert ringo["start_at"] == "2026-09-28T18:30:00-04:00"    # 09/28 + "Doors: 6:30PM"
    assert ringo["venue_name"] == "The Anthem" and ringo["neighborhood"] == "The Wharf"
    assert ringo["url"] == "https://theanthemdc.com/event/ringo-starr-and-his-all-starr-band"


def test_lincoln_and_atlantis_share_the_list_item_theme():
    lincoln = _parse("lincoln")
    assert lincoln[0]["title"].startswith("Ryan Beatty")
    assert lincoln[0]["start_at"] == "2026-09-26T18:30:00-04:00"
    assert lincoln[0]["venue_name"] == "Lincoln Theatre"
    assert lincoln[0]["url"] == "https://www.thelincolndc.com/e/ryan-beatty-arms-over-armor-north-american-tour-26"

    atlantis = _parse("atlantis")
    assert atlantis[0]["title"].startswith("Sawyer Hill")
    assert atlantis[0]["start_at"] == "2026-09-27T18:30:00-04:00"
    assert atlantis[0]["venue_name"] == "The Atlantis"
    assert atlantis[0]["url"].startswith("https://theatlantis.com/e/")


def test_external_ids_are_stable_and_venue_scoped():
    a = {i["external_id"] for i in _parse("lincoln")}
    b = {i["external_id"] for i in _parse("lincoln")}
    assert a == b and len(a) == 3
    assert not (a & {i["external_id"] for i in _parse("atlantis")})


def test_date_resolution_infers_next_year_without_ticket_url():
    assert _resolve_date("Sat, January 10", None, TODAY) == datetime(2027, 1, 10)
    assert _resolve_date("Thu, November 5", None, TODAY) == datetime(2026, 11, 5)
    assert _resolve_date("09/28", "https://www.ticketmaster.com/x-washington-09-28-2026/event/1", TODAY) == datetime(2026, 9, 28)
    assert _resolve_date("Sat · Sep 26, 2026", None, TODAY) == datetime(2026, 9, 26)
    assert _resolve_date("", None, TODAY) is None


def test_time_resolution_prefers_show_time_over_doors():
    assert _resolve_time("DOORS : 6:00 PM Show : 7:00 PM") == (19, 0)
    assert _resolve_time("Doors - 6:30pm") == (18, 30)
    assert _resolve_time("Doors 12:00 AM") == (0, 0)
    assert _resolve_time("This is a seated show.") is None
