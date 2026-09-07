from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from database import get_db
from schemas import (
    CatalogCreate,
    CatalogOut,
    CatalogUpdate,
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    ReorderIn,
    StockItemCreate,
    StockItemOut,
    StockItemUpdate,
)

from . import service

router = APIRouter(prefix="/api", tags=["catalog"])


# --- Katalog ------------------------------------------------------------
@router.get("/catalogs", response_model=list[CatalogOut])
def list_catalogs(db: Session = Depends(get_db)):
    return service.list_catalogs(db)


@router.post("/catalogs", response_model=CatalogOut, status_code=status.HTTP_201_CREATED)
def create_catalog(payload: CatalogCreate, db: Session = Depends(get_db)):
    return service.create_catalog(db, payload.name)


@router.get("/catalogs/{catalog_id}", response_model=CatalogOut)
def get_catalog(catalog_id: int, db: Session = Depends(get_db)):
    return service.get_catalog(db, catalog_id)


@router.put("/catalogs/{catalog_id}", response_model=CatalogOut)
def update_catalog(catalog_id: int, payload: CatalogUpdate, db: Session = Depends(get_db)):
    return service.update_catalog(db, catalog_id, payload.name)


@router.delete("/catalogs/{catalog_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_catalog(catalog_id: int, db: Session = Depends(get_db)):
    service.delete_catalog(db, catalog_id)


# --- Kategorie -----------------------------------------------------
@router.get("/catalogs/{catalog_id}/categories", response_model=list[CategoryOut])
def list_categories(catalog_id: int, db: Session = Depends(get_db)):
    return service.list_categories(db, catalog_id)


@router.post(
    "/catalogs/{catalog_id}/categories",
    response_model=CategoryOut,
    status_code=status.HTTP_201_CREATED,
)
def add_category(catalog_id: int, payload: CategoryCreate, db: Session = Depends(get_db)):
    return service.add_category(db, catalog_id, payload)


@router.put(
    "/catalogs/{catalog_id}/categories/order", response_model=list[CategoryOut]
)
def reorder_categories(catalog_id: int, payload: ReorderIn, db: Session = Depends(get_db)):
    return service.reorder_categories(db, catalog_id, payload.ordered_ids)


@router.put("/categories/{category_id}", response_model=CategoryOut)
def update_category(category_id: int, payload: CategoryUpdate, db: Session = Depends(get_db)):
    return service.update_category(db, category_id, payload)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    service.delete_category(db, category_id)


# --- Artikel ------------------------------------------------------------
@router.get("/catalogs/{catalog_id}/stock-items", response_model=list[StockItemOut])
def list_stock_items(
    catalog_id: int, include_inactive: bool = False, db: Session = Depends(get_db)
):
    return service.list_stock_items(db, catalog_id, include_inactive=include_inactive)


@router.post(
    "/catalogs/{catalog_id}/stock-items",
    response_model=StockItemOut,
    status_code=status.HTTP_201_CREATED,
)
def add_stock_item(catalog_id: int, payload: StockItemCreate, db: Session = Depends(get_db)):
    return service.add_stock_item(db, catalog_id, payload)


@router.put(
    "/catalogs/{catalog_id}/stock-items/order", response_model=list[StockItemOut]
)
def reorder_stock_items(catalog_id: int, payload: ReorderIn, db: Session = Depends(get_db)):
    return service.reorder_stock_items(db, catalog_id, payload.ordered_ids)


@router.get("/stock-items/{item_id}", response_model=StockItemOut)
def get_stock_item(item_id: int, db: Session = Depends(get_db)):
    return service.get_stock_item(db, item_id)


@router.put("/stock-items/{item_id}", response_model=StockItemOut)
def update_stock_item(item_id: int, payload: StockItemUpdate, db: Session = Depends(get_db)):
    return service.update_stock_item(db, item_id, payload)


@router.delete("/stock-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stock_item(item_id: int, db: Session = Depends(get_db)):
    service.delete_stock_item(db, item_id)
