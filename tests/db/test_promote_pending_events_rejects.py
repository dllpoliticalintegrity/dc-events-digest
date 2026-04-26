# tests/db/test_promote_pending_events_rejects.py
from datetime import datetime, timedelta, timezone


def _stage(sb, **payload):
    sb.table("staging_events").insert({
        "source": "test",
        "external_id": payload.pop("external_id"),
        "raw_payload": payload,
    }).execute()


def _statuses(sb):
    rows = sb.table("staging_events").select("external_id, status, reject_reason").execute().data
    return {r["external_id"]: (r["status"], r["reject_reason"]) for r in rows}


def test_each_reject_rule(sb):
    future = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    past = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
    far_future = (datetime.now(timezone.utc) + timedelta(days=365 * 3)).isoformat()

    _stage(sb, external_id="missing-title", title="", start_at=future, type="music")
    _stage(sb, external_id="missing-start", title="No date", type="music")
    _stage(sb, external_id="past", title="Past show", start_at=past, type="music")
    _stage(sb, external_id="bad-dt", title="Way future", start_at=far_future, type="music")
    _stage(sb, external_id="editorial", title="Open call for artists", start_at=future, type="arts")
    _stage(sb, external_id="lowconf", title="Maybe", start_at=future, type="music", confidence=0.5)
    _stage(sb, external_id="happy", title="Real Show", start_at=future, type="music")

    sb.rpc("promote_pending_events", {"p_source": "test"}).execute()

    s = _statuses(sb)
    assert s["missing-title"] == ("rejected", "missing_required")
    assert s["missing-start"] == ("rejected", "missing_required")
    assert s["past"]          == ("rejected", "past_date")
    assert s["bad-dt"]        == ("rejected", "bad_datetime")
    assert s["editorial"]     == ("rejected", "editorial_mention")
    assert s["lowconf"]       == ("rejected", "low_confidence")
    assert s["happy"][0]      == "approved"

    events = sb.table("events").select("source_external_id").execute().data
    assert [e["source_external_id"] for e in events] == ["happy"]


def test_fuzzy_duplicate(sb):
    future = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    # First insert directly into events (simulating a prior run)
    sb.table("events").insert({
        "title": "Jazz in the Garden",
        "start_at": future,
        "type": "music",
        "source": "test",
        "source_external_id": "original",
    }).execute()
    # Stage a near-duplicate
    _stage(sb, external_id="dup-1", title="Jazz In The Garden!", start_at=future, type="music")
    sb.rpc("promote_pending_events", {"p_source": "test"}).execute()

    s = _statuses(sb)
    assert s["dup-1"] == ("duplicate", "duplicate")
    events = sb.table("events").select("source_external_id").execute().data
    assert [e["source_external_id"] for e in events] == ["original"]
