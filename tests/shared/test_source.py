import pytest
from scripts.shared.source import SourceBase, RawCandidate, ExtractedEvent
from scripts.shared.supabase import get_supabase_client
from datetime import datetime, timedelta, timezone


@pytest.fixture(autouse=True)
def _clean():
    sb = get_supabase_client()
    sb.table("staging_events").delete().eq("source", "fake").execute()
    sb.table("event_tags").delete().neq("event_id", "00000000-0000-0000-0000-000000000000").execute()
    sb.table("events").delete().eq("source", "fake").execute()
    yield


class FakeSource(SourceBase):
    source_key = "fake"
    schedule = "0 6 * * *"

    def fetch(self) -> list[RawCandidate]:
        future = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        return [
            {"external_id": "f1", "title": "Show A", "start_at": future, "type": "music"},
            {"external_id": "f2", "title": "Show B", "start_at": future, "type": "food"},
        ]

    def extract(self, raw: RawCandidate) -> list[ExtractedEvent]:
        return [{"external_id": raw["external_id"], "payload": raw}]


def test_dry_run_does_not_write():
    metrics = FakeSource().run(dry_run=True)
    assert metrics["fetched"] == 2
    assert metrics["staged"] == 0  # dry run

    sb = get_supabase_client()
    rows = sb.table("staging_events").select("id").eq("source", "fake").execute().data
    assert rows == []


def test_real_run_writes_and_promotes():
    metrics = FakeSource().run(dry_run=False)
    assert metrics["fetched"] == 2
    assert metrics["staged"] == 2
    assert metrics["approved"] == 2
    assert metrics["rejected"] == 0


def test_limit_caps_extraction():
    metrics = FakeSource().run(dry_run=False, limit=1)
    assert metrics["fetched"] == 2
    assert metrics["staged"] == 1
