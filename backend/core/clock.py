"""Zeit-Helfer. business_day = Kalendertag in der Betriebs-Zeitzone (ab Mitternacht)."""
from __future__ import annotations

from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from core.config import settings

_TZ = ZoneInfo(settings.business_timezone)


def business_day(moment: datetime | None = None) -> date:
    now = moment or datetime.now(_TZ)
    if now.tzinfo is None:
        now = now.replace(tzinfo=_TZ)
    return now.astimezone(_TZ).date()


def local_time(moment: datetime | None = None) -> datetime:
    """Zeitpunkt in der Betriebs-Zeitzone.

    Nicht `astimezone()` ohne Argument: das nimmt die Zeitzone des Rechners,
    und ein Container ohne TZ-Angabe laeuft in UTC - dann steht auf dem
    Ausdruck 06:27, obwohl es an der Theke 08:27 war.
    """
    moment = moment or datetime.now(_TZ)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(_TZ)
