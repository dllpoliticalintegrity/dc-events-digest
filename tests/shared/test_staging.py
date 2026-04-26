import pytest
from scripts.shared.staging import upsert_staging, call_promote_pending
from scripts.shared.supabase import get_supabase_client
from datetime import datetime, timedelta, timezone


@pytest.fixture(autouse=True)
def _clean():
    sb = get_supabase_client()
    sb.table("staging_events").delete().eq("source", "test_staging").execute()
    sb.table("event_tags").delete().neq("event_id", "00000000-0000-0000-0000-000000000000").execute()
    sb.table("events").delete().eq("source", "test_staging").execute()
    yield


def test_upsert_then_promote():
    future = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    upsert_staging("test_staging", "abc", {
        "title": "Test Show", "start_at": future, "type": "music"
    })
    upsert_staging("test_staging", "abc", {  # idempotent re-upsert
        "title": "Test Show", "start_at": future, "type": "music"
    })

    metrics = call_promote_pending("test_staging")
    assert metrics[0]["approved"] == 1
    assert metrics[0]["staged"] == 1
