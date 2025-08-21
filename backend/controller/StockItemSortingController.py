from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from pydantic import BaseModel, Field
import service.StockItemSortingService as StockItemSortingService

class ItemSortingDTO(BaseModel):
    item_id: int
    sort_order: int

class BulkSortingUpdateDTO(BaseModel):
    ordered_item_ids: List[int] = Field(..., description="Liste der Item-IDs in gewünschter Reihenfolge")

router = APIRouter(prefix="/item-sorting", tags=["Item Sorting"])

@router.get("/", response_model=List[ItemSortingDTO])
def get_all_sortings(db: Session = Depends(get_db)):
    sortings = StockItemSortingService.get_all_sortings(db)
    return [ItemSortingDTO(item_id=s.item_id, sort_order=s.sort_order) for s in sortings]

@router.put("/", status_code=status.HTTP_204_NO_CONTENT)
def bulk_update_sorting(payload: BulkSortingUpdateDTO, db: Session = Depends(get_db)):
    StockItemSortingService.bulk_update_sorting(db, payload.ordered_item_ids)
    return None