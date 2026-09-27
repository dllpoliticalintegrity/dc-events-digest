import json
from unittest.mock import MagicMock, patch
from scripts.shared.extraction import extract_events


def test_extract_events_parses_structured_response():
    fake_message = MagicMock()
    fake_message.content = [MagicMock(text=json.dumps({
        "events": [
            {
                "title": "Jazz in the Garden",
                "start_at": "2026-04-26T17:00:00",
                "venue_name": "Sculpture Garden",
                "type": "music",
                "tags": ["free", "outdoor"],
            },
        ],
    }))]
    fake_client = MagicMock()
    fake_client.messages.create.return_value = fake_message

    with patch("scripts.shared.extraction._call_model", return_value=fake_message):
        events = extract_events(article_text="(article body)", source_url="https://x.test/1")

    assert len(events) == 1
    e = events[0]
    assert e["title"] == "Jazz in the Garden"
    assert e["type"] == "music"
    assert e["tags"] == ["free", "outdoor"]
    assert e["source_url"] == "https://x.test/1"


def test_extract_events_returns_empty_when_no_events_in_article():
    fake_message = MagicMock()
    fake_message.content = [MagicMock(text=json.dumps({"events": []}))]
    fake_client = MagicMock()
    fake_client.messages.create.return_value = fake_message

    with patch("scripts.shared.extraction._call_model", return_value=fake_message):
        events = extract_events(article_text="commentary", source_url="https://x.test/2")

    assert events == []


def test_extract_events_drops_invalid_type():
    fake_message = MagicMock()
    fake_message.content = [MagicMock(text=json.dumps({
        "events": [{"title": "X", "start_at": "2026-04-26T17:00:00", "type": "nightlife"}],
    }))]
    fake_client = MagicMock()
    fake_client.messages.create.return_value = fake_message

    with patch("scripts.shared.extraction._call_model", return_value=fake_message):
        events = extract_events(article_text="(body)", source_url="u")

    assert events == []  # invalid type → dropped
