TYPES: tuple[str, ...] = ("music", "food", "arts", "outdoors", "civic", "community")

TAGS: tuple[str, ...] = (
    "free", "ticketed", "outdoor", "21+",
    "family", "accessible", "weekend", "happy-hour",
)


def is_valid_type(t: str) -> bool:
    return t in TYPES


def filter_tags(tags) -> list[str]:
    """Drop unknown tags, dedupe, preserve canonical order."""
    seen = set()
    out: list[str] = []
    incoming = set(tags or ())
    for t in TAGS:
        if t in incoming and t not in seen:
            out.append(t)
            seen.add(t)
    return out
