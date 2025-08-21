from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from database import get_db
from pydantic import BaseModel, Field
from typing import List
import service.CategoryService as CategoryService

class CategoryDTO(BaseModel):
    id: int
    name: str
    icon: str
    model_config = {"from_attributes": True}

class CategoryCreateDTO(BaseModel):
    name: str
    icon: str

class CategoryUpdateDTO(CategoryCreateDTO):
    pass

router = APIRouter(prefix="/categories", tags=["categories"])

@router.get("/", response_model=List[CategoryDTO])
def get_all_categories(db: Session = Depends(get_db)):
    return CategoryService.get_all(db)

@router.get("/{category_id}", response_model=CategoryDTO)
def get_category_by_id(category_id: int, db: Session = Depends(get_db)):
    return CategoryService.get_by_id(db, category_id)

@router.post("/", status_code=status.HTTP_201_CREATED, response_model=CategoryDTO)
def create_category(cc: CategoryCreateDTO, db: Session = Depends(get_db)):
    return CategoryService.create(db, cc.name, cc.icon)

@router.put("/{category_id}", response_model=CategoryDTO)
def update_category(category_id: int, cu: CategoryUpdateDTO, db: Session = Depends(get_db)):
    return CategoryService.update(db, category_id, cu.name, cu.icon)

@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    CategoryService.delete(db, category_id)