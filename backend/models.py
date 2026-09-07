"""v2-Kern-Datenmodell (SQLAlchemy 2.0, typed).

Ebenen:
- catalog  : wiederverwendbare Vorlage je Festtyp (Glühweinmeile, Männertag …)
- event    : Laufzeit-Zyklus eines Katalogs; genau einer aktiv
- bill / bill_item : Bon mit vollständigem Preis-/Namens-Snapshot
- active_order : eine gemeinsame laufende Bestellung je aktiver Veranstaltung

Geld = Numeric(10, 2) -> Decimal. Mengen/bill_steps = Numeric(10, 3).
Sortierung ist ein Feld (kein separater Sortier-Tabellen-Umbau mehr).
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

MONEY = Numeric(10, 2)
QTY = Numeric(10, 3)


class Base(DeclarativeBase):
    pass


class Catalog(Base):
    __tablename__ = "catalog"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    categories: Mapped[list[Category]] = relationship(
        back_populates="catalog", cascade="all, delete-orphan"
    )
    stock_items: Mapped[list[StockItem]] = relationship(
        back_populates="catalog", cascade="all, delete-orphan"
    )
    events: Mapped[list[Event]] = relationship(back_populates="catalog")


class Category(Base):
    __tablename__ = "category"
    __table_args__ = (UniqueConstraint("catalog_id", "name", name="uq_category_catalog_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    catalog_id: Mapped[int] = mapped_column(
        ForeignKey("catalog.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(50))
    icon: Mapped[str] = mapped_column(String(50), server_default="MdCategory")
    sort_order: Mapped[int] = mapped_column(Integer, server_default="0")

    catalog: Mapped[Catalog] = relationship(back_populates="categories")
    stock_items: Mapped[list[StockItem]] = relationship(back_populates="category")


class StockItem(Base):
    __tablename__ = "stock_item"

    id: Mapped[int] = mapped_column(primary_key=True)
    catalog_id: Mapped[int] = mapped_column(
        ForeignKey("catalog.id", ondelete="CASCADE"), index=True
    )
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("category.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(50))
    deposit_amount: Mapped[Decimal] = mapped_column(MONEY, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    sort_order: Mapped[int] = mapped_column(Integer, server_default="0")

    catalog: Mapped[Catalog] = relationship(back_populates="stock_items")
    category: Mapped[Category | None] = relationship(back_populates="stock_items")
    variants: Mapped[list[ItemVariant]] = relationship(
        back_populates="stock_item", cascade="all, delete-orphan"
    )


class ItemVariant(Base):
    __tablename__ = "item_variant"

    id: Mapped[int] = mapped_column(primary_key=True)
    stock_item_id: Mapped[int] = mapped_column(
        ForeignKey("stock_item.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    price: Mapped[Decimal] = mapped_column(MONEY)
    bill_steps: Mapped[Decimal] = mapped_column(QTY, server_default="1")
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))

    stock_item: Mapped[StockItem] = relationship(back_populates="variants")


class Event(Base):
    __tablename__ = "event"
    __table_args__ = (
        Index(
            "uq_event_single_active",
            "is_active",
            unique=True,
            postgresql_where=text("is_active"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    catalog_id: Mapped[int] = mapped_column(ForeignKey("catalog.id"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))

    catalog: Mapped[Catalog] = relationship(back_populates="events")
    bills: Mapped[list[Bill]] = relationship(back_populates="event")


class ActiveOrder(Base):
    """Singleton je aktiver Veranstaltung. Pfandrückgabe als nullable Felder
    (1:1, kein eigener Zeilen-Lebenszyklus)."""

    __tablename__ = "active_order"

    event_id: Mapped[int] = mapped_column(
        ForeignKey("event.id", ondelete="CASCADE"), primary_key=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deposit_return_unit_amount: Mapped[Decimal | None] = mapped_column(MONEY, nullable=True)
    deposit_return_quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)

    lines: Mapped[list[ActiveOrderLine]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )


class ActiveOrderLine(Base):
    __tablename__ = "active_order_line"
    __table_args__ = (
        UniqueConstraint("event_id", "item_variant_id", name="uq_active_line_variant"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(
        ForeignKey("active_order.event_id", ondelete="CASCADE"), index=True
    )
    item_variant_id: Mapped[int] = mapped_column(ForeignKey("item_variant.id"))
    quantity: Mapped[Decimal] = mapped_column(QTY)

    order: Mapped[ActiveOrder] = relationship(back_populates="lines")


class Bill(Base):
    __tablename__ = "bill"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("event.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    business_day: Mapped[date] = mapped_column(Date, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    total_gross: Mapped[Decimal] = mapped_column(MONEY)
    total_deposit: Mapped[Decimal] = mapped_column(MONEY, server_default="0")
    deposit_return_total: Mapped[Decimal] = mapped_column(MONEY, server_default="0")

    event: Mapped[Event] = relationship(back_populates="bills")
    items: Mapped[list[BillItem]] = relationship(
        back_populates="bill", cascade="all, delete-orphan"
    )


class BillItem(Base):
    """Vollständiger Snapshot - wird beim Anlegen gefüllt, nie geändert."""

    __tablename__ = "bill_item"

    id: Mapped[int] = mapped_column(primary_key=True)
    bill_id: Mapped[int] = mapped_column(ForeignKey("bill.id", ondelete="CASCADE"), index=True)
    item_variant_id: Mapped[int | None] = mapped_column(
        ForeignKey("item_variant.id", ondelete="SET NULL"), nullable=True
    )
    item_name: Mapped[str] = mapped_column(Text)
    variant_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    unit_price: Mapped[Decimal] = mapped_column(MONEY)
    deposit_per_unit: Mapped[Decimal] = mapped_column(MONEY, server_default="0")
    quantity: Mapped[Decimal] = mapped_column(QTY)

    bill: Mapped[Bill] = relationship(back_populates="items")


class DepositReturn(Base):
    __tablename__ = "deposit_return"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("event.id"), index=True)
    bill_id: Mapped[int | None] = mapped_column(
        ForeignKey("bill.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    unit_amount: Mapped[Decimal] = mapped_column(MONEY)
    quantity: Mapped[int] = mapped_column(Integer)
    total_amount: Mapped[Decimal] = mapped_column(MONEY)


class DayClose(Base):
    """Reiner Nachschlage-Merker fuer den weichen Tagesabschluss."""

    __tablename__ = "day_close"

    event_id: Mapped[int] = mapped_column(
        ForeignKey("event.id", ondelete="CASCADE"), primary_key=True
    )
    business_day: Mapped[date] = mapped_column(Date, primary_key=True)
    closed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    total_gross: Mapped[Decimal] = mapped_column(MONEY)
    total_deposit: Mapped[Decimal] = mapped_column(MONEY, server_default="0")
