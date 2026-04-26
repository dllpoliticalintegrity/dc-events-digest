from scripts.shared.taxonomy import TYPES, TAGS, is_valid_type, filter_tags


def test_types_locked():
    assert TYPES == ("music", "food", "arts", "outdoors", "civic", "community")


def test_tags_locked():
    assert TAGS == ("free", "ticketed", "outdoor", "21+", "family", "accessible", "weekend", "happy-hour")


def test_is_valid_type():
    assert is_valid_type("music")
    assert not is_valid_type("Music")
    assert not is_valid_type("nightlife")


def test_filter_tags_drops_unknown_and_dedupes_and_orders():
    assert filter_tags(["outdoor", "free", "made-up", "outdoor"]) == ["free", "outdoor"]
    assert filter_tags([]) == []
    assert filter_tags(None) == []
