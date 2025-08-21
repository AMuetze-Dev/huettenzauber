from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from entity.DAO import DepositReturn, StockItem
from datetime import date

def get_all(db: Session):
    return db.query(DepositReturn).all()

def get_by_id(db: Session, deposit_return_id: int):
    deposit_return = db.query(DepositReturn).filter(DepositReturn.id == deposit_return_id).first()
    if not deposit_return:
        raise HTTPException(status_code=404, detail="Pfandrückgabe nicht gefunden")
    return deposit_return

def create(db: Session, stock_item_id: int, quantity: int):
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Anzahl muss größer als 0 sein")
    
    # Get stock item to get deposit amount
    stock_item = db.query(StockItem).filter(StockItem.id == stock_item_id, StockItem.is_active == True).first()
    if not stock_item:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    
    if stock_item.deposit_amount <= 0:
        raise HTTPException(status_code=400, detail="Artikel hat keinen Pfand")
    
    total_amount = stock_item.deposit_amount * quantity
    
    deposit_return = DepositReturn(
        stock_item_id=stock_item_id,
        quantity=quantity,
        deposit_amount_per_item=stock_item.deposit_amount,
        total_amount=total_amount,
        created_at=date.today()
    )
    
    db.add(deposit_return)
    try:
        db.commit()
        db.refresh(deposit_return)
        return deposit_return
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Integritätsfehler: {str(e.orig)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Fehler beim Erstellen der Pfandrückgabe: {str(e)}")

def delete(db: Session, deposit_return_id: int):
    deposit_return = db.query(DepositReturn).filter(DepositReturn.id == deposit_return_id).first()
    if not deposit_return:
        raise HTTPException(status_code=404, detail="Pfandrückgabe nicht gefunden")
    
    db.delete(deposit_return)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Fehler beim Löschen der Pfandrückgabe: {str(e)}")
