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
    # Schnellzugriff-Kachel auf dem Bedienterminal
    is_favorite: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    # Optionaler Akzent-Farbton der Kachel (#rrggbb), rein optisch
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)

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
    """Singleton je aktiver Veranstaltung."""

    __tablename__ = "active_order"

    event_id: Mapped[int] = mapped_column(
        ForeignKey("event.id", ondelete="CASCADE"), primary_key=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    # Monoton steigend, damit ein Client zwei ueberholende Antworten
    # auseinanderhalten kann (10"-Terminal + Handy tippen auf denselben Korb).
    revision: Mapped[int] = mapped_column(Integer, server_default=text("0"))

    lines: Mapped[list[ActiveOrderLine]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )
    deposit_returns: Mapped[list[ActiveDepositReturn]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )


class ActiveDepositReturn(Base):
    """Pfandrückgabe im laufenden Vorgang - je Pfandbetrag eine Zeile.

    Ein Gast bringt gemischtes Leergut zurück (3 Weingläser à 2,00 €,
    2 Biergläser à 1,50 €); ein einzelner Betrag pro Vorgang reichte dafür nicht.
    """

    __tablename__ = "active_deposit_return"
    __table_args__ = (
        UniqueConstraint("event_id", "unit_amount", name="uq_active_deposit_unit"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(
        ForeignKey("active_order.event_id", ondelete="CASCADE"), index=True
    )
    unit_amount: Mapped[Decimal] = mapped_column(MONEY)
    quantity: Mapped[int] = mapped_column(Integer)

    order: Mapped[ActiveOrder] = relationship(back_populates="deposit_returns")


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
    """Pfandrueckgabe. `bill_id` gesetzt = im Rahmen eines Bons,
    `bill_id` NULL = eigenstaendige Rueckgabe (Gast bringt nur Tassen)."""

    __tablename__ = "deposit_return"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("event.id"), index=True)
    bill_id: Mapped[int | None] = mapped_column(
        ForeignKey("bill.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    business_day: Mapped[date] = mapped_column(Date, index=True)
    unit_amount: Mapped[Decimal] = mapped_column(MONEY)
    quantity: Mapped[int] = mapped_column(Integer)
    total_amount: Mapped[Decimal] = mapped_column(MONEY)


class DayClose(Base):
    """Merker fuer den weichen Tagesabschluss inkl. Kassenbestand."""

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
    # Wechselgeld-Startbestand der Kassenlade (vom Bediener erfasst)
    opening_float: Mapped[Decimal] = mapped_column(MONEY, server_default="0")
    # Gezaehlter Ist-Bestand beim Abschluss (optional)
    counted_cash: Mapped[Decimal | None] = mapped_column(MONEY, nullable=True)


class CashMovement(Base):
    """Bargeld, das ausserhalb des Verkaufs in die Kasse kommt oder sie
    verlaesst: Wechselgeld nachgelegt (+), Tageslosung in den Tresor (−).

    Ohne diese Zeilen stimmt der Soll-Bestand am Abend nicht mit dem ueberein,
    was tatsaechlich in der Kasse liegt.
    """

    __tablename__ = "cash_movement"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("event.id"), index=True)
    business_day: Mapped[date] = mapped_column(Date, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # Vorzeichenbehaftet: positiv = Einlage, negativ = Entnahme.
    amount: Mapped[Decimal] = mapped_column(MONEY)
    reason: Mapped[str] = mapped_column(String(120), server_default="")


class CashFloat(Base):
    """Startgeld je Veranstaltung + Betriebstag, unabhaengig vom Abschluss."""

    __tablename__ = "cash_float"

    event_id: Mapped[int] = mapped_column(
        ForeignKey("event.id", ondelete="CASCADE"), primary_key=True
    )
    business_day: Mapped[date] = mapped_column(Date, primary_key=True)
    amount: Mapped[Decimal] = mapped_column(MONEY, server_default="0")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
