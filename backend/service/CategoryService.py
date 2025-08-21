from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from entity.DAO import Category, CategorySorting

def get_all(db: Session):
    return db.query(Category).all()

def get_by_id(db: Session, category_id: int):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category: raise HTTPException(status_code=404, detail="Kategorie nicht gefunden")
    return category

def create(db: Session, name: str, icon: str):
    if name is None or not name or name.strip() == "": raise HTTPException(status_code=400, detail="Name darf nicht leer sein")
    if icon is None or not icon or icon.strip() == "": raise HTTPException(status_code=400, detail="Icon darf nicht leer sein")
    if db.query(Category).filter(Category.name == name).first(): raise HTTPException(status_code=400, detail="Kategorie mit diesem Namen existiert bereits")
    category = Category(name=name, icon=icon)
    db.add(category)
    try:
        db.commit()
        db.refresh(category)
        max_sort = db.query(CategorySorting).count()
        sorting = CategorySorting(category_id=category.id, sort_order=max_sort + 1)
        db.add(sorting)
        db.commit()
        db.refresh(category)
        return category
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Integritätsfehler: " + str(e.orig))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Fehler bei der Erstellung der Kategorie: " + str(e))
    
def update(db: Session, category_id: int, name: str = None, icon: str = None):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category: raise HTTPException(status_code=404, detail="Kategorie nicht gefunden")
    if name is None or not name or name.strip() == "": raise HTTPException(status_code=400, detail="Name darf nicht leer sein")
    if icon is None or not icon or icon.strip() == "": raise HTTPException(status_code=400, detail="Icon darf nicht leer sein")
    if name != category.name and db.query(Category).filter(Category.name == name).first(): raise HTTPException(status_code=400, detail="Kategorie mit diesem Namen existiert bereits")
    category.name = name
    category.icon = icon
    try:
        db.commit()
        db.refresh(category)
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Integritätsfehler: " + str(e.orig))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Fehler bei der Aktualisierung der Kategorie: " + str(e))
    return category

def delete(db: Session, category_id: int):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category: raise HTTPException(status_code=404, detail="Kategorie nicht gefunden")
    db.delete(category)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Fehler beim Löschen der Kategorie: " + str(e))