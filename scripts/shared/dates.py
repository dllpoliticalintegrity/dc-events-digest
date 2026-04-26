from __future__ import annotations
from datetime import datetime, timedelta, timezone
import re
from typing import Optional
import pytz
from dateutil import parser as dparser

ET = pytz.timezone("America/New_York")

_WEEKDAYS = {
    "mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6,
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
}
_NATURAL_RE = re.compile(
    r"^(?P<dow>[A-Za-z]+)\s+(?P<h>\d{1,2})(?::(?P<m>\d{2}))?\s*(?P<ampm>am|pm)?$",
    re.IGNORECASE,
)


def _now_et() -> datetime:
    return datetime.now(ET)


def parse_et(value: Optional[str]) -> Optional[datetime]:
    if not value or not value.strip():
        return None
    s = value.strip()

    # Natural relative weekday like "Sat 5pm"
    m = _NATURAL_RE.match(s)
    if m and m.group("dow")[:3].lower() in {k[:3] for k in _WEEKDAYS}:
        target_dow = _WEEKDAYS[m.group("dow")[:3].lower()]
        hour = int(m.group("h"))
        minute = int(m.group("m") or 0)
        ampm = (m.group("ampm") or "").lower()
        if ampm == "pm" and hour < 12:
            hour += 12
        if ampm == "am" and hour == 12:
            hour = 0
        now = _now_et()
        days_ahead = (target_dow - now.weekday()) % 7
        if days_ahead == 0 and (hour, minute) <= (now.hour, now.minute):
            days_ahead = 7
        target = now + timedelta(days=days_ahead)
        local = ET.localize(datetime(target.year, target.month, target.day, hour, minute))
        return local.astimezone(timezone.utc)

    # Generic parse
    try:
        dt = dparser.parse(s)
    except (ValueError, OverflowError):
        return None
    if dt.tzinfo is None:
        dt = ET.localize(dt)
    return dt.astimezone(timezone.utc)
