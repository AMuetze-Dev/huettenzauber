from datetime import date

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from database import get_db
from event.service import require_active_event
from schemas import (
    BillListItem,
    BillOut,
    CashCountOut,
    CashFloatIn,
    CashMovementIn,
    CashMovementOut,
    DayCloseIn,
    DayCloseOut,
    DaySummaryOut,
    DepositReturnIn2,
    DepositReturnOut,
    StatisticsOut,
)

from . import service

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


@router.put("/cash-float", response_model=CashCountOut)
def set_cash_float(
    payload: CashFloatIn, day: date | None = None, db: Session = Depends(get_db)
):
    event = require_active_event(db)
    service.set_cash_float(db, event.id, payload.amount, day)
    return service.cash_count(db, event.id, day)


@router.get("/cash-movements", response_model=list[CashMovementOut])
def list_cash_movements(day: date | None = None, db: Session = Depends(get_db)):
    event = require_active_event(db)
    return service.list_cash_movements(db, event.id, day)


@router.post(
    "/cash-movements",
    response_model=CashMovementOut,
    status_code=status.HTTP_201_CREATED,
)
def add_cash_movement(
    payload: CashMovementIn, day: date | None = None, db: Session = Depends(get_db)
):
    event = require_active_event(db)
    return service.add_cash_movement(
        db, event.id, payload.amount, payload.reason, day
    )


@router.delete("/cash-movements/{movement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cash_movement(movement_id: int, db: Session = Depends(get_db)):
    service.delete_cash_movement(db, movement_id)


@router.post("/day-close", response_model=DayCloseOut)
def close_day(
    payload: DayCloseIn | None = None,
    day: date | None = None,
    db: Session = Depends(get_db),
):
    event = require_active_event(db)
    counted = payload.counted_cash if payload else None
    return service.close_day(db, event.id, day, counted)


@router.get("/day-close", response_model=DayCloseOut)
def get_day_close(day: date | None = None, db: Session = Depends(get_db)):
    event = require_active_event(db)
    return service.get_day_close(db, event.id, day)


# --- Statistik -------------------------------------------------
@router.get("/statistics", response_model=StatisticsOut)
def statistics(day: date | None = None, db: Session = Depends(get_db)):
    event = require_active_event(db)
    return service.statistics(db, event.id, day)
