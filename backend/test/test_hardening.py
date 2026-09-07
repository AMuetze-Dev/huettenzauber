"""Haertungen: frueher 500er oder stille Akzeptanz, jetzt saubere 4xx.

Diese Tests standen vorher als xfail in test_known_gaps.py.
"""
from decimal import Decimal

import pytest


def D(x):
    return Decimal(str(x))


# --- Betragsgrenzen statt DataError/500 ------------------------
def test_price_over_numeric_precision_is_400(client, catalog_id):
    r = client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json={
            "name": "Overflow",
            "category_id": None,
            "deposit_amount": "0",
            "variants": [{"name": "v", "price": "123456789.99"}],
        },
    )
    assert r.status_code == 400
    assert "hoechstens" in r.json()["detail"] or "höchstens" in r.json()["detail"]


def test_deposit_over_numeric_precision_is_400(client, catalog_id):
    r = client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json={
            "name": "OverflowDep",
            "category_id": None,
            "deposit_amount": "999999999.00",
            "variants": [{"name": "v", "price": "1.00"}],
        },
    )
    assert r.status_code == 400


def test_bill_steps_over_precision_is_400(client, catalog_id):
    r = client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json={
            "name": "OverflowSteps",
            "category_id": None,
            "deposit_amount": "0",
            "variants": [{"name": "v", "price": "1.00", "bill_steps": "99999999.999"}],
        },
    )
    assert r.status_code == 400


def test_huge_line_delta_is_400_not_500(client, active_event):
    _e, vid = active_event
    r = client.post(
        "/api/active-order/lines", json={"variant_id": vid, "delta": "99999999.999"}
    )
    assert r.status_code == 400


def test_deposit_return_amount_over_precision_is_400(client, active_event):
    r = client.put(
        "/api/active-order/deposit-return",
        json={"unit_amount": "123456789.00", "quantity": 1},
    )
    assert r.status_code == 400


def test_deposit_return_absurd_quantity_is_400(client, active_event):
    r = client.put(
        "/api/active-order/deposit-return",
        json={"unit_amount": "2.00", "quantity": 999999},
    )
    assert r.status_code == 400


# --- NUL-Bytes werden entfernt statt 500 -----------------------
def test_nul_byte_in_catalog_name_is_stripped(client):
    r = client.post("/api/catalogs", json={"name": "a\x00b"})
    assert r.status_code == 201
    assert r.json()["name"] == "ab"


def test_nul_byte_only_name_is_400(client):
    r = client.post("/api/catalogs", json={"name": "\x00\x00"})
    assert r.status_code == 400


def test_nul_byte_in_variant_name_is_stripped(client, catalog_id):
    r = client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json={
            "name": "NulVar",
            "category_id": None,
            "deposit_amount": "0",
            "variants": [{"name": "0,5\x00 l", "price": "1.00"}],
        },
    )
    assert r.status_code == 201
    assert r.json()["variants"][0]["name"] == "0,5 l"


# --- Bestellbarkeit wird geprueft ------------------------------
def test_line_delta_on_inactive_variant_is_rejected(client, catalog_id):
    cat = client.post(
        f"/api/catalogs/{catalog_id}/categories", json={"name": "K"}
    ).json()["id"]
    it = client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json={
            "name": "Weg",
            "category_id": cat,
            "deposit_amount": "0",
            "variants": [{"name": "v", "price": "1.00"}],
        },
    ).json()
    ev = client.post(
        "/api/events", json={"catalog_id": catalog_id, "name": "F"}
    ).json()["id"]
    client.post(f"/api/events/{ev}/activate")
    client.delete(f"/api/stock-items/{it['id']}")

    r = client.post(
        "/api/active-order/lines", json={"variant_id": it["variants"][0]["id"], "delta": "1"}
    )
    assert r.status_code == 409
    assert client.get("/api/active-order").json()["lines"] == []


def test_line_delta_with_foreign_catalog_variant_is_rejected(client, active_event):
    other = client.post("/api/catalogs", json={"name": "Fremd"}).json()["id"]
    cat = client.post(
        f"/api/catalogs/{other}/categories", json={"name": "K"}
    ).json()["id"]
    it = client.post(
        f"/api/catalogs/{other}/stock-items",
        json={
            "name": "Fremdartikel",
            "category_id": cat,
            "deposit_amount": "0",
            "variants": [{"name": "v", "price": "5.00"}],
        },
    ).json()

    r = client.post(
        "/api/active-order/lines",
        json={"variant_id": it["variants"][0]["id"], "delta": "1"},
    )
    assert r.status_code == 409
    assert client.get("/api/active-order").json()["lines"] == []


# --- sort_order darf nicht negativ sein ------------------------
@pytest.mark.parametrize("value", [-1, -99])
def test_negative_sort_order_rejected_category(client, catalog_id, value):
    r = client.post(
        f"/api/catalogs/{catalog_id}/categories",
        json={"name": f"Neg{value}", "sort_order": value},
    )
    assert r.status_code == 400


def test_negative_sort_order_rejected_item(client, catalog_id):
    r = client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json={
            "name": "Neg",
            "category_id": None,
            "deposit_amount": "0",
            "sort_order": -3,
            "variants": [],
        },
    )
    assert r.status_code == 400


# --- Reorder haelt sort_order lueckenlos + eindeutig -----------
def test_partial_reorder_keeps_sort_orders_unique_and_dense(client, catalog_id):
    ids = [
        client.post(
            f"/api/catalogs/{catalog_id}/categories", json={"name": n}
        ).json()["id"]
        for n in ("A", "B", "C", "D")
    ]
    client.put(
        f"/api/catalogs/{catalog_id}/categories/order",
        json={"ordered_ids": [ids[2], ids[0]]},
    )
    cats = client.get(f"/api/catalogs/{catalog_id}/categories").json()
    orders = [c["sort_order"] for c in cats]
    assert orders == [0, 1, 2, 3]
    assert [c["id"] for c in cats][:2] == [ids[2], ids[0]]


def test_full_reorder_is_dense(client, catalog_id):
    ids = [
        client.post(
            f"/api/catalogs/{catalog_id}/stock-items",
            json={
                "name": n,
                "category_id": None,
                "deposit_amount": "0",
                "variants": [],
            },
        ).json()["id"]
        for n in ("A", "B", "C")
    ]
    r = client.put(
        f"/api/catalogs/{catalog_id}/stock-items/order",
        json={"ordered_ids": [ids[2], ids[1], ids[0]]},
    )
    assert [i["sort_order"] for i in r.json()] == [0, 1, 2]
    assert [i["id"] for i in r.json()] == [ids[2], ids[1], ids[0]]


# --- Farbe -----------------------------------------------------
@pytest.mark.parametrize("color", ["#aabbcc", "#AABBCC", None, ""])
def test_valid_colors_accepted(client, catalog_id, color):
    r = client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json={
            "name": f"C{color}",
            "category_id": None,
            "deposit_amount": "0",
            "color": color,
            "variants": [],
        },
    )
    assert r.status_code == 201


@pytest.mark.parametrize("color", ["rot", "#fff", "#gggggg", "aabbcc", "#aabbccdd"])
def test_invalid_colors_rejected(client, catalog_id, color):
    r = client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json={
            "name": f"C{color}",
            "category_id": None,
            "deposit_amount": "0",
            "color": color,
            "variants": [],
        },
    )
    assert r.status_code == 400
