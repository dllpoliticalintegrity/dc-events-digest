# tests/db/test_promote_pending_events_idempotent.py
from datetime import datetime, timedelta, timezone


def test_running_twice_yields_same_state(sb):
    future = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    payload = {
        "title": "Jazz in the Garden",
        "start_at": future,
        "type": "music",
        "venue_name": "Sculpture Garden",
        "tags": ["free", "outdoor"],
    }
    sb.table("staging_events").upsert({
        "source": "clockout", "external_id": "abc123", "raw_payload": payload, "status": "pending",
    }, on_conflict="source,external_id").execute()
    sb.rpc("promote_pending_events", {"p_source": "clockout"}).execute()

    # Re-stage same external_id (status reset to pending) and re-promote
    sb.table("staging_events").update({"status": "pending"}).eq("external_id", "abc123").execute()
    sb.rpc("promote_pending_events", {"p_source": "clockout"}).execute()

    events = sb.table("events").select("source_external_id").execute().data
    assert [e["source_external_id"] for e in events] == ["abc123"]
    tags = sb.table("event_tags").select("tag_slug").execute().data
    assert sorted(t["tag_slug"] for t in tags) == ["free", "outdoor"]
