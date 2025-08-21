from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List
from entity.DAO import Category, CategorySorting

def get_all_sortings(db: Session):
    return db.query(CategorySorting).order_by(CategorySorting.sort_order).all()

def add_category_to_sorting(db: Session, category_id: int, sort_order: int):
    if not db.query(Category).filter(Category.id == category_id).first(): raise HTTPException(status_code=404, detail="Kategorie nicht gefunden")
    if db.query(CategorySorting).filter(CategorySorting.category_id == category_id).first(): raise HTTPException(status_code=400, detail="Kategorie ist bereits im Sortierungseintrag enthalten")
    if sort_order < 0: raise HTTPException(status_code=400, detail="Sortierreihenfolge muss größer als 0 sein")
    entry = CategorySorting(category_id=category_id, sort_order=sort_order)
    db.add(entry)
    try:
        db.commit()
        db.refresh(entry)
        return entry
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Integritätsfehler: " + str(e.orig))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Fehler bei der Erstellung der Kategoriesortierung: " + str(e))
    
def remove_category_from_sorting(db: Session, category_id: int):
    entry = db.query(CategorySorting).filter(CategorySorting.category_id == category_id).first()
    if not entry: raise HTTPException(status_code=404, detail="Kategoriesortierung nicht gefunden")
    db.delete(entry)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Fehler beim Löschen der Kategoriesortierung: " + str(e))
    
def move_category(db: Session, category_id: int, new_sort_order: int):
    if new_sort_order < 1: raise HTTPException(status_code=400, detail="Sortierreihenfolge außerhalb des gültigen Bereichs")
    if new_sort_order > db.query(CategorySorting).count(): raise HTTPException(status_code=400, detail="Sortierreihenfolge außerhalb des gültigen Bereichs")
    entry = db.query(CategorySorting).filter(CategorySorting.category_id == category_id).first()
    if not entry: raise HTTPException(status_code=404, detail="Kategoriesortierung nicht gefunden")
    if entry.sort_order == new_sort_order: return entry
    if entry.sort_order < new_sort_order:
        affected = db.query(CategorySorting).filter(
            CategorySorting.sort_order > entry.sort_order,
            CategorySorting.sort_order <= new_sort_order
        ).all()
        for e in affected: e.sort_order -= 1
    else:
        affected = db.query(CategorySorting).filter(
            CategorySorting.sort_order < entry.sort_order,
            CategorySorting.sort_order >= new_sort_order
        ).all()
        for e in affected: e.sort_order += 1
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
        raise HTTPException(status_code=400, detail="Fehler bei der Aktualisierung der Kategoriesortierung: " + str(e))

def bulk_update_sorting(db: Session, ordered_category_ids: List[int]):
    if not ordered_category_ids: raise HTTPException(status_code=400, detail="Die Liste darf nicht leer sein")
    entries = db.query(CategorySorting).filter(CategorySorting.category_id.in_(ordered_category_ids)).all()
    if len(entries) != len(ordered_category_ids):
        found_ids = {e.category_id for e in entries}
        missing = set(ordered_category_ids) - found_ids
        if missing: raise HTTPException(status_code=400, detail=f"Folgende Kategorien fehlen in der Sortierung: {list(missing)}")
    if len(set(ordered_category_ids)) != len(ordered_category_ids): raise HTTPException(status_code=400, detail="Die Liste enthält doppelte Kategorie-IDs")
    entry_map = {e.category_id: e for e in entries}
    try:
        for idx, cat_id in enumerate(ordered_category_ids): entry_map[cat_id].sort_order = idx
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Integritätsfehler: " + str(e.orig))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Fehler bei der Aktualisierung der Kategoriesortierung: " + str(e))