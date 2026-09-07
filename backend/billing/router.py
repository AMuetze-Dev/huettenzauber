from datetime import date

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from database import get_db
from event.service import require_active_event
from schemas import (
    BillListItem,
    BillOut,
    DayCloseOut,
    DaySummaryOut,
    StatisticsOut,
)

from . import service

router = APIRouter(prefix="/api", tags=["billing"])


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
    return service.list_bills(
        db, event.id, day=day, include_deleted=include_deleted
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


@router.get("/day-summary", response_model=DaySummaryOut)
def day_summary(day: date | None = None, db: Session = Depends(get_db)):
    event = require_active_event(db)
    return service.day_summary(db, event.id, day)


@router.post("/day-close", response_model=DayCloseOut)
def close_day(day: date | None = None, db: Session = Depends(get_db)):
    event = require_active_event(db)
    return service.close_day(db, event.id, day)


@router.get("/day-close", response_model=DayCloseOut)
def get_day_close(day: date | None = None, db: Session = Depends(get_db)):
    event = require_active_event(db)
    return service.get_day_close(db, event.id, day)


@router.get("/statistics", response_model=StatisticsOut)
def statistics(day: date | None = None, db: Session = Depends(get_db)):
    event = require_active_event(db)
    return service.statistics(db, event.id, day)
