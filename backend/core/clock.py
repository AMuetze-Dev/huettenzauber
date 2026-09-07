"""Zeit-Helfer. business_day = Kalendertag in der Betriebs-Zeitzone (ab Mitternacht)."""
from __future__ import annotations

from datetime import date, datetime
from zoneinfo import ZoneInfo

from core.config import settings

_TZ = ZoneInfo(settings.business_timezone)


def business_day(moment: datetime | None = None) -> date:
    now = moment or datetime.now(_TZ)
    if now.tzinfo is None:
        now = now.replace(tzinfo=_TZ)
    return now.astimezone(_TZ).date()
