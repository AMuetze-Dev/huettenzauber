"""Pydantic-v2-DTOs.

Geld/Mengen als Decimal (Pydantic weist NaN/Infinity ab). Geschaefts-
validierung (Betragsgrenzen, Namen, Konflikte) passiert im Service-Layer.
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
    # None = Position unveraendert lassen (Reihenfolge kommt per /order).
    sort_order: int | None = None


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
    is_favorite: bool = False
    color: str | None = None
    variants: list[VariantCreate] = Field(default_factory=list)


class StockItemUpdate(BaseModel):
    name: str
    category_id: int | None = None
    deposit_amount: Decimal = Decimal("0")
    # None = Position unveraendert lassen (Reihenfolge kommt per /order).
    sort_order: int | None = None
    is_favorite: bool = False
    color: str | None = None
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
    is_favorite: bool
    color: str | None
    variants: list[VariantOut]


class FavoriteIn(BaseModel):
    is_favorite: bool


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


class DepositReturnLineOut(BaseModel):
    """Eine Pfandsorte im laufenden Vorgang (3× à 2,00 €)."""

    unit_amount: Decimal
    quantity: int
    total_amount: Decimal


class ActiveOrderOut(BaseModel):
    event_id: int
    updated_at: datetime
    revision: int
    lines: list[ActiveLineOut]
    deposit_returns: list[DepositReturnLineOut] = Field(default_factory=list)
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


# --- Pfandrückgabe (eigenständig) ------------------------------
class DepositReturnIn2(BaseModel):
    unit_amount: Decimal
    quantity: int


class DepositReturnOut(BaseModel):
    model_config = _orm
    id: int
    event_id: int
    bill_id: int | None
    created_at: datetime
    business_day: date
    unit_amount: Decimal
    quantity: int
    total_amount: Decimal


# --- Tagesabschluss ------------------------------------------
class CashCountOut(BaseModel):
    """Was an diesem Betriebstag ueber die Theke ging - eine Anfrage,
    ein Bild. Bewusst ohne Kassenbestand: siehe D41 in ARCHITEKTUR.md."""

    event_id: int
    event_name: str
    business_day: date
    bill_count: int
    total_gross: Decimal
    total_deposit: Decimal
    deposit_return_in_bills: Decimal
    standalone_deposit_return: Decimal
    # Was netto an Bargeld hereinkam (Bons abzueglich Pfandauszahlungen).
    cash_income: Decimal
    closed: bool
    closed_at: datetime | None


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
