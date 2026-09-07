"""Zwei Eingabepunkte auf einem Warenkorb.

Am Ausschank tippt das 10"-Terminal, gleichzeitig haengt ein Handy im Hotspot.
Beide schicken Deltas auf dieselbe Bestellung. Diese Tests laufen bewusst
NICHT in der Aussentransaktion der ueblichen Fixtures - zwei echte
Verbindungen sind der ganze Punkt - und raeumen ihre Daten selbst weg.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from models import (
    ActiveOrder,
    ActiveOrderLine,
    Catalog,
    Event,
    ItemVariant,
    StockItem,
)
from order.service import apply_delta


def D(x) -> Decimal:
    return Decimal(str(x))


@pytest.fixture
def committed_order(engine):
    """Katalog + Artikel + (inaktive) Veranstaltung mit leerer Bestellung,
    echt committet. Die Veranstaltung bleibt inaktiv, damit sie keinem
    anderen Test die aktive Veranstaltung wegnimmt."""
    with Session(engine) as s:
        catalog = Catalog(name="Nebenlaeufig-Testkatalog")
        s.add(catalog)
        s.flush()
        item = StockItem(
            catalog_id=catalog.id, name="Helles", deposit_amount=D("2.00")
        )
        s.add(item)
        s.flush()
        variant = ItemVariant(stock_item_id=item.id, name="0,5 l", price=D("4.60"))
        s.add(variant)
        event = Event(catalog_id=catalog.id, name="Nebenlaeufig", is_active=False)
        s.add(event)
        s.flush()
        s.add(ActiveOrder(event_id=event.id))
        s.commit()
        ids = (event.id, variant.id, item.id, catalog.id)

    yield ids

    event_id, _variant_id, item_id, catalog_id = ids
    with Session(engine) as s:
        s.query(ActiveOrderLine).filter_by(event_id=event_id).delete()
        s.query(ActiveOrder).filter_by(event_id=event_id).delete()
        s.query(Event).filter_by(id=event_id).delete()
        s.query(ItemVariant).filter_by(stock_item_id=item_id).delete()
        s.query(StockItem).filter_by(id=item_id).delete()
        s.query(Catalog).filter_by(id=catalog_id).delete()
        s.commit()


def _qty(engine, event_id: int, variant_id: int) -> Decimal:
    with Session(engine) as s:
        row = (
            s.query(ActiveOrderLine)
            .filter_by(event_id=event_id, item_variant_id=variant_id)
            .one_or_none()
        )
        return D(0) if row is None else row.quantity


def _delta(engine, event_id: int, variant_id: int, delta: str) -> None:
    with Session(engine) as s:
        apply_delta(s, event_id, variant_id, D(delta))


def test_parallel_first_taps_do_not_collide(committed_order, engine):
    """Beide Geraete legen dieselbe Position zeitgleich neu an. Frueher gewann
    einer und der andere bekam 409 'Integritaetsverletzung'."""
    event_id, variant_id, _i, _c = committed_order

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(
            pool.map(
                lambda _: _delta(engine, event_id, variant_id, "1"),
                range(8),
            )
        )

    assert len(results) == 8
    assert _qty(engine, event_id, variant_id) == D(8)


def test_parallel_increments_lose_nothing(committed_order, engine):
    """Read-Modify-Write in Python wuerde hier Deltas verschlucken."""
    event_id, variant_id, _i, _c = committed_order
    _delta(engine, event_id, variant_id, "1")

    with ThreadPoolExecutor(max_workers=10) as pool:
        list(pool.map(lambda _: _delta(engine, event_id, variant_id, "2"), range(10)))

    assert _qty(engine, event_id, variant_id) == D(21)


def test_parallel_plus_and_minus_settle_exactly(committed_order, engine):
    event_id, variant_id, _i, _c = committed_order
    _delta(engine, event_id, variant_id, "20")

    steps = ["1"] * 6 + ["-1"] * 6
    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(lambda d: _delta(engine, event_id, variant_id, d), steps))

    assert _qty(engine, event_id, variant_id) == D(20)


def test_minus_on_missing_line_leaves_no_row(committed_order, engine):
    """Ein Minus-Delta darf keine Zeile erfinden - auch nicht kurzzeitig."""
    event_id, variant_id, _i, _c = committed_order

    _delta(engine, event_id, variant_id, "-3")

    with Session(engine) as s:
        assert (
            s.query(ActiveOrderLine).filter_by(event_id=event_id).count() == 0
        )


def test_over_subtracting_removes_the_line(committed_order, engine):
    event_id, variant_id, _i, _c = committed_order
    _delta(engine, event_id, variant_id, "2")

    _delta(engine, event_id, variant_id, "-5")

    assert _qty(engine, event_id, variant_id) == D(0)
    with Session(engine) as s:
        assert s.query(ActiveOrderLine).filter_by(event_id=event_id).count() == 0


def test_exact_zero_removes_the_line(committed_order, engine):
    event_id, variant_id, _i, _c = committed_order
    _delta(engine, event_id, variant_id, "3")

    _delta(engine, event_id, variant_id, "-3")

    with Session(engine) as s:
        assert s.query(ActiveOrderLine).filter_by(event_id=event_id).count() == 0


def test_fractional_deltas_accumulate_exactly(committed_order, engine):
    """Geld/Mengen sind NUMERIC - 0.1 dreimal muss glatt 0.3 ergeben."""
    event_id, variant_id, _i, _c = committed_order

    for _ in range(3):
        _delta(engine, event_id, variant_id, "0.1")

    assert _qty(engine, event_id, variant_id) == D("0.3")
