import json
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

from scripts.data_import.dc730.run import (
    DC730Source, _content_fingerprint, _hash_external_id, _readable_text,
)


def _fake_msg(events):
    fake_msg = MagicMock()
    fake_msg.stop_reason = "end_turn"
    fake_msg.content = [MagicMock(type="text", text=json.dumps({"events": events}))]
    return fake_msg


ONE_EVENT = [{
    "title": "ANC 1A Public Meeting",
    "start_at": "2026-04-26T19:00:00",
    "type": "civic",
    "neighborhood": "Columbia Heights",
    "tags": [],
}]


def test_extract_calls_llm_with_week_scheduler_prompt():
    html = Path("tests/fixtures/dc730/sample-pub.html").read_text()
    raw = {"fetched_on": "2026-04-25", "text": _readable_text(html)}

    with patch("scripts.shared.extraction._call_model", return_value=_fake_msg(ONE_EVENT)) as call:
        out = DC730Source().extract(raw)

    assert len(out) == 1
    assert out[0]["payload"]["title"] == "ANC 1A Public Meeting"
    assert out[0]["payload"]["type"] == "civic"
    assert out[0]["external_id"] == _hash_external_id("ANC 1A Public Meeting", out[0]["payload"]["start_at"])

    prompt = call.call_args.args[0]
    assert "fetched on 2026-04-25" in prompt          # LLM gets a reference date for year-less headings
    assert "Wednesday, April 22" in prompt              # readable doc text made it into the prompt
    assert "ppConfig" not in prompt                    # scripts stripped


def test_extract_accepts_legacy_html_candidate():
    html = Path("tests/fixtures/dc730/sample-pub.html").read_text()
    with patch("scripts.shared.extraction._call_model", return_value=_fake_msg(ONE_EVENT)):
        out = DC730Source().extract({"doc_publication_date": "2026-04-25", "html": html})
    assert len(out) == 1


def test_external_id_is_stable_across_fetch_dates():
    # Same event fetched on two different days must map to the same staging row.
    raw_a = {"fetched_on": "2026-04-25", "text": "..."}
    raw_b = {"fetched_on": "2026-04-26", "text": "..."}
    with patch("scripts.shared.extraction._call_model", return_value=_fake_msg(ONE_EVENT)):
        a = DC730Source().extract(raw_a)
        b = DC730Source().extract(raw_b)
    assert a[0]["external_id"] == b[0]["external_id"]


def _fake_response(html: str):
    resp = MagicMock()
    resp.text = html
    resp.raise_for_status = MagicMock()
    return resp


def test_fetch_skips_when_doc_unchanged():
    html = Path("tests/fixtures/dc730/sample-pub.html").read_text()
    fingerprint = _content_fingerprint(_readable_text(html))

    with patch("scripts.data_import.dc730.run.requests.get", return_value=_fake_response(html)), \
         patch("scripts.data_import.dc730.run._last_cursor", return_value=fingerprint), \
         patch("scripts.data_import.dc730.run._save_cursor") as save:
        src = DC730Source()
        assert src.fetch() == []
        src.on_success()

    save.assert_not_called()


def test_cursor_is_saved_only_after_a_successful_real_run():
    html = Path("tests/fixtures/dc730/sample-pub.html").read_text()
    fingerprint = _content_fingerprint(_readable_text(html))

    with patch("scripts.data_import.dc730.run.requests.get", return_value=_fake_response(html)), \
         patch("scripts.data_import.dc730.run._last_cursor", return_value="stale"), \
         patch("scripts.data_import.dc730.run._save_cursor") as save, \
         patch("scripts.shared.extraction._call_model", return_value=_fake_msg(ONE_EVENT)):
        src = DC730Source()
        items = src.fetch()
        assert len(items) == 1 and items[0]["text"]
        save.assert_not_called()                      # fetch() no longer writes

        # A dry run must not advance the cursor either.
        src.run(dry_run=True)
        save.assert_not_called()

        # A real run stages, promotes, then persists the cursor.
        with patch("scripts.shared.source.upsert_staging_batch", return_value=1), \
             patch("scripts.shared.source.call_promote_pending", return_value=[{"approved": 1}]):
            metrics = src.run(dry_run=False)

    assert metrics["approved"] == 1
    save.assert_called_once_with(fingerprint)


@pytest.mark.skipif(
    __import__("os").environ.get("RUN_LLM_TESTS") != "1",
    reason="real-LLM test gated by RUN_LLM_TESTS=1",
)
def test_real_llm_extracts_events_from_fixture():
    html = Path("tests/fixtures/dc730/sample-pub.html").read_text()
    out = DC730Source().extract({"fetched_on": "2026-04-25", "text": _readable_text(html)})
    assert len(out) > 5, "the weekly scheduler fixture lists dozens of events"
    for ex in out:
        assert ex["payload"]["title"]
        assert ex["payload"]["start_at"].startswith("2026-")
        assert ex["payload"]["type"] in ("music", "food", "arts", "outdoors", "civic", "community")
