from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from service import BillService
from pydantic import BaseModel
from typing import List
from datetime import date, datetime

router = APIRouter(prefix="/bills", tags=["bills"])

class BillItemDTO(BaseModel):
    item_variant_id: int
    item_quantity: float = 1

class BillDTO(BaseModel):
    id: int = None
    date: date
    items: List[BillItemDTO]
    is_deleted: bool = False

class BillCreateDTO(BaseModel):
    items: List[BillItemDTO]

@router.get("/", response_model=List[BillDTO])
def list_bills(db: Session = Depends(get_db)):
    return BillService.get_all(db)

@router.get("/all", response_model=List[BillDTO])
def get_all_bills_with_deleted(db: Session = Depends(get_db)):
    return BillService.get_all_with_deleted(db)

@router.get("/{bill_id}", response_model=BillDTO)
def get_bill(bill_id: int, db: Session = Depends(get_db)):
    return BillService.get_by_id(db, bill_id)

@router.post("/", status_code=201, response_model=BillDTO)
def create_bill(payload: BillCreateDTO, db: Session = Depends(get_db)):
    bill = BillService.create(db, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), [item.model_dump() for item in payload.items])
    return {"id": bill.id, "date": bill.date, "items": bill.items, "is_deleted": bill.is_deleted}

@router.delete("/{bill_id}", status_code=204)
def delete_bill(bill_id: int, db: Session = Depends(get_db)):
    BillService.delete(db, bill_id)