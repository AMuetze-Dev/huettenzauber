from __future__ import annotations

from decimal import Decimal

from sqlalchemy import delete, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from core.db import commit
from core.exceptions import ConflictError, NotFoundError, ValidationError
from core.money import check_money, check_qty
from models import (
    ActiveDepositReturn,
    ActiveOrder,
    ActiveOrderLine,
    Event,
    ItemVariant,
    StockItem,
)
from order import events
from schemas import ActiveLineOut, ActiveOrderOut, DepositReturnLineOut

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

    deposit_return_total = ZERO
    returns_out: list[DepositReturnLineOut] = []
    for entry in sorted(order.deposit_returns, key=lambda x: x.unit_amount):
        line_total = entry.unit_amount * entry.quantity
        deposit_return_total += line_total
        returns_out.append(
            DepositReturnLineOut(
                unit_amount=entry.unit_amount,
                quantity=entry.quantity,
                total_amount=money(line_total),
            )
        )
    total_due = max(ZERO, total_gross + total_deposit - deposit_return_total)

    return ActiveOrderOut(
        event_id=order.event_id,
        updated_at=order.updated_at,
        revision=order.revision,
        lines=lines_out,
        deposit_returns=returns_out,
        total_gross=money(total_gross),
        total_deposit=money(total_deposit),
        deposit_return_total=money(deposit_return_total),
        total_due=money(total_due),
    )


def get_order(db: Session, event_id: int) -> ActiveOrder:
    return db.get(ActiveOrder, event_id)


def touch(db: Session, event_id: int) -> None:
    """Revision hochzaehlen - im SQL, damit parallele Aenderungen sie nicht
    ueberschreiben. Muss vor dem `commit` der jeweiligen Aenderung laufen."""
    db.execute(
        update(ActiveOrder)
        .where(ActiveOrder.event_id == event_id)
        .values(revision=ActiveOrder.revision + 1)
    )


def view(db: Session, event_id: int) -> ActiveOrderOut:
    return _totals(db, get_order(db, event_id))


def broadcast(db: Session, event_id: int) -> ActiveOrderOut:
    """Aktuellen Stand an alle SSE-Abonnenten schicken und zurueckgeben."""
    out = view(db, event_id)
    events.publish(out.model_dump(mode="json"))
    return out


def _orderable_variant(db: Session, event_id: int, variant_id: int) -> ItemVariant:
    """Variante muss existieren, aktiv sein und zum Katalog der aktiven
    Veranstaltung gehoeren."""
    variant = db.get(ItemVariant, variant_id)
    if variant is None:
        raise NotFoundError("Variante nicht gefunden")
    if not variant.is_active:
        raise ConflictError("Variante ist nicht mehr aktiv")

    item = db.get(StockItem, variant.stock_item_id)
    if item is None or not item.is_active:
        raise ConflictError("Artikel ist nicht mehr aktiv")

    event = db.get(Event, event_id)
    if event is not None and item.catalog_id != event.catalog_id:
        raise ConflictError("Artikel gehört nicht zum Katalog dieser Veranstaltung")
    return variant


def apply_delta(
    db: Session, event_id: int, variant_id: int, delta: Decimal
) -> ActiveOrderOut:
    check_qty(delta, field="Menge")
    _orderable_variant(db, event_id, variant_id)

    if delta != 0:
        # Eine einzige atomare Anweisung statt Read-Modify-Write: paralleles
        # Tippen (10" + Handy) verliert so weder ein Delta noch laeuft es in
        # eine Unique-Verletzung, wenn beide Seiten die Zeile zugleich anlegen.
        stmt = (
            insert(ActiveOrderLine)
            .values(event_id=event_id, item_variant_id=variant_id, quantity=delta)
            .on_conflict_do_update(
                constraint="uq_active_line_variant",
                set_={"quantity": ActiveOrderLine.quantity + delta},
            )
            .returning(ActiveOrderLine.id, ActiveOrderLine.quantity)
        )
        row = db.execute(stmt).first()

        # Ein Minus-Delta darf keine neue Zeile erfinden und keine ins Negative
        # ziehen - beides raeumen wir sofort wieder ab.
        if row is not None and row.quantity <= 0:
            db.execute(delete(ActiveOrderLine).where(ActiveOrderLine.id == row.id))

        touch(db, event_id)
        commit(db)
        order = get_order(db, event_id)
        if order is not None:
            db.refresh(order)

    return broadcast(db, event_id)


def clear_order(db: Session, event_id: int) -> ActiveOrderOut:
    """Warenkorb verwerfen, ohne einen Bon zu schreiben - der "Leeren"-Knopf
    am Bedienterminal. Muss den Server erreichen, sonst zeigt das
    Kundendisplay weiter die alte Bestellung."""
    order = get_order(db, event_id)
    db.execute(delete(ActiveOrderLine).where(ActiveOrderLine.event_id == event_id))
    db.execute(
        delete(ActiveDepositReturn).where(ActiveDepositReturn.event_id == event_id)
    )
    touch(db, event_id)
    commit(db)
    db.refresh(order)
    return broadcast(db, event_id)


def set_deposit_return(
    db: Session, event_id: int, unit_amount: Decimal, quantity: int
) -> ActiveOrderOut:
    """Setzt die Stueckzahl fuer GENAU EINEN Pfandbetrag. Andere Betraege im
    selben Vorgang bleiben stehen - der Gast bringt gemischtes Leergut."""
    check_money(unit_amount, field="Pfandrückgabe-Betrag")
    if quantity < 0:
        raise ValidationError("Pfandrückgabe-Anzahl muss >= 0 sein")
    if quantity > 100000:
        raise ValidationError("Pfandrückgabe-Anzahl ist unrealistisch hoch")

    unit_amount = money(unit_amount)
    if unit_amount <= 0 or quantity == 0:
        db.execute(
            delete(ActiveDepositReturn).where(
                ActiveDepositReturn.event_id == event_id,
                ActiveDepositReturn.unit_amount == unit_amount,
            )
        )
    else:
        db.execute(
            insert(ActiveDepositReturn)
            .values(event_id=event_id, unit_amount=unit_amount, quantity=quantity)
            .on_conflict_do_update(
                constraint="uq_active_deposit_unit", set_={"quantity": quantity}
            )
        )
    touch(db, event_id)
    commit(db)
    order = get_order(db, event_id)
    db.refresh(order)
    return broadcast(db, event_id)


def clear_deposit_returns(db: Session, event_id: int) -> ActiveOrderOut:
    """Alle Pfandrueckgaben des Vorgangs verwerfen."""
    db.execute(
        delete(ActiveDepositReturn).where(ActiveDepositReturn.event_id == event_id)
    )
    touch(db, event_id)
    commit(db)
    order = get_order(db, event_id)
    db.refresh(order)
    return broadcast(db, event_id)
