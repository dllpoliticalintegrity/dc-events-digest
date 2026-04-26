from __future__ import annotations
from typing import Any, Iterable
from .supabase import get_supabase_client


def upsert_staging(source: str, external_id: str, payload: dict[str, Any]) -> None:
    sb = get_supabase_client()
    sb.table("staging_events").upsert(
        {
            "source": source,
            "external_id": external_id,
            "raw_payload": payload,
            "status": "pending",
            "reject_reason": None,
            "promoted_event_id": None,
        },
        on_conflict="source,external_id",
    ).execute()


def upsert_staging_batch(source: str, items: Iterable[tuple[str, dict[str, Any]]]) -> int:
    sb = get_supabase_client()
    rows = [
        {
            "source": source,
            "external_id": eid,
            "raw_payload": payload,
            "status": "pending",
            "reject_reason": None,
            "promoted_event_id": None,
        }
        for eid, payload in items
    ]
    if not rows:
        return 0
    sb.table("staging_events").upsert(rows, on_conflict="source,external_id").execute()
    return len(rows)


def call_promote_pending(source: str | None = None) -> list[dict[str, Any]]:
    sb = get_supabase_client()
    res = sb.rpc("promote_pending_events", {"p_source": source}).execute()
    return res.data or []
