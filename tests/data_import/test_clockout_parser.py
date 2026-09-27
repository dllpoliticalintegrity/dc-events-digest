from pathlib import Path
from scripts.data_import.clockout.run import ClockoutSource, parse_title_trailer


def test_parser_extracts_at_least_one_event():
    html = Path("tests/fixtures/clockout/sample.html").read_text()
    items = ClockoutSource().parse_html(html)
    assert len(items) >= 1, "expected at least one event in the fixture"


def test_parser_event_has_required_fields():
    html = Path("tests/fixtures/clockout/sample.html").read_text()
    items = ClockoutSource().parse_html(html)
    e = items[0]
    assert e.get("title")
    assert e.get("start_at")
    assert e.get("url")
    assert e.get("external_id")


def test_title_trailer_parsing():
    assert parse_title_trailer("history: Forgeries Throughout History (6-8:30pm, $15)") == \
        ("history: Forgeries Throughout History", (18, 0), (20, 30), "$15")
    assert parse_title_trailer("Birds: Guided Bird Walks (9:30-11am, free)") == \
        ("Birds: Guided Bird Walks", (9, 30), (11, 0), "free")
    assert parse_title_trailer("Craft: Moss Art (1pm, $20)") == ("Craft: Moss Art", (13, 0), None, "$20")
    assert parse_title_trailer("Film: Late Show (11:30pm)") == ("Film: Late Show", (23, 30), None, None)
    assert parse_title_trailer("Comedy (of Errors)") == ("Comedy (of Errors)", None, None, None)  # not a trailer


def test_parser_sets_start_time_cost_and_stable_id_from_trailer():
    html = Path("tests/fixtures/clockout/sample.html").read_text()
    items = ClockoutSource().parse_html(html)
    timed = [i for i in items if not i["is_all_day"]]
    assert timed, "fixture should contain at least one '(time, cost)' title"
    e = timed[0]
    assert "(" not in e["title"].split(":")[-1][-12:] or e["cost_text"]  # trailer stripped
    assert e["start_at"][11:16] != "00:00"
    assert e["cost_text"] in (None,) or e["cost_text"].startswith(("$", "free", "Free"))
    # id is keyed on url + day, so it does not change when a time is parsed
    assert e["external_id"] == __import__("hashlib").sha1(f"{e['url']}|{e['start_at'][:10]}".encode()).hexdigest()[:16]
