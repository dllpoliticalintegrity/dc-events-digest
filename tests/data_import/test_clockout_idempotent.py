import pytest
from scripts.data_import.clockout.run import ClockoutSource
from scripts.shared.supabase import get_supabase_client
from pathlib import Path
from unittest.mock import patch


@pytest.fixture(autouse=True)
def _clean():
    sb = get_supabase_client()
    sb.table("staging_events").delete().eq("source", "clockout").execute()
    sb.table("event_tags").delete().neq("event_id", "00000000-0000-0000-0000-000000000000").execute()
    sb.table("events").delete().eq("source", "clockout").execute()
    yield


def test_running_twice_yields_same_events():
    html = Path("tests/fixtures/clockout/sample.html").read_text()

    with patch.object(ClockoutSource, "fetch", lambda self: self.parse_html(html)):
        run1 = ClockoutSource().run(dry_run=False)
        run2 = ClockoutSource().run(dry_run=False)

    sb = get_supabase_client()
    rows = sb.table("events").select("source_external_id").eq("source", "clockout").execute().data
    eids = sorted({r["source_external_id"] for r in rows})
    # Same set of external_ids, same count, no dupes
    assert run1["staged"] == run2["staged"]
    assert len(rows) == run1["approved"]  # second run is all updates
    assert len(eids) == len(rows)
