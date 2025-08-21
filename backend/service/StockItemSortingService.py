from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List
from entity.DAO import StockItem, ItemSorting

def get_all_sortings(db: Session):
    return db.query(ItemSorting).join(StockItem).filter(StockItem.is_active == True).order_by(ItemSorting.sort_order).all()

def add_item_to_sorting(db: Session, item_id: int, sort_order: int):
    entry = db.query(ItemSorting).filter(ItemSorting.item_id == item_id).first()
    if entry:
        entry.sort_order = sort_order
    else:
        entry = ItemSorting(item_id=item_id, sort_order=sort_order)
        db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

def remove_item_from_sorting(db: Session, item_id: int):
    entry = db.query(ItemSorting).filter(ItemSorting.item_id == item_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Item-Sortierung nicht gefunden")
    db.delete(entry)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Fehler beim Löschen der Items-Sortierung: " + str(e))

def move_item(db: Session, item_id: int, new_sort_order: int):
    """Verschiebt ein StockItem auf eine neue Sortierposition."""
    if new_sort_order < 1:
        raise HTTPException(status_code=400, detail="Sortierreihenfolge außerhalb des gültigen Bereichs")
    if new_sort_order > db.query(ItemSorting).count():
        raise HTTPException(status_code=400, detail="Sortierreihenfolge außerhalb des gültigen Bereichs")
    entry = db.query(ItemSorting).filter(ItemSorting.item_id == item_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Item-Sortierung nicht gefunden")
    if entry.sort_order == new_sort_order:
        return entry
    if entry.sort_order < new_sort_order:
        affected = db.query(ItemSorting).filter(
            ItemSorting.sort_order > entry.sort_order,
            ItemSorting.sort_order <= new_sort_order
        ).all()
        for e in affected:
            e.sort_order -= 1
    else:
        affected = db.query(ItemSorting).filter(
            ItemSorting.sort_order < entry.sort_order,
            ItemSorting.sort_order >= new_sort_order
        ).all()
        for e in affected:
            e.sort_order += 1
    try:
        entry.sort_order = new_sort_order
        db.commit()
        db.refresh(entry)
        return entry
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Integritätsfehler: " + str(e.orig))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Fehler bei der Aktualisierung der Items-Sortierung: " + str(e))

def bulk_update_sorting(db: Session, ordered_item_ids: list[int]):
    if not ordered_item_ids:
        raise HTTPException(status_code=400, detail="Die Liste darf nicht leer sein")
    
    # Prüfe, ob alle Items existieren und aktiv sind
    items = db.query(StockItem).filter(StockItem.id.in_(ordered_item_ids), StockItem.is_active == True).all()
    found_ids = {item.id for item in items}
    missing = set(ordered_item_ids) - found_ids
    if missing:
        raise HTTPException(status_code=400, detail=f"Folgende Items fehlen oder sind inaktiv: {list(missing)}")
    if len(set(ordered_item_ids)) != len(ordered_item_ids):
        raise HTTPException(status_code=400, detail="Die Liste enthält doppelte Item-IDs")
    
    # Lege fehlende ItemSorting-Einträge an, vorhandene werden einfach aktualisiert
    for idx, item_id in enumerate(ordered_item_ids):
        entry = db.query(ItemSorting).filter(ItemSorting.item_id == item_id).first()
        if not entry:
            entry = ItemSorting(item_id=item_id, sort_order=idx)
            db.add(entry)
        else:
            entry.sort_order = idx
    
    db.commit()