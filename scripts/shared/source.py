from __future__ import annotations
import argparse
import logging
from dataclasses import dataclass
from typing import Any, TypedDict
from .staging import upsert_staging_batch, call_promote_pending

log = logging.getLogger(__name__)

RawCandidate = dict[str, Any]


class ExtractedEvent(TypedDict):
    external_id: str
    payload: dict[str, Any]


@dataclass
class RunMetrics:
    fetched: int = 0
    staged: int = 0
    approved: int = 0
    rejected: int = 0
    reasons: dict[str, int] | None = None


class SourceBase:
    """Base class for all ingestion sources.

    Subclasses provide:
      - source_key: str   (also used as DB key)
      - schedule:   str   (cron expression for GH Actions; not used at runtime)
      - fetch():    return list of RawCandidate
      - extract():  RawCandidate -> 0..N ExtractedEvent
    """

    source_key: str = ""
    schedule: str = ""

    def fetch(self) -> list[RawCandidate]:
        raise NotImplementedError

    def extract(self, raw: RawCandidate) -> list[ExtractedEvent]:
        raise NotImplementedError

    def on_success(self) -> None:
        """Hook called after a real (non-dry) run has staged and promoted its events.

        Sources that track a cursor should persist it here rather than in fetch(),
        so a failed extraction does not advance the cursor and --dry-run stays read-only.
        """

    def run(self, dry_run: bool = False, limit: int | None = None) -> dict[str, Any]:
        if not self.source_key:
            raise RuntimeError("Subclass must set source_key")

        log.info("source=%s starting (dry_run=%s, limit=%s)", self.source_key, dry_run, limit)
        raw_items = self.fetch()
        fetched = len(raw_items)

        extracted: list[ExtractedEvent] = []
        for raw in raw_items:
            extracted.extend(self.extract(raw))
            if limit is not None and len(extracted) >= limit:
                extracted = extracted[:limit]
                break

        if dry_run:
            log.info(
                "source=%s DRY RUN fetched=%d would_stage=%d",
                self.source_key, fetched, len(extracted),
            )
            for ex in extracted[:5]:
                log.info("  candidate: %s", {k: v for k, v in ex["payload"].items() if k in ("title", "start_at", "type")})
            return {
                "fetched": fetched, "staged": 0, "approved": 0, "rejected": 0, "reasons": {},
            }

        staged = upsert_staging_batch(
            self.source_key,
            ((ex["external_id"], ex["payload"]) for ex in extracted),
        )
        rows = call_promote_pending(self.source_key)
        approved = sum(r.get("approved", 0) for r in rows)
        rejected = sum(r.get("rejected", 0) for r in rows)
        reasons: dict[str, int] = {}
        for r in rows:
            for k, v in (r.get("reasons") or {}).items():
                reasons[k] = reasons.get(k, 0) + int(v)

        self.on_success()

        log.info(
            "source=%s fetched=%d staged=%d approved=%d rejected=%d reasons=%s",
            self.source_key, fetched, staged, approved, rejected, reasons,
        )
        return {
            "fetched": fetched, "staged": staged, "approved": approved,
            "rejected": rejected, "reasons": reasons,
        }


def main_for(cls: type[SourceBase]) -> None:
    """Standard CLI entrypoint for any SourceBase subclass."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--limit", type=int, default=None)
    args = p.parse_args()
    metrics = cls().run(dry_run=args.dry_run, limit=args.limit)
    print(metrics)
