# tests/db/test_promote_pending_events_happy.py
from datetime import datetime, timedelta, timezone


def test_promote_happy_path(sb):
    future = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    sb.table("staging_events").insert({
        "source": "clockout",
        "external_id": "abc123",
        "raw_payload": {
            "title": "Jazz in the Garden",
            "start_at": future,
            "type": "music",
            "venue_name": "Sculpture Garden",
            "tags": ["free", "outdoor"],
        },
    }).execute()

    rpc = sb.rpc("promote_pending_events", {"p_source": "clockout"}).execute()
    assert rpc.data and rpc.data[0]["approved"] == 1
    assert rpc.data[0]["rejected"] == 0

    rows = sb.table("events").select("title, type, source_external_id").execute().data
    assert len(rows) == 1
    assert rows[0]["title"] == "Jazz in the Garden"
    assert rows[0]["type"] == "music"
    assert rows[0]["source_external_id"] == "abc123"

    tags = sb.table("event_tags").select("tag_slug").execute().data
    assert sorted(t["tag_slug"] for t in tags) == ["free", "outdoor"]
