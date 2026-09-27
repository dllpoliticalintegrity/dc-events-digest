import json
from unittest.mock import MagicMock, patch
from scripts.shared.extraction import extract_events, MAX_OUTPUT_TOKENS, _parse_json, _salvage_events


def _msg(text: str, stop_reason: str = "end_turn"):
    msg = MagicMock()
    msg.stop_reason = stop_reason
    msg.content = [MagicMock(type="text", text=text)]
    return msg


EVENT = {"title": "Night Market", "start_at": "2026-09-24T17:00:00", "type": "food", "is_all_day": False}
EVENT2 = {"title": "Folger Salon", "start_at": "2026-09-24T16:30:00", "type": "arts"}


def test_fenced_json_is_parsed():
    with patch("scripts.shared.extraction._call_model", return_value=_msg("```json\n" + json.dumps({"events": [EVENT]}) + "\n```")):
        out = extract_events("body", "u")
    assert [e["title"] for e in out] == ["Night Market"]
    assert out[0]["is_all_day"] is False


def test_truncated_output_keeps_the_complete_events():
    # Cut mid-way through the third object, as a max_tokens stop would.
    full = json.dumps({"events": [EVENT, EVENT2, {"title": "Cut off here", "start_at": "2026-09-25T10:00:00"}]})
    truncated = full[: full.rfind('"start_at"') + 12]
    with patch("scripts.shared.extraction._call_model", return_value=_msg(truncated, stop_reason="max_tokens")):
        out = extract_events("body", "u")
    assert [e["title"] for e in out] == ["Night Market", "Folger Salon"]


def test_truncated_fenced_pretty_json_is_salvaged():
    pretty = "```json\n" + json.dumps({"events": [EVENT, EVENT2]}, indent=2)
    truncated = pretty[:-25]  # inside the last object, no closing fence
    data = _parse_json(truncated)
    assert data and [e["title"] for e in data["events"]] == ["Night Market"]


def test_salvage_returns_nothing_for_garbage():
    assert _salvage_events("no json here") == []
    assert _parse_json("Sure! Here you go") is None


def test_output_cap_is_generous_and_non_text_blocks_are_skipped():
    msg = MagicMock()
    msg.stop_reason = "end_turn"
    thinking = MagicMock(type="thinking"); thinking.text = None
    msg.content = [thinking, MagicMock(type="text", text=json.dumps({"events": [{**EVENT, "is_all_day": True}]}))]
    with patch("scripts.shared.extraction._call_model", return_value=msg) as call:
        out = extract_events("body", "u")
    assert call.call_count == 1
    assert MAX_OUTPUT_TOKENS >= 32000
    assert out[0]["is_all_day"] is True
