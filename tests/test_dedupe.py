from scripts.shared.dedupe import title_similarity, is_likely_duplicate


def test_title_similarity_identical():
    assert title_similarity("Jazz in the Garden", "Jazz in the Garden") == 1.0


def test_title_similarity_close():
    assert title_similarity("Jazz in the Garden", "Jazz In The Garden!") >= 0.8


def test_title_similarity_unrelated():
    assert title_similarity("Jazz in the Garden", "Eastern Market") < 0.5


def test_is_likely_duplicate_uses_threshold():
    assert is_likely_duplicate("Jazz in the Garden", "JAZZ IN THE GARDEN", 0.7)
    assert not is_likely_duplicate("Jazz in the Garden", "Eastern Market", 0.7)
