"""Pydantic-v2-DTOs. Stufe 2: nur der Happy-Path (Anlegen + Lesen).

Geld/Mengen als Decimal. Validierung (Preis >= 0 usw.) kommt mit dem
Fehlermodell in Stufe 3 - hier wird gueltige Eingabe angenommen.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

_orm = ConfigDict(from_attributes=True)


# --- Katalog -----------------------------------------------------------------
class CatalogCreate(BaseModel):
    name: str


class CatalogUpdate(BaseModel):
    name: str


class CatalogOut(BaseModel):
    model_config = _orm
    id: int
    name: str
    created_at: datetime


class CategoryCreate(BaseModel):
    name: str
    icon: str = "MdCategory"
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: str
    icon: str
    sort_order: int = 0


class CategoryOut(BaseModel):
    model_config = _orm
    id: int
    catalog_id: int
    name: str
    icon: str
    sort_order: int


class VariantCreate(BaseModel):
    name: str | None = None
    price: Decimal
    bill_steps: Decimal = Decimal("1")


class VariantUpsert(BaseModel):
    """Beim Artikel-Update: id gesetzt = vorhandene Variante aktualisieren,
    id None/<=0 = neue Variante. Fehlt eine vorhandene id in der Liste ->
    Variante wird geloescht."""

    id: int | None = None
    name: str | None = None
    price: Decimal
    bill_steps: Decimal = Decimal("1")


class VariantOut(BaseModel):
    model_config = _orm
    id: int
    stock_item_id: int
    name: str | None
    price: Decimal
    bill_steps: Decimal
    is_active: bool


class StockItemCreate(BaseModel):
    name: str
    category_id: int | None = None
    deposit_amount: Decimal = Decimal("0")
    sort_order: int = 0
    variants: list[VariantCreate] = Field(default_factory=list)


class StockItemUpdate(BaseModel):
    name: str
    category_id: int | None = None
    deposit_amount: Decimal = Decimal("0")
    sort_order: int = 0
    variants: list[VariantUpsert] = Field(default_factory=list)


class StockItemOut(BaseModel):
    model_config = _orm
    id: int
    catalog_id: int
    category_id: int | None
    name: str
    deposit_amount: Decimal
    is_active: bool
    sort_order: int
    variants: list[VariantOut]


class ReorderIn(BaseModel):
    ordered_ids: list[int]


# --- Veranstaltung ---------------------------------------------------------
class EventCreate(BaseModel):
    catalog_id: int
    name: str


class EventUpdate(BaseModel):
    name: str


class EventOut(BaseModel):
    model_config = _orm
    id: int
    catalog_id: int
    name: str
    started_at: datetime
    ended_at: datetime | None
    is_active: bool


# --- Aktive Bestellung ---------------------------------------------------
class LineDelta(BaseModel):
    variant_id: int
    delta: Decimal


class DepositReturnIn(BaseModel):
    unit_amount: Decimal
    quantity: int


class ActiveLineOut(BaseModel):
    model_config = _orm
    item_variant_id: int
    quantity: Decimal


class ActiveOrderOut(BaseModel):
    event_id: int
    updated_at: datetime
    lines: list[ActiveLineOut]
    deposit_return_unit_amount: Decimal | None = None
    deposit_return_quantity: int | None = None
    total_gross: Decimal
    total_deposit: Decimal
    deposit_return_total: Decimal
    total_due: Decimal


# --- Bon -------------------------------------------------------------------
class BillItemOut(BaseModel):
    model_config = _orm
    item_variant_id: int | None
    item_name: str
    variant_name: str | None
    unit_price: Decimal
    deposit_per_unit: Decimal
    quantity: Decimal


class BillOut(BaseModel):
    model_config = _orm
    id: int
    event_id: int
    created_at: datetime
    business_day: date
    is_deleted: bool
    total_gross: Decimal
    total_deposit: Decimal
    deposit_return_total: Decimal
    items: list[BillItemOut]


class BillListItem(BaseModel):
    id: int
    created_at: datetime
    business_day: date
    is_deleted: bool
    total_gross: Decimal
    total_deposit: Decimal
    deposit_return_total: Decimal
    position_count: int


class DaySummaryOut(BaseModel):
    event_id: int
    business_day: date
    bill_count: int
    total_gross: Decimal
    total_deposit: Decimal
    deposit_return_total: Decimal
    net_total: Decimal
    closed: bool


class DayCloseOut(BaseModel):
    model_config = _orm
    event_id: int
    business_day: date
    closed_at: datetime
    total_gross: Decimal
    total_deposit: Decimal


# --- Statistik ---------------------------------------------------------
class ConsumptionRow(BaseModel):
    item_name: str
    variant_name: str | None
    quantity: Decimal
    revenue: Decimal


class DayBreakdown(BaseModel):
    business_day: date
    bill_count: int
    total_gross: Decimal
    total_deposit: Decimal
    deposit_return_total: Decimal
    net_total: Decimal


class StatisticsOut(BaseModel):
    event_id: int
    event_name: str
    scope: str  # "event" oder ISO-Datum
    bill_count: int
    total_gross: Decimal
    total_deposit: Decimal
    deposit_return_total: Decimal
    net_total: Decimal
    consumption: list[ConsumptionRow]
    days: list[DayBreakdown]
