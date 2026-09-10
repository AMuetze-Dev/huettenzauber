from datetime import date

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from database import get_db
from event.service import require_active_event
from schemas import (
    BillListItem,
    BillOut,
    CashCountOut,
    DayCloseOut,
    DaySummaryOut,
    DepositReturnIn2,
    DepositReturnOut,
    StatisticsOut,
)

from . import pdf, service

router = APIRouter(prefix="/api", tags=["billing"])


# --- Bon ---------------------------------------------------------------
@router.post("/bills", response_model=BillOut, status_code=status.HTTP_201_CREATED)
def create_bill(db: Session = Depends(get_db)):
    event = require_active_event(db)
    return service.create_bill_from_active_order(db, event.id)


@router.get("/bills", response_model=list[BillListItem])
def list_bills(
    day: date | None = None,
    include_deleted: bool = False,
    db: Session = Depends(get_db),
):
    event = require_active_event(db)
    return service.list_bills(db, event.id, day=day, include_deleted=include_deleted)


# --- Ausdruck --------------------------------------------------
@router.get(
    "/bills/export.pdf",
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
def export_bills_pdf(day: date | None = None, db: Session = Depends(get_db)):
    """Rechnungsuebersicht eines Betriebstags als PDF."""
    event = require_active_event(db)
    kasse = service.cash_count(db, event.id, day)
    bons = service.list_bills(db, event.id, day=day, include_deleted=True)
    stat = service.statistics(db, event.id, kasse.business_day)
    inhalt = pdf.build_overview(kasse=kasse, bons=bons, verbrauch=stat.consumption)
    return Response(
        content=inhalt,
        media_type="application/pdf",
        headers={
            # `inline` statt `attachment`: am Handy oeffnet sich die Vorschau,
            # gespeichert wird von dort mit einem Tipp.
            "Content-Disposition": f'inline; filename="{pdf.dateiname(kasse)}"',
        },
    )


@router.get("/bills/{bill_id}", response_model=BillOut)
def get_bill(bill_id: int, db: Session = Depends(get_db)):
    return service.get_bill(db, bill_id)


@router.post("/bills/{bill_id}/void", response_model=BillOut)
def void_bill(bill_id: int, db: Session = Depends(get_db)):
    return service.void_bill(db, bill_id)


@router.post("/bills/{bill_id}/restore", response_model=BillOut)
def restore_bill(bill_id: int, db: Session = Depends(get_db)):
    return service.restore_bill(db, bill_id)


# --- Eigenständige Pfandrückgabe --------------------------------
@router.post(
    "/deposit-returns",
    response_model=DepositReturnOut,
    status_code=status.HTTP_201_CREATED,
)
def create_deposit_return(payload: DepositReturnIn2, db: Session = Depends(get_db)):
    event = require_active_event(db)
    return service.create_standalone_deposit_return(
        db, event.id, payload.unit_amount, payload.quantity
    )


@router.get("/deposit-returns", response_model=list[DepositReturnOut])
def list_deposit_returns(
    day: date | None = None,
    standalone_only: bool = False,
    db: Session = Depends(get_db),
):
    event = require_active_event(db)
    return service.list_deposit_returns(
        db, event.id, day, standalone_only=standalone_only
    )


@router.delete(
    "/deposit-returns/{entry_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_deposit_return(entry_id: int, db: Session = Depends(get_db)):
    service.delete_deposit_return(db, entry_id)


# --- Tagesabschluss / Kassenschnitt ---------------------------
@router.get("/day-summary", response_model=DaySummaryOut)
def day_summary(day: date | None = None, db: Session = Depends(get_db)):
    event = require_active_event(db)
    return service.day_summary(db, event.id, day)


@router.get("/cash-count", response_model=CashCountOut)
def cash_count(day: date | None = None, db: Session = Depends(get_db)):
    event = require_active_event(db)
    return service.cash_count(db, event.id, day)


@router.post("/day-close", response_model=DayCloseOut)
def close_day(day: date | None = None, db: Session = Depends(get_db)):
    event = require_active_event(db)
    return service.close_day(db, event.id, day)


@router.get("/day-close", response_model=DayCloseOut)
def get_day_close(day: date | None = None, db: Session = Depends(get_db)):
    event = require_active_event(db)
    return service.get_day_close(db, event.id, day)


# --- Statistik -------------------------------------------------
@router.get("/statistics", response_model=StatisticsOut)
def statistics(day: date | None = None, db: Session = Depends(get_db)):
    event = require_active_event(db)
    return service.statistics(db, event.id, day)
