import json
from pathlib import Path
from unittest.mock import patch, MagicMock
from scripts.data_import.dc730.run import DC730Source


def test_extract_calls_llm_with_newsletter_prompt_tweak():
    html = Path("tests/fixtures/dc730/sample-pub.html").read_text()

    fake_msg = MagicMock()
    fake_msg.content = [MagicMock(text=json.dumps({
        "events": [{
            "title": "ANC 1A Public Meeting",
            "start_at": "2026-04-26T19:00:00",
            "type": "civic",
            "neighborhood": "Columbia Heights",
            "tags": [],
        }],
    }))]

    raw = {"doc_publication_date": "2026-04-25", "html": html}

    with patch("scripts.shared.extraction._client", MagicMock(messages=MagicMock(create=MagicMock(return_value=fake_msg)))):
        out = DC730Source().extract(raw)

    assert len(out) == 1
    assert out[0]["payload"]["title"] == "ANC 1A Public Meeting"
    assert out[0]["payload"]["type"] == "civic"
    assert out[0]["external_id"]  # SHA1 of (doc_date + title + start_at)
