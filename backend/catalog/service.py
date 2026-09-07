"""Katalog-Slice: Katalog / Kategorie / Artikel(+Varianten) - CRUD.

Frameworkfrei - importiert nur models, schemas, core.*, sqlalchemy.
Katalog-Mutation ist In-Place (stabile IDs), `is_active` ist echtes Soft-Delete.
"""
from __future__ import annotations

from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

import re

from core.db import commit
from core.exceptions import ConflictError, NotFoundError, ValidationError
from core.money import check_money, check_qty, clean_text
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
_HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


def _clean_name(value: str, *, field: str = "Name", max_len: int = NAME_MAX) -> str:
    text = clean_text(value or "").strip()
    if not text:
        raise ValidationError(f"{field} darf nicht leer sein")
    if len(text) > max_len:
        raise ValidationError(f"{field} darf höchstens {max_len} Zeichen haben")
    return text


def _variant_name(value: str | None) -> str | None:
    text = clean_text(value or "").strip()
    return text or None


def _check_sort_order(value: int) -> int:
    if value < 0:
        raise ValidationError("Sortierreihenfolge darf nicht negativ sein")
    return value


def _next_sort_order(db: Session, model, catalog_id: int) -> int:
    """Neu Angelegtes hinten anhaengen. Ohne das landet jedes neue Element auf
    0 und draengelt sich beim Bedienterminal vor die eingespielte Reihenfolge."""
    highest = db.scalar(
        select(func.max(model.sort_order)).where(model.catalog_id == catalog_id)
    )
    return 0 if highest is None else highest + 1


def _clean_color(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    color = value.strip()
    if not _HEX_COLOR.match(color):
        raise ValidationError("Farbe muss im Format #rrggbb angegeben werden")
    return color.lower()


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
        catalog_id=catalog_id,
        name=name,
        icon=icon,
        sort_order=_check_sort_order(data.sort_order)
        or _next_sort_order(db, Category, catalog_id),
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
    if data.sort_order is not None:
        category.sort_order = _check_sort_order(data.sort_order)
    commit(db, on_conflict="Kategorie mit diesem Namen existiert bereits in diesem Katalog")
    db.refresh(category)
    return category


def delete_category(db: Session, category_id: int) -> None:
    """Loeschen der Kategorie. Artikel behalten den Katalog, category_id -> NULL
    (FK ondelete=SET NULL) und sind danach im Bereich 'ohne Kategorie'."""
    category = _get_category(db, category_id)
    db.delete(category)
    commit(db)


def _apply_order(rows: list, ordered_ids: list[int], label: str) -> None:
    """Setzt sort_order lueckenlos 0..n-1: erst die genannten IDs in der
    angegebenen Reihenfolge, dann der Rest in bisheriger Reihenfolge.
    So bleiben die Werte immer eindeutig."""
    if len(set(ordered_ids)) != len(ordered_ids):
        raise ValidationError("Doppelte IDs in der Reihenfolge")
    by_id = {r.id: r for r in rows}
    missing = set(ordered_ids) - by_id.keys()
    if missing:
        raise NotFoundError(f"{label} nicht in diesem Katalog: {sorted(missing)}")

    named = set(ordered_ids)
    rest = [r for r in rows if r.id not in named]
    for index, cid in enumerate(ordered_ids):
        by_id[cid].sort_order = index
    for offset, row in enumerate(rest, start=len(ordered_ids)):
        row.sort_order = offset


def reorder_categories(db: Session, catalog_id: int, ordered_ids: list[int]) -> list[Category]:
    get_catalog(db, catalog_id)
    rows = list_categories(db, catalog_id)
    _apply_order(rows, ordered_ids, "Kategorien")
    commit(db)
    return list_categories(db, catalog_id)


# --- Artikel + Varianten --------------------------------------------
def _validate_variant(v: VariantCreate | VariantUpsert) -> None:
    check_money(v.price, field="Preis")
    check_qty(v.bill_steps, field="Rechenschritt (bill_steps)", positive=True)


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
    check_money(data.deposit_amount, field="Pfand")
    color = _clean_color(data.color)
    category_id = _resolve_category(db, catalog_id, data.category_id)
    _assert_unique_item_name(db, catalog_id, category_id, name, exclude=None)
    _check_variant_batch(data.variants)

    item = StockItem(
        catalog_id=catalog_id,
        category_id=category_id,
        name=name,
        deposit_amount=data.deposit_amount,
        sort_order=_check_sort_order(data.sort_order)
        or _next_sort_order(db, StockItem, catalog_id),
        is_favorite=data.is_favorite,
        color=color,
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
    check_money(data.deposit_amount, field="Pfand")
    color = _clean_color(data.color)
    category_id = _resolve_category(db, item.catalog_id, data.category_id)
    _assert_unique_item_name(db, item.catalog_id, category_id, name, exclude=item_id)
    _check_variant_batch(data.variants)

    item.name = name
    item.category_id = category_id
    item.deposit_amount = data.deposit_amount
    # Ohne Angabe bleibt die Position: sonst springt ein Artikel bei jeder
    # Preisaenderung an den Anfang der Kachelwand.
    if data.sort_order is not None:
        item.sort_order = _check_sort_order(data.sort_order)
    item.is_favorite = data.is_favorite
    item.color = color

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
    rows = list_stock_items(db, catalog_id, include_inactive=True)
    _apply_order(rows, ordered_ids, "Artikel")
    commit(db)
    return list_stock_items(db, catalog_id, include_inactive=True)


def set_favorite(db: Session, item_id: int, is_favorite: bool) -> StockItem:
    item = _get_stock_item(db, item_id)
    if not item.is_active and is_favorite:
        raise ConflictError("Inaktiver Artikel kann kein Schnellzugriff sein")
    item.is_favorite = is_favorite
    commit(db)
    db.refresh(item)
    return item


def list_favorites(db: Session, catalog_id: int) -> list[StockItem]:
    get_catalog(db, catalog_id)
    return list(
        db.scalars(
            select(StockItem)
            .where(
                StockItem.catalog_id == catalog_id,
                StockItem.is_active.is_(True),
                StockItem.is_favorite.is_(True),
            )
            .order_by(StockItem.sort_order, StockItem.id)
        )
    )


def duplicate_catalog(db: Session, catalog_id: int, new_name: str) -> Catalog:
    """Kopiert Katalog inkl. Kategorien, Artikel und Varianten.
    Bons bleiben beim Original - die Kopie startet ohne Historie."""
    source = get_catalog(db, catalog_id)
    name = _clean_name(new_name, field="Katalogname", max_len=CATALOG_NAME_MAX)
    if db.scalars(select(Catalog).where(Catalog.name == name)).first():
        raise ConflictError("Katalog mit diesem Namen existiert bereits")

    copy = Catalog(name=name)
    db.add(copy)
    db.flush()

    cat_map: dict[int, int] = {}
    for cat in list_categories(db, source.id):
        new_cat = Category(
            catalog_id=copy.id,
            name=cat.name,
            icon=cat.icon,
            sort_order=cat.sort_order,
        )
        db.add(new_cat)
        db.flush()
        cat_map[cat.id] = new_cat.id

    for item in list_stock_items(db, source.id, include_inactive=False):
        db.add(
            StockItem(
                catalog_id=copy.id,
                category_id=cat_map.get(item.category_id) if item.category_id else None,
                name=item.name,
                deposit_amount=item.deposit_amount,
                sort_order=item.sort_order,
                is_favorite=item.is_favorite,
                color=item.color,
                variants=[
                    ItemVariant(
                        name=v.name, price=v.price, bill_steps=v.bill_steps
                    )
                    for v in item.variants
                    if v.is_active
                ],
            )
        )

    commit(db, on_conflict="Katalog mit diesem Namen existiert bereits")
    db.refresh(copy)
    return copy
