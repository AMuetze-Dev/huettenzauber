from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.clock import business_day
from core.db import commit
from core.exceptions import ConflictError, NotFoundError, ValidationError
from core.money import check_money, money
from models import (
    Bill,
    BillItem,
    DayClose,
    DepositReturn,
    Event,
    ItemVariant,
    StockItem,
)
from order import service as order_service
from schemas import (
    BillListItem,
    CashCountOut,
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

    # Gemischtes Leergut: je Pfandbetrag eine Zeile (3× 2,00 € + 2× 1,50 €).
    returns = [
        (entry.unit_amount, entry.quantity)
        for entry in order.deposit_returns
        if entry.quantity > 0 and entry.unit_amount > 0
    ]
    deposit_return_total = sum((u * q for u, q in returns), ZERO)
    day = business_day()

    bill = Bill(
        event_id=event_id,
        business_day=day,
        total_gross=total_gross,
        total_deposit=total_deposit,
        deposit_return_total=deposit_return_total,
        items=bill_items,
    )
    db.add(bill)
    db.flush()

    # Pfandrueckgaben des Vorgangs mitschreiben, damit der Kassenschnitt
    # alle Rueckgaben an einer Stelle sieht.
    for unit, qty in returns:
        db.add(
            DepositReturn(
                event_id=event_id,
                bill_id=bill.id,
                business_day=day,
                unit_amount=unit,
                quantity=qty,
                total_amount=unit * qty,
            )
        )

    for line in list(order.lines):
        db.delete(line)
    for entry in list(order.deposit_returns):
        db.delete(entry)
    order_service.touch(db, event_id)

    commit(db)
    db.refresh(bill)
    order_service.broadcast(db, event_id)  # Kundendisplay: Bestellung ist jetzt leer
    return bill


# --- Eigenstaendige Pfandrueckgabe ------------------------------
def create_standalone_deposit_return(
    db: Session, event_id: int, unit_amount: Decimal, quantity: int
) -> DepositReturn:
    check_money(unit_amount, field="Pfandbetrag")
    if unit_amount <= 0:
        raise ValidationError("Pfandbetrag muss > 0 sein")
    if quantity <= 0:
        raise ValidationError("Anzahl muss > 0 sein")
    if quantity > 100000:
        raise ValidationError("Anzahl ist unrealistisch hoch")

    entry = DepositReturn(
        event_id=event_id,
        bill_id=None,
        business_day=business_day(),
        unit_amount=unit_amount,
        quantity=quantity,
        total_amount=unit_amount * quantity,
    )
    db.add(entry)
    commit(db)
    db.refresh(entry)
    return entry


def list_deposit_returns(
    db: Session, event_id: int, day: date | None = None, *, standalone_only: bool = False
) -> list[DepositReturn]:
    day = day or business_day()
    stmt = select(DepositReturn).where(
        DepositReturn.event_id == event_id, DepositReturn.business_day == day
    )
    if standalone_only:
        stmt = stmt.where(DepositReturn.bill_id.is_(None))
    return list(db.scalars(stmt.order_by(DepositReturn.created_at.desc())))


def delete_deposit_return(db: Session, entry_id: int) -> None:
    entry = db.get(DepositReturn, entry_id)
    if entry is None:
        raise NotFoundError("Pfandrückgabe nicht gefunden")
    if entry.bill_id is not None:
        raise ConflictError(
            "Pfandrückgabe gehört zu einem Bon - dort stornieren"
        )
    db.delete(entry)
    commit(db)


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


def cash_count(db: Session, event_id: int, day: date | None = None) -> CashCountOut:
    """Kassenschnitt: was muss in der Lade sein, was ist drin."""
    day = day or business_day()
    event = db.get(Event, event_id)
    if event is None:
        raise NotFoundError("Veranstaltung nicht gefunden")

    summary = day_summary(db, event_id, day)
    returns = list_deposit_returns(db, event_id, day)
    in_bills = sum((r.total_amount for r in returns if r.bill_id is not None), ZERO)
    standalone = sum((r.total_amount for r in returns if r.bill_id is None), ZERO)

    # Bareinnahmen = Bon-Summen (Pfandrueckgabe im Bon ist dort schon abgezogen)
    # minus eigenstaendige Rueckgaben (Geld raus ohne Bon).
    cash_income = summary.net_total - standalone
    marker = db.get(DayClose, (event_id, day))

    return CashCountOut(
        event_id=event_id,
        event_name=event.name,
        business_day=day,
        bill_count=summary.bill_count,
        total_gross=money(summary.total_gross),
        total_deposit=money(summary.total_deposit),
        deposit_return_in_bills=money(in_bills),
        standalone_deposit_return=money(standalone),
        cash_income=money(cash_income),
        closed=marker is not None,
        closed_at=marker.closed_at if marker else None,
    )


def close_day(db: Session, event_id: int, day: date | None = None) -> DayClose:
    """Betriebstag als abgerechnet vermerken und sichern.

    Ohne gezaehlten Bestand: siehe D41 in ARCHITEKTUR.md.
    """
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
    _backup_after_close(event_id, day)
    return marker


def _backup_after_close(event_id: int, day: date) -> None:
    """pg_dump in settings.backup_dir. Fehler werden nur geloggt - ein
    fehlgeschlagenes Backup darf den Tagesabschluss nicht kippen."""
    from core.backup import dump_database

    dump_database(reason=f"day-close-e{event_id}-{day.isoformat()}")


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
