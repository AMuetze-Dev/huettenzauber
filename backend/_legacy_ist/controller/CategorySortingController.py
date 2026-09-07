from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from database import get_db
from pydantic import BaseModel, Field
from typing import List
import service.CategorySortingService as CategorySortingService

class CategorySortingDTO(BaseModel):
    category_id: int
    sort_order: int
    model_config = {"from_attributes": True}

class BulkSortingDTO(BaseModel):
    ordered_category_ids: List[int]

router = APIRouter(prefix="/category-sorting", tags=["category-sorting"])

@router.get("/", response_model=List[CategorySortingDTO])
def get_all_sortings(db: Session = Depends(get_db)):
    return CategorySortingService.get_all_sortings(db)

@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_category_from_sorting(category_id: int, db: Session = Depends(get_db)):
    CategorySortingService.remove_category_from_sorting(db, category_id)
    return None

@router.put("/move/{category_id}", response_model=CategorySortingDTO)
def move_category(category_id: int, sort_order: int, db: Session = Depends(get_db)):
    return CategorySortingService.move_category(db, category_id, sort_order)

@router.put("/bulk", status_code=status.HTTP_204_NO_CONTENT)
def bulk_update_sorting(dto: BulkSortingDTO, db: Session = Depends(get_db)):
    CategorySortingService.bulk_update_sorting(db, dto.ordered_category_ids)