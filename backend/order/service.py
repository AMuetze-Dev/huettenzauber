from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.db import commit
from core.exceptions import NotFoundError, ValidationError
from models import ActiveOrder, ActiveOrderLine, ItemVariant, StockItem
from order import events
from schemas import ActiveLineOut, ActiveOrderOut

ZERO = Decimal("0")
_CENT = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return value.quantize(_CENT)


def _totals(db: Session, order: ActiveOrder) -> ActiveOrderOut:
    total_gross = ZERO
    total_deposit = ZERO
    lines_out: list[ActiveLineOut] = []
    for line in sorted(order.lines, key=lambda x: x.id):
        variant = db.get(ItemVariant, line.item_variant_id)
        item = db.get(StockItem, variant.stock_item_id)
        total_gross += variant.price * line.quantity
        total_deposit += item.deposit_amount * line.quantity
        lines_out.append(
            ActiveLineOut(item_variant_id=line.item_variant_id, quantity=line.quantity)
        )

    unit = order.deposit_return_unit_amount or ZERO
    qty = order.deposit_return_quantity or 0
    deposit_return_total = unit * qty
    total_due = max(ZERO, total_gross + total_deposit - deposit_return_total)

    return ActiveOrderOut(
        event_id=order.event_id,
        updated_at=order.updated_at,
        lines=lines_out,
        deposit_return_unit_amount=order.deposit_return_unit_amount,
        deposit_return_quantity=order.deposit_return_quantity,
        total_gross=money(total_gross),
        total_deposit=money(total_deposit),
        deposit_return_total=money(deposit_return_total),
        total_due=money(total_due),
    )


def get_order(db: Session, event_id: int) -> ActiveOrder:
    return db.get(ActiveOrder, event_id)


def view(db: Session, event_id: int) -> ActiveOrderOut:
    return _totals(db, get_order(db, event_id))


def broadcast(db: Session, event_id: int) -> ActiveOrderOut:
    """Aktuellen Stand an alle SSE-Abonnenten schicken und zurueckgeben."""
    out = view(db, event_id)
    events.publish(out.model_dump(mode="json"))
    return out


def apply_delta(
    db: Session, event_id: int, variant_id: int, delta: Decimal
) -> ActiveOrderOut:
    if db.get(ItemVariant, variant_id) is None:
        raise NotFoundError("Variante nicht gefunden")

    if delta != 0:
        line = db.scalars(
            select(ActiveOrderLine).where(
                ActiveOrderLine.event_id == event_id,
                ActiveOrderLine.item_variant_id == variant_id,
            )
        ).first()

        if line is None:
            if delta > 0:
                db.add(
                    ActiveOrderLine(
                        event_id=event_id, item_variant_id=variant_id, quantity=delta
                    )
                )
        else:
            line.quantity += delta
            if line.quantity <= 0:
                db.delete(line)
        commit(db)
        db.refresh(get_order(db, event_id))

    return broadcast(db, event_id)


def set_deposit_return(
    db: Session, event_id: int, unit_amount: Decimal, quantity: int
) -> ActiveOrderOut:
    if unit_amount < 0:
        raise ValidationError("Pfandrückgabe-Betrag muss >= 0 sein")
    if quantity < 0:
        raise ValidationError("Pfandrückgabe-Anzahl muss >= 0 sein")

    order = get_order(db, event_id)
    if unit_amount == 0 or quantity == 0:
        order.deposit_return_unit_amount = None
        order.deposit_return_quantity = None
    else:
        order.deposit_return_unit_amount = unit_amount
        order.deposit_return_quantity = quantity
    commit(db)
    db.refresh(order)
    return broadcast(db, event_id)
