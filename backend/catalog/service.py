"""Katalog-Slice: Katalog / Kategorie / Artikel(+Varianten) - CRUD.

Frameworkfrei - importiert nur models, schemas, core.*, sqlalchemy.
Katalog-Mutation ist In-Place (stabile IDs), `is_active` ist echtes Soft-Delete.
"""
from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.db import commit
from core.exceptions import ConflictError, NotFoundError, ValidationError
from models import Catalog, Category, Event, ItemVariant, StockItem
from schemas import (
    CategoryCreate,
    CategoryUpdate,
    StockItemCreate,
    StockItemUpdate,
    VariantCreate,
    VariantUpsert,
)

NAME_MAX = 50
CATALOG_NAME_MAX = 80


def _clean_name(value: str, *, field: str = "Name", max_len: int = NAME_MAX) -> str:
    text = (value or "").strip()
    if not text:
        raise ValidationError(f"{field} darf nicht leer sein")
    if len(text) > max_len:
        raise ValidationError(f"{field} darf höchstens {max_len} Zeichen haben")
    return text


def _variant_name(value: str | None) -> str | None:
    text = (value or "").strip()
    return text or None


def get_catalog(db: Session, catalog_id: int) -> Catalog:
    catalog = db.get(Catalog, catalog_id)
    if catalog is None:
        raise NotFoundError("Katalog nicht gefunden")
    return catalog


def _get_category(db: Session, category_id: int) -> Category:
    category = db.get(Category, category_id)
    if category is None:
        raise NotFoundError("Kategorie nicht gefunden")
    return category


def _get_stock_item(db: Session, item_id: int) -> StockItem:
    item = db.get(StockItem, item_id)
    if item is None:
        raise NotFoundError("Artikel nicht gefunden")
    return item


# --- Katalog -------------------------------------------------------------
def list_catalogs(db: Session) -> list[Catalog]:
    return list(db.scalars(select(Catalog).order_by(Catalog.name)))


def create_catalog(db: Session, name: str) -> Catalog:
    name = _clean_name(name, field="Katalogname", max_len=CATALOG_NAME_MAX)
    if db.scalars(select(Catalog).where(Catalog.name == name)).first():
        raise ConflictError("Katalog mit diesem Namen existiert bereits")
    catalog = Catalog(name=name)
    db.add(catalog)
    commit(db, on_conflict="Katalog mit diesem Namen existiert bereits")
    db.refresh(catalog)
    return catalog


def update_catalog(db: Session, catalog_id: int, name: str) -> Catalog:
    catalog = get_catalog(db, catalog_id)
    name = _clean_name(name, field="Katalogname", max_len=CATALOG_NAME_MAX)
    dup = db.scalars(
        select(Catalog).where(Catalog.name == name, Catalog.id != catalog_id)
    ).first()
    if dup:
        raise ConflictError("Katalog mit diesem Namen existiert bereits")
    catalog.name = name
    commit(db, on_conflict="Katalog mit diesem Namen existiert bereits")
    db.refresh(catalog)
    return catalog


def delete_catalog(db: Session, catalog_id: int) -> None:
    catalog = get_catalog(db, catalog_id)
    if db.scalars(select(Event.id).where(Event.catalog_id == catalog_id)).first():
        raise ConflictError(
            "Katalog kann nicht gelöscht werden - es gibt Veranstaltungen dazu"
        )
    db.delete(catalog)
    commit(db)


# --- Kategorie ---------------------------------------------------------
def list_categories(db: Session, catalog_id: int) -> list[Category]:
    get_catalog(db, catalog_id)
    return list(
        db.scalars(
            select(Category)
            .where(Category.catalog_id == catalog_id)
            .order_by(Category.sort_order, Category.id)
        )
    )


def add_category(db: Session, catalog_id: int, data: CategoryCreate) -> Category:
    get_catalog(db, catalog_id)
    name = _clean_name(data.name, field="Kategoriename")
    icon = _clean_name(data.icon, field="Icon")
    if db.scalars(
        select(Category).where(Category.catalog_id == catalog_id, Category.name == name)
    ).first():
        raise ConflictError(
            "Kategorie mit diesem Namen existiert bereits in diesem Katalog"
        )
    category = Category(
        catalog_id=catalog_id, name=name, icon=icon, sort_order=data.sort_order
    )
    db.add(category)
    commit(db, on_conflict="Kategorie mit diesem Namen existiert bereits in diesem Katalog")
    db.refresh(category)
    return category


def update_category(db: Session, category_id: int, data: CategoryUpdate) -> Category:
    category = _get_category(db, category_id)
    name = _clean_name(data.name, field="Kategoriename")
    icon = _clean_name(data.icon, field="Icon")
    dup = db.scalars(
        select(Category).where(
            Category.catalog_id == category.catalog_id,
            Category.name == name,
            Category.id != category_id,
        )
    ).first()
    if dup:
        raise ConflictError(
            "Kategorie mit diesem Namen existiert bereits in diesem Katalog"
        )
    category.name = name
    category.icon = icon
    category.sort_order = data.sort_order
    commit(db, on_conflict="Kategorie mit diesem Namen existiert bereits in diesem Katalog")
    db.refresh(category)
    return category


def delete_category(db: Session, category_id: int) -> None:
    """Loeschen der Kategorie. Artikel behalten den Katalog, category_id -> NULL
    (FK ondelete=SET NULL) und sind danach im Bereich 'ohne Kategorie'."""
    category = _get_category(db, category_id)
    db.delete(category)
    commit(db)


def reorder_categories(db: Session, catalog_id: int, ordered_ids: list[int]) -> list[Category]:
    get_catalog(db, catalog_id)
    if len(set(ordered_ids)) != len(ordered_ids):
        raise ValidationError("Doppelte IDs in der Reihenfolge")
    by_id = {
        c.id: c
        for c in db.scalars(
            select(Category).where(Category.catalog_id == catalog_id)
        )
    }
    missing = set(ordered_ids) - by_id.keys()
    if missing:
        raise NotFoundError(f"Kategorien nicht in diesem Katalog: {sorted(missing)}")
    for index, cid in enumerate(ordered_ids):
        by_id[cid].sort_order = index
    commit(db)
    return list_categories(db, catalog_id)


# --- Artikel + Varianten --------------------------------------------
def _validate_variant(v: VariantCreate | VariantUpsert) -> None:
    if v.price is None or v.price < Decimal("0"):
        raise ValidationError("Preis muss >= 0 sein")
    if v.bill_steps is None or v.bill_steps <= Decimal("0"):
        raise ValidationError("Rechenschritt (bill_steps) muss > 0 sein")


def _check_variant_batch(variants) -> None:
    seen = []
    for v in variants:
        _validate_variant(v)
        vname = (v.name or "").strip()
        for other in seen:
            oname = (other.name or "").strip()
            if oname == vname and other.price == v.price:
                raise ConflictError(
                    "Variante mit gleichem Namen und Preis existiert bereits"
                )
            if oname == vname and other.bill_steps == v.bill_steps and other.price != v.price:
                raise ConflictError(
                    "Variante mit gleichem Namen und Rechenschritt, aber anderem Preis"
                )
        seen.append(v)


def _resolve_category(db: Session, catalog_id: int, category_id: int | None) -> int | None:
    if category_id is None:
        return None
    category = db.get(Category, category_id)
    if category is None or category.catalog_id != catalog_id:
        raise NotFoundError("Kategorie nicht gefunden")
    return category_id


def _assert_unique_item_name(
    db: Session, catalog_id: int, category_id: int | None, name: str, *, exclude: int | None
) -> None:
    stmt = select(StockItem).where(
        StockItem.catalog_id == catalog_id,
        StockItem.category_id == category_id,
        StockItem.name == name,
        StockItem.is_active.is_(True),
    )
    if exclude is not None:
        stmt = stmt.where(StockItem.id != exclude)
    if db.scalars(stmt).first():
        raise ConflictError(
            "Artikel mit diesem Namen existiert bereits in dieser Kategorie"
        )


def list_stock_items(
    db: Session, catalog_id: int, *, include_inactive: bool = False
) -> list[StockItem]:
    get_catalog(db, catalog_id)
    stmt = select(StockItem).where(StockItem.catalog_id == catalog_id)
    if not include_inactive:
        stmt = stmt.where(StockItem.is_active.is_(True))
    return list(db.scalars(stmt.order_by(StockItem.sort_order, StockItem.id)))


def get_stock_item(db: Session, item_id: int) -> StockItem:
    return _get_stock_item(db, item_id)


def add_stock_item(db: Session, catalog_id: int, data: StockItemCreate) -> StockItem:
    get_catalog(db, catalog_id)
    name = _clean_name(data.name, field="Artikelname")
    if data.deposit_amount is not None and data.deposit_amount < Decimal("0"):
        raise ValidationError("Pfand muss >= 0 sein")
    category_id = _resolve_category(db, catalog_id, data.category_id)
    _assert_unique_item_name(db, catalog_id, category_id, name, exclude=None)
    _check_variant_batch(data.variants)

    item = StockItem(
        catalog_id=catalog_id,
        category_id=category_id,
        name=name,
        deposit_amount=data.deposit_amount,
        sort_order=data.sort_order,
        variants=[
            ItemVariant(
                name=_variant_name(v.name), price=v.price, bill_steps=v.bill_steps
            )
            for v in data.variants
        ],
    )
    db.add(item)
    commit(db)
    db.refresh(item)
    return item


def update_stock_item(db: Session, item_id: int, data: StockItemUpdate) -> StockItem:
    item = _get_stock_item(db, item_id)
    if not item.is_active:
        raise ConflictError("Inaktiver Artikel kann nicht bearbeitet werden")

    name = _clean_name(data.name, field="Artikelname")
    if data.deposit_amount is not None and data.deposit_amount < Decimal("0"):
        raise ValidationError("Pfand muss >= 0 sein")
    category_id = _resolve_category(db, item.catalog_id, data.category_id)
    _assert_unique_item_name(db, item.catalog_id, category_id, name, exclude=item_id)
    _check_variant_batch(data.variants)

    item.name = name
    item.category_id = category_id
    item.deposit_amount = data.deposit_amount
    item.sort_order = data.sort_order

    existing = {v.id: v for v in item.variants}
    keep: set[int] = set()
    for v in data.variants:
        if v.id and v.id > 0 and v.id in existing:
            ev = existing[v.id]
            ev.name = _variant_name(v.name)
            ev.price = v.price
            ev.bill_steps = v.bill_steps
            keep.add(v.id)
        else:
            db.add(
                ItemVariant(
                    stock_item_id=item.id,
                    name=_variant_name(v.name),
                    price=v.price,
                    bill_steps=v.bill_steps,
                )
            )
    for vid, ev in existing.items():
        if vid not in keep:
            db.delete(ev)

    commit(db)
    db.refresh(item)
    return item


def delete_stock_item(db: Session, item_id: int) -> None:
    """Soft-Delete: is_active=False fuer Artikel und seine Varianten.
    Bons referenzieren die Varianten weiter (Snapshot bleibt korrekt)."""
    item = _get_stock_item(db, item_id)
    if not item.is_active:
        raise ConflictError("Artikel ist bereits inaktiv")
    item.is_active = False
    for variant in item.variants:
        variant.is_active = False
    commit(db)


def reorder_stock_items(
    db: Session, catalog_id: int, ordered_ids: list[int]
) -> list[StockItem]:
    get_catalog(db, catalog_id)
    if len(set(ordered_ids)) != len(ordered_ids):
        raise ValidationError("Doppelte IDs in der Reihenfolge")
    by_id = {
        s.id: s
        for s in db.scalars(
            select(StockItem).where(StockItem.catalog_id == catalog_id)
        )
    }
    missing = set(ordered_ids) - by_id.keys()
    if missing:
        raise NotFoundError(f"Artikel nicht in diesem Katalog: {sorted(missing)}")
    for index, sid in enumerate(ordered_ids):
        by_id[sid].sort_order = index
    commit(db)
    return list_stock_items(db, catalog_id, include_inactive=True)
