# tests/test_dates.py
from datetime import datetime, timezone, timedelta
import pytz
from scripts.shared.dates import parse_et


ET = pytz.timezone("America/New_York")


def test_parse_iso_with_tz_returns_utc():
    dt = parse_et("2026-04-26T17:00:00-04:00")
    assert dt.tzinfo == timezone.utc
    assert dt.hour == 21


def test_parse_iso_naive_assumes_et():
    dt = parse_et("2026-04-26T17:00:00")
    # 5pm ET in April (EDT, UTC-4) → 21:00 UTC
    assert dt.tzinfo == timezone.utc
    assert dt.hour == 21


def test_parse_natural_relative_weekday(monkeypatch):
    # Pin "now" for determinism: Mon 2026-04-20 noon ET
    fake_now = ET.localize(datetime(2026, 4, 20, 12, 0))
    monkeypatch.setattr("scripts.shared.dates._now_et", lambda: fake_now)
    dt = parse_et("Sat 5pm")
    assert dt.tzinfo == timezone.utc
    # Sat 2026-04-25 17:00 ET → 21:00 UTC
    assert dt.year == 2026 and dt.month == 4 and dt.day == 25 and dt.hour == 21


def test_invalid_returns_none():
    assert parse_et("not a date") is None
    assert parse_et("") is None
    assert parse_et(None) is None
