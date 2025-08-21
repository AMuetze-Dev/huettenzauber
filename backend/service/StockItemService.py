from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from entity.DAO import StockItem, Category, ItemSorting
from typing import List
import service.ItemVariantService as ItemVariantService
import service.StockItemSortingService as StockItemSortingService

def get_all(db: Session):
    # Left join with ItemSorting to get items in sorted order, including items without sorting
    # Items without sorting will have sort_order = NULL and should appear at the end
    return (db.query(StockItem)
            .outerjoin(ItemSorting, StockItem.id == ItemSorting.item_id)
            .filter(StockItem.is_active)
            .order_by(ItemSorting.sort_order.nullslast(), StockItem.id)
            .all())

def get_by_id(db: Session, item_id: int):
    item = db.query(StockItem).filter(StockItem.is_active, StockItem.id == item_id).first()
    if not item: raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    return item

def create(db: Session, name: str, category_id: int, deposit_amount: float = 0.0, exclude_item_id: int = None):
    if name is None or not name or name.strip() == "" or name.__len__() > 50: raise HTTPException(status_code=400, detail="Name darf nicht leer sein")
    
    # Duplikatsprüfung mit optionalem Ausschluss eines Items (für Updates)
    duplicate_query = db.query(StockItem).filter(
        StockItem.name == name, 
        StockItem.category_id == category_id, 
        StockItem.is_active
    )
    if exclude_item_id is not None:
        duplicate_query = duplicate_query.filter(StockItem.id != exclude_item_id)
    
    if duplicate_query.first(): 
        raise HTTPException(status_code=400, detail="Artikel mit diesem Namen existiert bereits in dieser Kategorie und ist aktiv")
    
    if not db.query(Category).filter(Category.id == category_id).first(): raise HTTPException(status_code=404, detail="Kategorie nicht gefunden")
    
    # Erstelle neues StockItem mit Version 1 (base_item_id bleibt None für das Original)
    item = StockItem(name=name, category_id=category_id, deposit_amount=deposit_amount, is_active=True, version=1)
    db.add(item)
    try:
        db.commit()
        db.refresh(item)
        StockItemSortingService.add_item_to_sorting( db, item_id=item.id, sort_order=db.query(StockItemSortingService.ItemSorting).count() )
        return item
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Integritätsfehler: Artikel konnte nicht erstellt werden: {str(e)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Fehler bei der Erstellung des Artikels: {str(e)}")
    
def update(db: Session, item_id: int, name: str = None, category_id: int = None, deposit_amount: float = None):
    item = db.query(StockItem).filter(StockItem.id == item_id).first()
    if not item: raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    if name is None or not name or name.strip() == "": raise HTTPException(status_code=400, detail="Name darf nicht leer sein")
    if category_id is not None and not db.query(Category).filter(Category.id == category_id).first(): raise HTTPException(status_code=404, detail="Kategorie nicht gefunden")
    
    # Bestimme die finale Kategorie-ID und deposit_amount
    final_category_id = category_id if category_id is not None else item.category_id
    final_name = name if name is not None else item.name
    final_deposit_amount = deposit_amount if deposit_amount is not None else item.deposit_amount
    
    # Duplikatsprüfung - exclude nur den aktuellen Artikel
    duplicate = db.query(StockItem).filter(
        StockItem.name == final_name, 
        StockItem.category_id == final_category_id, 
        StockItem.is_active,
        StockItem.id != item_id
    ).first()
    
    if duplicate:
        raise HTTPException(status_code=400, detail="Artikel mit diesem Namen existiert bereits in dieser Kategorie und ist aktiv")
    
    # Bestimme base_item_id und neue Version
    if item.base_item_id:
        # Item ist bereits eine Version
        base_item_id = item.base_item_id
    else:
        # Item ist das Original, verwende seine ID als base_item_id
        base_item_id = item.id
    
    # Finde die höchste Version für diese base_item_id
    max_version = db.query(StockItem).filter(
        (StockItem.base_item_id == base_item_id) | (StockItem.id == base_item_id)
    ).order_by(StockItem.version.desc().nullslast()).first()
    
    new_version = (max_version.version or 0) + 1 if max_version else 1
    
    # Erstelle neue Version
    new_item = StockItem(
        name=final_name,
        category_id=final_category_id,
        deposit_amount=final_deposit_amount,
        base_item_id=base_item_id,
        version=new_version,
        is_active=True
    )
    
    # Deaktiviere alte Version
    item.is_active = False
    db.add(new_item)
    try:
        db.commit()
        db.refresh(new_item)
        
        # Update ItemSorting - verwende base_item_id für Sortierung
        sorting = db.query(ItemSorting).filter(ItemSorting.item_id == item_id).first()
        if sorting:
            # Entferne alte Sortierung und erstelle neue mit neuer item_id
            db.delete(sorting)
            new_sorting = ItemSorting(item_id=new_item.id, sort_order=sorting.sort_order)
            db.add(new_sorting)
            db.commit()
        
        return new_item
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Integritätsfehler: Artikel konnte nicht aktualisiert werden: {str(e)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Fehler bei der Aktualisierung des Artikels: {str(e)}")
    
def bulk_update(db: Session, items: List[StockItem]):
    updated_items = []
    for item_data in items:
        item_id = item_data.get("id")
        name = item_data.get("name")
        category_id = item_data.get("category_id")

        item = db.query(StockItem).filter(StockItem.id == item_id).first()
        if not item: raise HTTPException(status_code=404, detail=f"Artikel mit ID {item_id} nicht gefunden")
        if not item.is_active: raise HTTPException(status_code=400, detail=f"Inaktiver Artikel mit ID {item_id} kann nicht aktualisiert werden")

        changed = (
            (name is not None and name != item.name) or
            (category_id is not None and category_id != item.category_id)
        )
        if changed:
            updated_item = update(db, item_id, name, category_id)
            updated_items.append(updated_item)
        else:
            updated_items.append(item)
    return updated_items

def get_all_in_category(db: Session, category_id: int):
    if not db.query(Category).filter(Category.id == category_id).first(): 
        raise HTTPException(status_code=404, detail="Kategorie nicht gefunden")
    if not db.query(StockItem).filter(StockItem.category_id == category_id, StockItem.is_active).first(): 
        raise HTTPException(status_code=400, detail="Kein Item in dieser Kategorie gefunden")
    
    # Left join with ItemSorting to get items in sorted order within the category
    return (db.query(StockItem)
            .outerjoin(ItemSorting, StockItem.id == ItemSorting.item_id)
            .filter(StockItem.category_id == category_id, StockItem.is_active)
            .order_by(ItemSorting.sort_order.nullslast(), StockItem.id)
            .all())

def delete(db: Session, item_id: int):
    item = db.query(StockItem).filter(StockItem.id == item_id).first()
    if not item: raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    if not item.is_active: raise HTTPException(status_code=400, detail="Inaktiver Artikel kann nicht deaktiviert werden")
    item.is_active = False

    StockItemSortingService.remove_item_from_sorting(db, item_id)

    for variant in ItemVariantService.get_all_in_stock_item(db, item_id):
        ItemVariantService.delete(db, variant.id)

    try:
        db.commit()
        db.refresh(item)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Fehler beim Löschen des Artikels: {str(e)}")