from __future__ import annotations
from scripts.shared.source import main_for
from scripts.shared.tribe import TribeEventsSource, DEFAULT_TYPE_KEYWORDS


class SixthAndISource(TribeEventsSource):
    """Sixth & I — talks, concerts, comedy and community programming (Chinatown)."""
    source_key = "sixthandi"
    schedule = "15 7 * * *"
    base_url = "https://www.sixthandi.org"
    default_type = "community"
    default_neighborhood = "Chinatown"
    type_keywords = {
        **DEFAULT_TYPE_KEYWORDS,
        "music": DEFAULT_TYPE_KEYWORDS["music"] + ("live music",),
        "arts": DEFAULT_TYPE_KEYWORDS["arts"] + ("author", "storytelling", "improv"),
    }


if __name__ == "__main__":
    main_for(SixthAndISource)
