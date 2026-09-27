import json
from pathlib import Path
from unittest.mock import MagicMock, patch

from scripts.data_import.rhizome.run import RhizomeSource, _cost_and_tags


def _load():
    return json.loads(Path("tests/fixtures/rhizome/events.json").read_text())


def test_fetch_returns_only_upcoming():
    data = _load()
    resp = MagicMock(); resp.json.return_value = data; resp.raise_for_status = MagicMock()
    with patch("scripts.data_import.rhizome.run.requests.get", return_value=resp):
        raw = RhizomeSource().fetch()
    assert len(raw) == len(data["upcoming"]) == 3


def test_extract_maps_squarespace_item():
    item = next(i for i in _load()["upcoming"] if i["title"].startswith("Plastique Pigs"))
    out = RhizomeSource().extract(item)
    assert len(out) == 1
    p = out[0]["payload"]
    assert out[0]["external_id"] == str(item["id"])
    assert p["start_at"] == "2026-09-26T23:00:00+00:00"        # 7pm ET on Sep 26, epoch ms → UTC ISO
    assert p["type"] == "music"                                 # from the 'music' tag
    assert p["venue_name"] == "Rhizome DC" and p["neighborhood"] == "Takoma"
    assert p["url"] == "https://www.rhizomedc.org" + item["fullUrl"]
    assert p["cost_text"] == "$10-15"                           # parsed from the excerpt line
    assert p["tags"] == ["ticketed"]
    assert "Saturday September 26" in p["description"]


def test_visual_art_tag_maps_to_arts():
    item = next(i for i in _load()["upcoming"] if "visual art" in i["tags"])
    assert RhizomeSource().extract(item)[0]["payload"]["type"] == "arts"


def test_cost_parsing():
    assert _cost_and_tags("Friday * 8pm * Free * all ages") == ("Free", ["free"])
    assert _cost_and_tags("$12 suggested donation") == ("$12 suggested donation", ["ticketed"])
    assert _cost_and_tags("Bring a dish") == (None, [])
