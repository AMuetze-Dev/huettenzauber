from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from database import get_db
from pydantic import BaseModel
from typing import List
import service.DepositReturnService as DepositReturnService
from datetime import date

class DepositReturnDTO(BaseModel):
    id: int
    stock_item_id: int
    quantity: int
    deposit_amount_per_item: float
    total_amount: float
    created_at: date
    model_config = {"from_attributes": True}

class DepositReturnCreateDTO(BaseModel):
    stock_item_id: int
    quantity: int

router = APIRouter(prefix="/deposit-returns", tags=["Deposit Returns"])

@router.get("/", response_model=List[DepositReturnDTO])
def get_all_deposit_returns(db: Session = Depends(get_db)):
    return DepositReturnService.get_all(db)

@router.get("/{deposit_return_id}", response_model=DepositReturnDTO)
def get_deposit_return_by_id(deposit_return_id: int, db: Session = Depends(get_db)):
    return DepositReturnService.get_by_id(db, deposit_return_id)

@router.post("/", status_code=status.HTTP_201_CREATED, response_model=DepositReturnDTO)
def create_deposit_return(deposit_return: DepositReturnCreateDTO, db: Session = Depends(get_db)):
    return DepositReturnService.create(db, deposit_return.stock_item_id, deposit_return.quantity)

@router.delete("/{deposit_return_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deposit_return(deposit_return_id: int, db: Session = Depends(get_db)):
    DepositReturnService.delete(db, deposit_return_id)
