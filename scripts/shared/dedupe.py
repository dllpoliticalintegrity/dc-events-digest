from __future__ import annotations
import re
from difflib import SequenceMatcher

_NORM_RE = re.compile(r"[^a-z0-9 ]+")


def _norm(s: str) -> str:
    return _NORM_RE.sub("", s.lower()).strip()


def title_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, _norm(a), _norm(b)).ratio()


def is_likely_duplicate(a: str, b: str, threshold: float = 0.7) -> bool:
    return title_similarity(a, b) >= threshold
