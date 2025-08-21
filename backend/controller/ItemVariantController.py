from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional
from database import get_db
import service.ItemVariantService as ItemVariantService

class ItemVariantDTO(BaseModel):
    id: int
    stock_item_id: int
    name: Optional[str]
    price: float
    bill_steps: float
    is_active: bool
    version: int
    model_config = {"from_attributes": True}

class ItemVariantCreateDTO(BaseModel):
    stock_item_id: int
    name: Optional[str] = None
    price: float
    bill_steps: float = 1.0

class ItemVariantUpdateDTO(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    bill_steps: Optional[float] = None

router = APIRouter(prefix="/item-variants", tags=["Item Variants"])

@router.get("/stock-item/{stock_item_id}", response_model=List[ItemVariantDTO])
def get_all_in_stock_item(stock_item_id: int, db: Session = Depends(get_db)):
    return ItemVariantService.get_all_in_stock_item(db, stock_item_id)

@router.get("/{variant_id}", response_model=ItemVariantDTO)
def get_by_id(variant_id: int, db: Session = Depends(get_db)):
    return ItemVariantService.get_by_id(db, variant_id)

@router.post("/", response_model=ItemVariantDTO, status_code=status.HTTP_201_CREATED)
def create(variant: ItemVariantCreateDTO, db: Session = Depends(get_db)):
    return ItemVariantService.create(
        db,
        stock_item_id=variant.stock_item_id,
        name=variant.name,
        price=variant.price,
        bill_steps=variant.bill_steps
    )

@router.put("/{variant_id}", response_model=ItemVariantDTO)
def update(variant_id: int, variant: ItemVariantUpdateDTO, db: Session = Depends(get_db)):
    return ItemVariantService.update(
        db,
        variant_id=variant_id,
        name=variant.name,
        price=variant.price,
        bill_steps=variant.bill_steps
    )

@router.delete("/{variant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(variant_id: int, db: Session = Depends(get_db)):
    ItemVariantService.delete(db, variant_id)