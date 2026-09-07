from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from entity.DAO import StockItem, ItemVariant
from typing import List

def get_all_in_stock_item(db: Session, stock_item_id: int) -> List[ItemVariant]:
    query = db.query(ItemVariant)
    if stock_item_id is None: raise HTTPException(status_code=400, detail="StockItem ID ist erforderlich")
    query = query.filter(ItemVariant.stock_item_id == stock_item_id)
    variants = query.all()
    for v in variants:
        if v.name is None or v.name.strip() == "": v.name = str(v.bill_steps)
    return variants

def get_by_id(db: Session, variant_id: int) -> ItemVariant:
    variant = db.query(ItemVariant).filter(ItemVariant.id == variant_id).first()
    if not variant: raise HTTPException(status_code=404, detail="Variante nicht gefunden")
    if variant.name is None or variant.name.strip() == "": variant.name = str(variant.bill_steps)
    return variant

def create(db: Session, stock_item_id: int, name: str = None, price: float = None, bill_steps: float = 1.0) -> ItemVariant:
    if not db.query(StockItem).filter(StockItem.id == stock_item_id).first():
        raise HTTPException(status_code=404, detail="StockItem nicht gefunden")
    if price is None or price < 0:
        raise HTTPException(status_code=400, detail="Preis muss >= 0 sein")
    if bill_steps is None or bill_steps <= 0:
        raise HTTPException(status_code=400, detail="Rechenschritt muss > 0 sein")

    # Prüfe auf doppelte Varianten - nur bei gleichem Namen UND Preis
    existing = db.query(ItemVariant).filter(
        ItemVariant.stock_item_id == stock_item_id,
        ItemVariant.is_active == True
    ).all()
    for v in existing:
        # Nur verbieten wenn Name UND Preis gleich sind (verschiedene Namen mit gleichem Preis sind erlaubt)
        if (v.name or "") == (name or "") and v.price == price:
            raise HTTPException(status_code=400, detail="Variante mit gleichem Namen und gleichem Preis existiert bereits")
        # Oder wenn Name UND bill_steps gleich sind aber unterschiedlicher Preis (verwirrend für Nutzer)
        if (v.name or "") == (name or "") and v.bill_steps == bill_steps and v.price != price:
            raise HTTPException(status_code=400, detail="Variante mit gleichem Namen und gleichem Rechenschritt aber anderem Preis existiert bereits")

    variant = ItemVariant(
        stock_item_id=stock_item_id,
        name=name,
        price=price,
        bill_steps=bill_steps,
        is_active=True,
        version=1
    )
    db.add(variant)
    try:
        db.commit()
        db.refresh(variant)
        if variant.name is None or variant.name.strip() == "": variant.name = str(variant.bill_steps)
        return variant
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Integritätsfehler: {str(e.orig)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Fehler beim Erstellen der Variante: {str(e)}")

def update(db: Session, variant_id: int, name: str = None, price: float = None, bill_steps: float = None, stock_item_id: int = None) -> ItemVariant:
    variant = db.query(ItemVariant).filter(ItemVariant.id == variant_id).first()
    if not variant: raise HTTPException(status_code=404, detail="Variante nicht gefunden")
    if not variant.is_active: raise HTTPException(status_code=400, detail="Inaktive Variante kann nicht bearbeitet werden")

    new_name = name if name is not None else variant.name
    new_price = price if price is not None else variant.price
    new_bill_steps = bill_steps if bill_steps is not None else variant.bill_steps
    new_stock_item_id = stock_item_id if stock_item_id is not None else variant.stock_item_id

    existing = db.query(ItemVariant).filter(
        ItemVariant.stock_item_id == new_stock_item_id,
        ItemVariant.is_active == True,
        ItemVariant.id != variant_id
    ).all()
    for v in existing:
        # Nur verbieten wenn Name UND Preis gleich sind
        if (v.name or "") == (new_name or "") and v.price == new_price: 
            raise HTTPException(status_code=400, detail="Variante mit gleichem Namen und gleichem Preis existiert bereits")
        # Oder wenn Name UND bill_steps gleich sind aber unterschiedlicher Preis
        if (v.name or "") == (new_name or "") and v.bill_steps == new_bill_steps and v.price != new_price: 
            raise HTTPException(status_code=400, detail="Variante mit gleichem Namen und gleichem Mengenangaben aber anderem Preis existiert bereits")

    new_data = variant.__dict__.copy()
    new_data.pop("id", None)
    new_data.pop("_sa_instance_state", None)
    new_data["name"] = new_name
    new_data["price"] = new_price
    new_data["bill_steps"] = new_bill_steps
    new_data["version"] = (variant.version or 1) + 1
    new_data["is_active"] = True
    new_data["stock_item_id"] = new_stock_item_id if new_stock_item_id else variant.stock_item_id

    if new_data["price"] is None or new_data["price"] < 0: raise HTTPException(status_code=400, detail="Preis muss >= 0 sein")
    if new_data["bill_steps"] is None or new_data["bill_steps"] <= 0: raise HTTPException(status_code=400, detail="Mengenangaben muss > 0 sein")

    new_variant = ItemVariant(**new_data)
    variant.is_active = False
    db.add(new_variant)
    try:
        db.commit()
        db.refresh(new_variant)
        if new_variant.name is None or new_variant.name.strip() == "":
            new_variant.name = str(new_variant.bill_steps)
        return new_variant
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Integritätsfehler: {str(e.orig)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Fehler beim Aktualisieren der Variante: {str(e)}")

def delete(db: Session, variant_id: int):
    variant = db.query(ItemVariant).filter(ItemVariant.id == variant_id).first()
    if not variant: raise HTTPException(status_code=404, detail="Variante nicht gefunden")
    if not variant.is_active: raise HTTPException(status_code=400, detail="Variante ist bereits inaktiv")
    variant.is_active = False
    try:
        db.commit()
        db.refresh(variant)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Fehler beim Löschen der Variante: {str(e)}")