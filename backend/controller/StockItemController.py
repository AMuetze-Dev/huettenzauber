from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from database import get_db
from pydantic import BaseModel, Field, model_validator
from typing import List
import service.StockItemService as StockItemService
import service.ItemVariantService as ItemVariantService

class ItemVariantDTO(BaseModel):
    id: int
    name: str = None
    price: float
    bill_steps: float
    model_config = {"from_attributes": True}

class ItemVariantCreateDTO(BaseModel):
    name: str = None
    price: float
    bill_steps: float = 1.0

class ItemVariantUpdateDTO(BaseModel):
    id: int = None
    name: str = None
    price: float
    bill_steps: float

class StockItemDTO(BaseModel):
    id: int
    name: str
    category_id: int
    deposit_amount: float = 0.0
    is_active: bool = Field(default=True)
    item_variants: List[ItemVariantDTO]
    model_config = {"from_attributes": True}

class StockItemCreateDTO(BaseModel):
    name: str
    category_id: int
    deposit_amount: float = 0.0
    item_variants: List[ItemVariantCreateDTO]

class StockItemUpdateDTO(BaseModel):
    name: str
    category_id: int
    deposit_amount: float = 0.0
    item_variants: List[ItemVariantUpdateDTO] = []

class StockItemBulkUpdateDTO(StockItemUpdateDTO):
    id: int

router = APIRouter(prefix="/stock-items", tags=["Stock Items"])

@router.get("/", response_model=List[StockItemDTO])
def get_all(db: Session = Depends(get_db)):
    items = StockItemService.get_all(db)
    for item in items:
        variants = ItemVariantService.get_all_in_stock_item(db, item.id)
        item.item_variants = variants
    return items

@router.get("/{item_id}", response_model=StockItemDTO)
def get_by_id(item_id: int, db: Session = Depends(get_db)):
    item = StockItemService.get_by_id(db, item_id)
    variants = ItemVariantService.get_all_in_stock_item(db, item_id)
    item.item_variants = variants
    return item

@router.post("/", response_model=StockItemDTO, status_code=status.HTTP_201_CREATED)
def create(item: StockItemCreateDTO, db: Session = Depends(get_db)):
    stock_item = StockItemService.create(db, item.name, item.category_id, item.deposit_amount)
    variants = []
    for variant in item.item_variants:
        variants.append(ItemVariantService.create(
            db,
            stock_item_id=stock_item.id,
            name=variant.name,
            price=variant.price,
            bill_steps=variant.bill_steps
        ))
    stock_item.item_variants = variants
    return stock_item

@router.put("/bulk", response_model=List[StockItemDTO])
def bulk_update(items: List[StockItemBulkUpdateDTO], db: Session = Depends(get_db)):
    return StockItemService.bulk_update(db, [item.model_dump() for item in items])

@router.put("/{item_id}", response_model=StockItemDTO)
def update(item_id: int, item: StockItemUpdateDTO, db: Session = Depends(get_db)):
    new_stock_item = StockItemService.update(db, item_id, item.name, item.category_id, item.deposit_amount)
    new_variants = []
    for variant in item.item_variants:
        # Check if this is an existing variant (positive ID) or a new one (negative or None)
        if variant.id and variant.id > 0:
            new_variant = ItemVariantService.update(
                db,
                variant_id=variant.id,
                name=variant.name,
                price=variant.price,
                bill_steps=variant.bill_steps,
                stock_item_id=new_stock_item.id
            )
        else:
            # This is a new variant (id is -1, None, or <= 0)
            new_variant = ItemVariantService.create(
                db,
                stock_item_id=new_stock_item.id,
                name=variant.name,
                price=variant.price,
                bill_steps=variant.bill_steps
            )
        new_variants.append(new_variant)
    new_stock_item.item_variants = new_variants
    return new_stock_item

@router.get("/category/{category_id}", response_model=List[StockItemDTO])
def get_all_in_category(category_id: int, db: Session = Depends(get_db)):
    items = StockItemService.get_all_in_category(db, category_id)
    for item in items: item.item_variants = ItemVariantService.get_all_in_stock_item(db, item.id)
    return items

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(item_id: int, db: Session = Depends(get_db)):
    StockItemService.delete(db, item_id)