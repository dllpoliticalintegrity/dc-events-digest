from __future__ import annotations
import json
import logging
import os
import re
from typing import Any
from anthropic import Anthropic
from .taxonomy import TYPES, filter_tags, is_valid_type
from .dates import parse_et

log = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-6"

PROMPT_TEMPLATE = """You are extracting concrete, scheduled events from an article.

Return JSON ONLY in this exact shape:
{{
  "events": [
    {{
      "title": str,
      "start_at": str (ISO 8601; assume Eastern Time if no timezone present),
      "end_at": str | null,
      "is_all_day": bool (true when no start time is given),
      "venue_name": str | null,
      "neighborhood": str | null,
      "type": one of {types},
      "tags": subset of {tags},
      "cost_text": str | null
    }}
  ]
}}

Rules:
- If the article is general commentary, criticism, or has no concrete date/time, return {{"events": []}}.
- Never invent dates. If a date is ambiguous, omit the event.
- {extra_instructions}

ARTICLE:
{article_text}
"""

_client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

# A whole newsletter can yield dozens of events (~100 output tokens each);
# a low cap truncates the JSON mid-array and the entire batch is lost.
MAX_OUTPUT_TOKENS = 16000

_FENCE_RE = re.compile(r"^\s*```(?:json)?\s*(.*?)\s*```\s*$", re.DOTALL)


def _response_text(msg: Any) -> str:
    """Concatenate the text blocks of a response (skips thinking/tool blocks)."""
    parts = []
    for block in getattr(msg, "content", None) or []:
        btype = getattr(block, "type", None)
        if isinstance(btype, str) and btype != "text":
            continue  # thinking / tool_use / other non-text blocks
        text = getattr(block, "text", None)
        if isinstance(text, str):
            parts.append(text)
    return "".join(parts)


def _parse_json(raw: str) -> dict[str, Any] | None:
    """Parse the model's JSON, tolerating a ```json fence around it."""
    candidate = raw.strip()
    m = _FENCE_RE.match(candidate)
    if m:
        candidate = m.group(1)
    try:
        data = json.loads(candidate or "{}")
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def extract_events(
    article_text: str,
    source_url: str,
    extra_instructions: str = "",
) -> list[dict[str, Any]]:
    """Call Claude, parse the structured response, normalize and validate."""
    prompt = PROMPT_TEMPLATE.format(
        types=list(TYPES),
        tags=["free", "ticketed", "outdoor", "21+", "family", "accessible", "weekend", "happy-hour"],
        extra_instructions=extra_instructions or "Extract every concrete event mentioned.",
        article_text=article_text[:20000],
    )
    msg = _client.messages.create(
        model=MODEL,
        max_tokens=MAX_OUTPUT_TOKENS,
        messages=[{"role": "user", "content": prompt}],
    )
    if getattr(msg, "stop_reason", None) == "max_tokens":
        log.warning(
            "LLM output for %s hit max_tokens=%d; events after the cut-off are lost",
            source_url, MAX_OUTPUT_TOKENS,
        )
    raw = _response_text(msg)
    data = _parse_json(raw)
    if data is None:
        log.warning("LLM returned non-JSON for %s: %s", source_url, raw[:200])
        return []

    events_in = data.get("events") or []
    out: list[dict[str, Any]] = []
    for ev in events_in:
        # Drop anything failing taxonomy or date validation
        if not isinstance(ev, dict):
            continue
        if not ev.get("title") or not is_valid_type(ev.get("type", "")):
            continue
        parsed = parse_et(ev.get("start_at"))
        if parsed is None:
            continue
        out.append({
            "title": ev["title"].strip(),
            "start_at": parsed.isoformat(),
            "end_at": (parse_et(ev.get("end_at")).isoformat() if parse_et(ev.get("end_at")) else None),
            "is_all_day": bool(ev.get("is_all_day")),
            "venue_name": ev.get("venue_name"),
            "neighborhood": ev.get("neighborhood"),
            "type": ev["type"],
            "tags": filter_tags(ev.get("tags") or []),
            "cost_text": ev.get("cost_text"),
            "source_url": source_url,
        })
    return out
