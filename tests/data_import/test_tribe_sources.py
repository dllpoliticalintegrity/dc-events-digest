import json
from pathlib import Path
from unittest.mock import MagicMock, patch

from scripts.data_import.sixthandi.run import SixthAndISource
from scripts.data_import.unionmarket.run import UnionMarketSource
from scripts.shared.tribe import cost_tags, classify_type


def _resp(payload):
    r = MagicMock()
    r.json.return_value = payload
    r.raise_for_status = MagicMock()
    return r


def test_sixthandi_extracts_structured_events():
    data = json.loads(Path("tests/fixtures/sixthandi/events.json").read_text())
    src = SixthAndISource()
    out = [ex for raw in data["events"] for ex in src.extract(raw)]
    assert len(out) == 2
    p = out[0]["payload"]
    assert p["title"] == "Sukkah Open Hours"
    assert p["start_at"] == "2026-09-27T13:00:00+00:00"       # utc_start_date, not local
    assert p["venue_name"] == "Sixth & I"                       # &#038; unescaped
    assert p["venue_address"] == "600 I Street NW, Washington, DC 20001"
    assert p["neighborhood"] == "Chinatown"
    assert p["url"].startswith("https://www.sixthandi.org/event/")
    assert p["type"] == "community"
    # Recurring events on different days keep distinct ids
    assert out[0]["external_id"] != out[1]["external_id"]


def test_unionmarket_classifies_market_as_food():
    data = json.loads(Path("tests/fixtures/unionmarket/events.json").read_text())
    out = [ex for raw in data["events"] for ex in UnionMarketSource().extract(raw)]
    titles = {ex["payload"]["title"]: ex["payload"] for ex in out}
    assert titles["FreshFarm Farmers Market"]["type"] == "food"
    assert titles["FreshFarm Farmers Market"]["venue_name"] == "Union Market"
    assert titles["FreshFarm Farmers Market"]["end_at"] == "2026-09-27T18:00:00+00:00"


def test_unionmarket_ignores_its_own_district_categories():
    # Every Union Market event carries "The Market" / "Union Market District";
    # those must not push unrelated events into the food type.
    raw = {"id": 1, "title": "DC Mural Tour", "utc_start_date": "2026-10-01 15:00:00",
           "categories": [{"name": "The Market"}, {"name": "Union Market District"}], "venue": {}}
    assert UnionMarketSource().extract(raw)[0]["payload"]["type"] == "arts"


def test_fetch_follows_next_rest_url():
    page1 = {"events": [{"id": 1}], "next_rest_url": "https://x.test/wp-json/tribe/events/v1/events?page=2"}
    page2 = {"events": [{"id": 2}]}
    with patch("scripts.shared.tribe.requests.get", side_effect=[_resp(page1), _resp(page2)]) as get:
        raw = SixthAndISource().fetch()
    assert [r["id"] for r in raw] == [1, 2]
    first_call, second_call = get.call_args_list
    assert first_call.kwargs["params"]["start_date"] == "now"
    assert second_call.args[0].endswith("page=2") and second_call.kwargs["params"] is None


def test_hidden_or_unpublished_events_are_dropped():
    base = {"id": 9, "title": "X", "utc_start_date": "2026-10-01 00:00:00", "venue": {}}
    assert SixthAndISource().extract({**base, "hide_from_listings": True}) == []
    assert SixthAndISource().extract({**base, "status": "draft"}) == []
    assert len(SixthAndISource().extract(base)) == 1


def test_cost_and_type_helpers():
    assert cost_tags("Free") == ["free"]
    assert cost_tags("$25 - $40") == ["ticketed"]
    assert cost_tags("") == []
    assert classify_type("Jazz Night", "community") == "music"
    assert classify_type("Board meeting", "community") == "community"
