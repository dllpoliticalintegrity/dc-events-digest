import json
from unittest.mock import MagicMock, patch
from scripts.shared.extraction import extract_events, MAX_OUTPUT_TOKENS


def _client_returning(text: str, stop_reason: str = "end_turn"):
    msg = MagicMock()
    msg.stop_reason = stop_reason
    msg.content = [MagicMock(type="text", text=text)]
    return MagicMock(messages=MagicMock(create=MagicMock(return_value=msg)))


EVENT = {"title": "Night Market", "start_at": "2026-09-24T17:00:00", "type": "food", "is_all_day": False}


def test_fenced_json_is_parsed():
    client = _client_returning("```json\n" + json.dumps({"events": [EVENT]}) + "\n```")
    with patch("scripts.shared.extraction._client", client):
        out = extract_events("body", "u")
    assert [e["title"] for e in out] == ["Night Market"]
    assert out[0]["is_all_day"] is False


def test_truncated_output_returns_empty_and_does_not_raise():
    truncated = json.dumps({"events": [EVENT]})[:-15]  # cut mid-object, as max_tokens would
    client = _client_returning(truncated, stop_reason="max_tokens")
    with patch("scripts.shared.extraction._client", client):
        out = extract_events("body", "u")
    assert out == []


def test_request_uses_generous_output_cap_and_skips_non_text_blocks():
    msg = MagicMock()
    msg.stop_reason = "end_turn"
    thinking = MagicMock(type="thinking"); thinking.text = None
    msg.content = [thinking, MagicMock(type="text", text=json.dumps({"events": [{**EVENT, "is_all_day": True}]}))]
    client = MagicMock(messages=MagicMock(create=MagicMock(return_value=msg)))
    with patch("scripts.shared.extraction._client", client):
        out = extract_events("body", "u")
    assert client.messages.create.call_args.kwargs["max_tokens"] == MAX_OUTPUT_TOKENS >= 8000
    assert out[0]["is_all_day"] is True
