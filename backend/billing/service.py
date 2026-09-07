from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.clock import business_day
from core.db import commit
from core.exceptions import ConflictError, NotFoundError, ValidationError
from models import Bill, BillItem, DayClose, Event, ItemVariant, StockItem
from order import service as order_service
from schemas import (
    BillListItem,
    ConsumptionRow,
    DayBreakdown,
    DaySummaryOut,
    StatisticsOut,
)

ZERO = Decimal("0")


def _get_bill(db: Session, bill_id: int) -> Bill:
    bill = db.get(Bill, bill_id)
    if bill is None:
        raise NotFoundError("Bon nicht gefunden")
    return bill


# --- Bon anlegen ------------------------------------------------------
def create_bill_from_active_order(db: Session, event_id: int) -> Bill:
    order = order_service.get_order(db, event_id)
    if not order.lines:
        raise ValidationError("Keine Positionen in der aktiven Bestellung")

    total_gross = ZERO
    total_deposit = ZERO
    bill_items: list[BillItem] = []
    for line in sorted(order.lines, key=lambda x: x.id):
        variant = db.get(ItemVariant, line.item_variant_id)
        item = db.get(StockItem, variant.stock_item_id)
        total_gross += variant.price * line.quantity
        total_deposit += item.deposit_amount * line.quantity
        bill_items.append(
            BillItem(
                item_variant_id=variant.id,
                item_name=item.name,
                variant_name=variant.name,
                unit_price=variant.price,
                deposit_per_unit=item.deposit_amount,
                quantity=line.quantity,
            )
        )

    unit = order.deposit_return_unit_amount or ZERO
    qty = order.deposit_return_quantity or 0

    bill = Bill(
        event_id=event_id,
        business_day=business_day(),
        total_gross=total_gross,
        total_deposit=total_deposit,
        deposit_return_total=unit * qty,
        items=bill_items,
    )
    db.add(bill)

    for line in list(order.lines):
        db.delete(line)
    order.deposit_return_unit_amount = None
    order.deposit_return_quantity = None

    commit(db)
    db.refresh(bill)
    order_service.broadcast(db, event_id)  # Kundendisplay: Bestellung ist jetzt leer
    return bill


# --- Bon-Liste / Detail --------------------------------------------
def list_bills(
    db: Session,
    event_id: int,
    *,
    day: date | None = None,
    include_deleted: bool = False,
) -> list[BillListItem]:
    day = day or business_day()
    stmt = select(Bill).where(Bill.event_id == event_id, Bill.business_day == day)
    if not include_deleted:
        stmt = stmt.where(Bill.is_deleted.is_(False))
    bills = db.scalars(stmt.order_by(Bill.created_at.desc(), Bill.id.desc())).all()
    return [
        BillListItem(
            id=b.id,
            created_at=b.created_at,
            business_day=b.business_day,
            is_deleted=b.is_deleted,
            total_gross=b.total_gross,
            total_deposit=b.total_deposit,
            deposit_return_total=b.deposit_return_total,
            position_count=len(b.items),
        )
        for b in bills
    ]


def get_bill(db: Session, bill_id: int) -> Bill:
    return _get_bill(db, bill_id)


# --- Storno (weich, umkehrbar) ----------------------------------
def void_bill(db: Session, bill_id: int) -> Bill:
    bill = _get_bill(db, bill_id)
    if bill.is_deleted:
        raise ConflictError("Bon ist bereits storniert")
    bill.is_deleted = True
    commit(db)
    db.refresh(bill)
    return bill


def restore_bill(db: Session, bill_id: int) -> Bill:
    bill = _get_bill(db, bill_id)
    if not bill.is_deleted:
        raise ConflictError("Bon ist nicht storniert")
    bill.is_deleted = False
    commit(db)
    db.refresh(bill)
    return bill


# --- Tagesabschluss (weich) --------------------------------------
def day_summary(db: Session, event_id: int, day: date | None = None) -> DaySummaryOut:
    day = day or business_day()
    rows = db.scalars(
        select(Bill).where(
            Bill.event_id == event_id,
            Bill.business_day == day,
            Bill.is_deleted.is_(False),
        )
    ).all()
    total_gross = sum((b.total_gross for b in rows), ZERO)
    total_deposit = sum((b.total_deposit for b in rows), ZERO)
    deposit_return_total = sum((b.deposit_return_total for b in rows), ZERO)
    marker = db.get(DayClose, (event_id, day))
    return DaySummaryOut(
        event_id=event_id,
        business_day=day,
        bill_count=len(rows),
        total_gross=total_gross,
        total_deposit=total_deposit,
        deposit_return_total=deposit_return_total,
        net_total=total_gross + total_deposit - deposit_return_total,
        closed=marker is not None,
    )


def close_day(db: Session, event_id: int, day: date | None = None) -> DayClose:
    day = day or business_day()
    summary = day_summary(db, event_id, day)
    marker = db.get(DayClose, (event_id, day))
    if marker is None:
        marker = DayClose(event_id=event_id, business_day=day)
        db.add(marker)
    marker.total_gross = summary.total_gross
    marker.total_deposit = summary.total_deposit
    commit(db)
    db.refresh(marker)
    return marker


def get_day_close(db: Session, event_id: int, day: date | None = None) -> DayClose:
    day = day or business_day()
    marker = db.get(DayClose, (event_id, day))
    if marker is None:
        raise NotFoundError("Kein Tagesabschluss für diesen Tag")
    return marker


# --- Statistik --------------------------------------------------------
def statistics(db: Session, event_id: int, day: date | None = None) -> StatisticsOut:
    event = db.get(Event, event_id)
    if event is None:
        raise NotFoundError("Veranstaltung nicht gefunden")

    bill_filter = [Bill.event_id == event_id, Bill.is_deleted.is_(False)]
    if day is not None:
        bill_filter.append(Bill.business_day == day)

    bills = db.scalars(select(Bill).where(*bill_filter)).all()
    bill_ids = [b.id for b in bills]

    total_gross = sum((b.total_gross for b in bills), ZERO)
    total_deposit = sum((b.total_deposit for b in bills), ZERO)
    deposit_return_total = sum((b.deposit_return_total for b in bills), ZERO)

    consumption: list[ConsumptionRow] = []
    if bill_ids:
        agg: dict[tuple[str, str | None], list[Decimal]] = {}
        items = db.scalars(
            select(BillItem).where(BillItem.bill_id.in_(bill_ids))
        ).all()
        for it in items:
            key = (it.item_name, it.variant_name)
            slot = agg.setdefault(key, [ZERO, ZERO])
            slot[0] += it.quantity
            slot[1] += it.unit_price * it.quantity
        consumption = [
            ConsumptionRow(
                item_name=k[0],
                variant_name=k[1],
                quantity=q,
                revenue=r.quantize(Decimal("0.01")),
            )
            for k, (q, r) in agg.items()
        ]
        consumption.sort(key=lambda c: (c.quantity, c.revenue), reverse=True)

    day_agg: dict[date, list] = {}
    for b in bills:
        slot = day_agg.setdefault(b.business_day, [0, ZERO, ZERO, ZERO])
        slot[0] += 1
        slot[1] += b.total_gross
        slot[2] += b.total_deposit
        slot[3] += b.deposit_return_total
    days = [
        DayBreakdown(
            business_day=d,
            bill_count=c,
            total_gross=g,
            total_deposit=dep,
            deposit_return_total=ret,
            net_total=g + dep - ret,
        )
        for d, (c, g, dep, ret) in sorted(day_agg.items())
    ]

    return StatisticsOut(
        event_id=event_id,
        event_name=event.name,
        scope=day.isoformat() if day else "event",
        bill_count=len(bills),
        total_gross=total_gross,
        total_deposit=total_deposit,
        deposit_return_total=deposit_return_total,
        net_total=total_gross + total_deposit - deposit_return_total,
        consumption=consumption,
        days=days,
    )
