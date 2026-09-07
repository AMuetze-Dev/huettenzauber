"""Geld- und Mengen-Validierung vor dem DB-Insert.

Die Spalten sind NUMERIC(10,2) bzw. NUMERIC(10,3). Ohne Vorpruefung wuerde
Postgres bei zu grossen Werten einen DataError werfen -> 500. Hier wird daraus
ein sauberer 400er.
"""
from __future__ import annotations

from decimal import Decimal, InvalidOperation

from core.exceptions import ValidationError

MONEY_MAX = Decimal("99999999.99")  # NUMERIC(10,2)
QTY_MAX = Decimal("9999999.999")  # NUMERIC(10,3)
CENT = Decimal("0.01")


def check_money(value: Decimal | None, *, field: str, allow_negative: bool = False) -> Decimal:
    if value is None:
        raise ValidationError(f"{field} fehlt")
    try:
        if not value.is_finite():
            raise ValidationError(f"{field} muss eine endliche Zahl sein")
    except (AttributeError, InvalidOperation) as exc:  # pragma: no cover
        raise ValidationError(f"{field} ist keine gueltige Zahl") from exc
    if not allow_negative and value < 0:
        raise ValidationError(f"{field} muss >= 0 sein")
    if abs(value) > MONEY_MAX:
        raise ValidationError(f"{field} darf hoechstens {MONEY_MAX} betragen")
    return value


def check_qty(value: Decimal | None, *, field: str, positive: bool = False) -> Decimal:
    if value is None:
        raise ValidationError(f"{field} fehlt")
    if not value.is_finite():
        raise ValidationError(f"{field} muss eine endliche Zahl sein")
    if positive and value <= 0:
        raise ValidationError(f"{field} muss > 0 sein")
    if abs(value) > QTY_MAX:
        raise ValidationError(f"{field} darf hoechstens {QTY_MAX} betragen")
    return value


def money(value: Decimal) -> Decimal:
    """Auf 2 Nachkommastellen normalisieren (Anzeige/Rechnung)."""
    return value.quantize(CENT)


def clean_text(value: str) -> str:
    """NUL-Bytes entfernen - Postgres akzeptiert sie in text/varchar nicht."""
    return value.replace("\x00", "")
