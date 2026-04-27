import json
from pathlib import Path
from unittest.mock import patch, MagicMock
from scripts.data_import.washingtonian.run import WashingtonianSource


def test_extract_calls_llm_and_normalizes():
    article_html = Path("tests/fixtures/washingtonian/article-1.html").read_text()

    fake_msg = MagicMock()
    fake_msg.content = [MagicMock(text=json.dumps({
        "events": [{
            "title": "Cherry Blossom Festival Closing Concert",
            "start_at": "2026-04-26T19:00:00",
            "venue_name": "Tidal Basin Stage",
            "type": "music",
            "tags": ["free", "outdoor"],
        }],
    }))]

    raw = {
        "article_url": "https://washingtonian.com/things-to-do/cherry-blossom-finale/",
        "html": article_html,
    }

    with patch("scripts.shared.extraction._client", MagicMock(messages=MagicMock(create=MagicMock(return_value=fake_msg)))):
        out = WashingtonianSource().extract(raw)

    assert len(out) == 1
    e = out[0]
    assert e["payload"]["title"] == "Cherry Blossom Festival Closing Concert"
    assert e["payload"]["type"] == "music"
    assert e["payload"]["source_url"] == raw["article_url"]
    assert e["external_id"]  # SHA1 of (url + title + start_at)
