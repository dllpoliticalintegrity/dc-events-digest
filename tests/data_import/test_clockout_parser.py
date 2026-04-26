from pathlib import Path
from scripts.data_import.clockout.run import ClockoutSource


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
