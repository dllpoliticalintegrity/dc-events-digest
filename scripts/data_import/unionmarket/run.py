from __future__ import annotations
from scripts.shared.source import main_for
from scripts.shared.tribe import TribeEventsSource, DEFAULT_TYPE_KEYWORDS


class UnionMarketSource(TribeEventsSource):
    """Union Market District — markets, pop-ups, classes and outdoor programming (NoMa/Ivy City)."""
    source_key = "unionmarket"
    schedule = "30 7 * * *"
    base_url = "https://unionmarketdc.com"
    default_type = "community"
    default_neighborhood = "Union Market"
    ignore_categories = frozenset({"Union Market District", "The Market", "Union Market"})
    type_keywords = {
        **DEFAULT_TYPE_KEYWORDS,
        "food": DEFAULT_TYPE_KEYWORDS["food"] + ("tapas", "pop-up", "chef", "bake", "coffee"),
        "arts": DEFAULT_TYPE_KEYWORDS["arts"] + ("mural", "craft", "workshop", "screening"),
        "outdoors": DEFAULT_TYPE_KEYWORDS["outdoors"] + ("plaza", "rooftop", "skate", "tour"),
    }


if __name__ == "__main__":
    main_for(UnionMarketSource)
