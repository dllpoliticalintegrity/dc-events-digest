import time
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from scripts.data_import.washingtonian.run import WashingtonianSource, _parse_cursor, _entry_published


def _entry(link: str, published: str):
    parsed = time.strptime(published, "%a, %d %b %Y %H:%M:%S %z") if False else None
    e = {"link": link, "published": published}
    # feedparser gives published_parsed as a UTC struct_time
    dt = datetime.strptime(published, "%a, %d %b %Y %H:%M:%S +0000").replace(tzinfo=timezone.utc)
    e["published_parsed"] = dt.utctimetuple()
    return SimpleNamespace(link=link, get=e.get)


def test_parse_cursor_accepts_iso_and_legacy_rfc822():
    assert _parse_cursor("2026-05-27T17:42:15+00:00") == datetime(2026, 5, 27, 17, 42, 15, tzinfo=timezone.utc)
    assert _parse_cursor("Wed, 27 May 2026 17:42:15 +0000") == datetime(2026, 5, 27, 17, 42, 15, tzinfo=timezone.utc)
    assert _parse_cursor(None) is None


def test_september_articles_are_newer_than_a_may_cursor():
    # The old code compared "Sat, 26 Sep …" <= "Wed, 27 May …" as strings and skipped everything.
    entries = [
        _entry("https://x.test/new", "Sat, 26 Sep 2026 12:00:00 +0000"),
        _entry("https://x.test/old", "Mon, 25 May 2026 12:00:00 +0000"),
    ]
    resp = MagicMock(text="<html/>"); resp.raise_for_status = MagicMock()
    with patch("scripts.data_import.washingtonian.run.feedparser.parse", return_value=SimpleNamespace(entries=entries)), \
         patch("scripts.data_import.washingtonian.run._last_cursor", return_value="Wed, 27 May 2026 17:42:15 +0000"), \
         patch("scripts.data_import.washingtonian.run.requests.get", return_value=resp), \
         patch("scripts.data_import.washingtonian.run._save_cursor") as save:
        src = WashingtonianSource()
        raw = src.fetch()
        assert [r["article_url"] for r in raw] == ["https://x.test/new"]
        save.assert_not_called()          # cursor moves only after a successful run
        src.on_success()
        save.assert_called_once_with("2026-09-26T12:00:00+00:00")


def test_entry_published_falls_back_to_the_raw_string():
    e = SimpleNamespace(link="u", get={"published": "Sat, 26 Sep 2026 12:00:00 +0000"}.get)
    assert _entry_published(e) == datetime(2026, 9, 26, 12, 0, tzinfo=timezone.utc)
