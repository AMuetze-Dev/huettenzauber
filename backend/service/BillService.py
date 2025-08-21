from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from entity.DAO import Bill, BillItem, ItemVariant, StockItem
from datetime import date

def get_all(db: Session):
    return db.query(Bill).filter(Bill.is_deleted == False).order_by(Bill.date.desc()).all()

def get_by_id(db: Session, bill_id: int):
    bill = db.query(Bill).filter(Bill.id == bill_id, Bill.is_deleted == False).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    return bill

def get_all_with_deleted(db: Session):
    return db.query(Bill).order_by(Bill.date.desc()).all()

def create(db: Session, bill_date: date, items: list[dict]):
    if not items or not isinstance(items, list): 
        raise HTTPException(status_code=400, detail="Items müssen eine Liste sein und dürfen nicht leer sein")
    
    # Berechne Gesamtbeträge
    total_amount = 0.0
    total_deposit_amount = 0.0
    
    # Erstelle Bill
    bill = Bill(
        date=bill_date,
        total_amount=0.0,  # Wird nachher gesetzt
        total_deposit_amount=0.0  # Wird nachher gesetzt
    )
    db.add(bill)
    
    try:
        db.commit()
        db.refresh(bill)
        
        for item in items:
            variant = db.query(ItemVariant).filter(ItemVariant.id == item["item_variant_id"]).first()
            if not variant: 
                raise HTTPException(status_code=404, detail=f"ItemVariant {item['item_variant_id']} nicht gefunden")
            
            # Hole StockItem für Pfand-Information
            stock_item = db.query(StockItem).filter(StockItem.id == variant.stock_item_id).first()
            if not stock_item:
                raise HTTPException(status_code=404, detail=f"StockItem für Variant {item['item_variant_id']} nicht gefunden")
            
            quantity = item.get("item_quantity", 1)
            if quantity <= 0: 
                raise HTTPException(status_code=400, detail="Item quantity must be greater than 0")
            
            # Berechne Beträge für diesen Artikel
            item_total = variant.price * quantity
            deposit_total = stock_item.deposit_amount * quantity
            
            total_amount += item_total
            total_deposit_amount += deposit_total
            
            bill_item = BillItem(
                bill_id=bill.id,
                item_variant_id=item["item_variant_id"],
                item_quantity=quantity,
                item_price=variant.price,
                deposit_amount_per_item=stock_item.deposit_amount
            )
            db.add(bill_item)
        
        # Aktualisiere Bill mit Gesamtbeträgen
        bill.total_amount = total_amount
        bill.total_deposit_amount = total_deposit_amount
        
        db.commit()
        db.refresh(bill)
        return bill
        
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Integritätsfehler: " + str(e.orig))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Fehler bei der Erstellung der Rechnung: " + str(e))

def delete(db: Session, bill_id: int):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    bill.is_deleted = True
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Fehler beim Löschen der Rechnung: " + str(e))