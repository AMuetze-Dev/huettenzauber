from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, Boolean
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()
class Category(Base):
    __tablename__ = 'category'
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False, unique=True)
    icon = Column(String(50), nullable=False, default="MdCategory")

    stock_items = relationship("StockItem", back_populates="category")

class CategorySorting(Base):
    __tablename__ = 'category_sorting'
    id = Column(Integer, primary_key=True, autoincrement=True)
    category_id = Column(Integer, ForeignKey('category.id', ondelete="CASCADE"), nullable=False)
    sort_order = Column(Integer, nullable=False)

class StockItem(Base):
    __tablename__ = 'stock_item'
    id = Column(Integer, primary_key=True, autoincrement=True)
    base_item_id = Column(Integer, ForeignKey('stock_item.id', ondelete="Set NULL"), nullable=True)
    category_id = Column(Integer, ForeignKey('category.id'), nullable=False)

    name = Column(String(50), nullable=False)
    deposit_amount = Column(Float, default=0.0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False, server_default="true")
    version = Column(Integer)

    category = relationship("Category", back_populates="stock_items")
    item_variants = relationship("ItemVariant", back_populates="stock_item")

class ItemSorting(Base):
    __tablename__ = "item_sorting"
    id = Column(Integer, primary_key=True, autoincrement=True)
    item_id = Column(Integer, ForeignKey("stock_item.id"), unique=True)
    sort_order = Column(Integer, nullable=False)

class ItemVariant(Base):
    __tablename__ = 'item_variant'
    stock_item_id = Column(Integer, ForeignKey('stock_item.id'), nullable=False)
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50))
    price = Column(Float)
    bill_steps = Column(Float)
    is_active = Column(Boolean, default=True, nullable=False, server_default="true")
    version = Column(Integer)

    stock_item = relationship("StockItem", back_populates="item_variants")

class Bill(Base):
    __tablename__ = 'bill'
    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date)
    is_deleted = Column(Boolean, default=False, nullable=False)

    items = relationship("BillItem", back_populates="bill")

class BillItem(Base):
    __tablename__ = 'bill_item'
    bill_id = Column(Integer, ForeignKey('bill.id'))
    item_variant_id = Column(Integer, ForeignKey('item_variant.id'), nullable=True)

    id = Column(Integer, primary_key=True, autoincrement=True)
    item_quantity = Column(Float)
    item_price = Column(Float, nullable=False)  # Preis zum Zeitpunkt der Bestellung

    bill = relationship("Bill", back_populates="items")

class DepositReturn(Base):
    __tablename__ = 'deposit_return'
    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_item_id = Column(Integer, ForeignKey('stock_item.id'), nullable=False)
    quantity = Column(Integer, nullable=False)
    deposit_amount_per_item = Column(Float, nullable=False)
    total_amount = Column(Float, nullable=False)
    created_at = Column(Date, nullable=False)
    
    stock_item = relationship("StockItem")