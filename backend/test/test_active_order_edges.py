"""Randfälle aktive Bestellung + Pfandrückgabe."""
from decimal import Decimal

import pytest


def D(x):
    return Decimal(str(x))


def _delta(client, vid, d):
    return client.post("/api/active-order/lines", json={"variant_id": vid, "delta": str(d)})


# --- ohne aktive Veranstaltung -> 409 --------------------------
@pytest.mark.parametrize(
    "method,path,body",
    [
        ("get", "/api/active-order", None),
        ("post", "/api/active-order/lines", {"variant_id": 1, "delta": "1"}),
        ("put", "/api/active-order/deposit-return", {"unit_amount": "2", "quantity": 1}),
        ("post", "/api/bills", None),
        ("get", "/api/active-order/stream", None),
        ("get", "/api/day-summary", None),
        ("get", "/api/statistics", None),
    ],
)
def test_requires_active_event(client, method, path, body):
    fn = getattr(client, method)
    r = fn(path, json=body) if body is not None else fn(path)
    assert r.status_code == 409


# --- Zeilen-Delta ---------------------------------------------
def test_delta_zero_is_noop(client, active_event):
    _e, vid = active_event
    r = _delta(client, vid, 0)
    assert r.status_code == 200
    assert r.json()["lines"] == []


def test_delta_zero_on_existing_line_keeps_it(client, active_event):
    _e, vid = active_event
    _delta(client, vid, 2)
    r = _delta(client, vid, 0)
    assert D(r.json()["lines"][0]["quantity"]) == D(2)


def test_delta_unknown_variant_404_no_line(client, active_event):
    r = _delta(client, 987654, 1)
    assert r.status_code == 404
    assert client.get("/api/active-order").json()["lines"] == []


def test_delta_negative_on_missing_line_is_noop(client, active_event):
    _e, vid = active_event
    r = _delta(client, vid, -3)
    assert r.status_code == 200 and r.json()["lines"] == []


def test_delta_accumulates(client, active_event):
    _e, vid = active_event
    _delta(client, vid, 1)
    _delta(client, vid, 1)
    _delta(client, vid, 3)
    assert D(client.get("/api/active-order").json()["lines"][0]["quantity"]) == D(5)


def test_delta_fractional_quantity(client, active_event):
    _e, vid = active_event
    r = _delta(client, vid, "0.5")
    assert D(r.json()["lines"][0]["quantity"]) == D("0.5")


def test_delta_removes_line_at_zero_and_below(client, active_event):
    _e, vid = active_event
    _delta(client, vid, 2)
    r = _delta(client, vid, -2)
    assert r.json()["lines"] == []
    r = _delta(client, vid, 1)
    r = _delta(client, vid, -5)
    assert r.json()["lines"] == []


def test_delta_large_quantity(client, active_event):
    _e, vid = active_event
    r = _delta(client, vid, "100000")
    assert D(r.json()["lines"][0]["quantity"]) == D(100000)


def test_delta_string_type_rejected(client, active_event):
    _e, vid = active_event
    r = client.post(
        "/api/active-order/lines", json={"variant_id": vid, "delta": "abc"}
    )
    assert r.status_code == 422


def test_multiple_variants_tracked_separately(client, catalog_id):
    cat = client.post(
        f"/api/catalogs/{catalog_id}/categories", json={"name": "K"}
    ).json()["id"]
    it = client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json={
            "name": "Bier",
            "category_id": cat,
            "deposit_amount": "0",
            "variants": [{"name": "0,3", "price": "3.00"}, {"name": "0,5", "price": "4.00"}],
        },
    ).json()
    ev = client.post(
        "/api/events", json={"catalog_id": catalog_id, "name": "F"}
    ).json()["id"]
    client.post(f"/api/events/{ev}/activate")
    v0, v1 = it["variants"][0]["id"], it["variants"][1]["id"]
    _delta(client, v0, 2)
    _delta(client, v1, 3)
    body = client.get("/api/active-order").json()
    qmap = {l["item_variant_id"]: D(l["quantity"]) for l in body["lines"]}
    assert qmap == {v0: D(2), v1: D(3)}
    assert D(body["total_gross"]) == D("18.00")  # 2*3 + 3*4


# --- Pfandrückgabe -----------------------------------------
def test_deposit_return_negative_unit_rejected(client, active_event):
    assert (
        client.put(
            "/api/active-order/deposit-return", json={"unit_amount": "-1", "quantity": 2}
        ).status_code
        == 400
    )


def test_deposit_return_negative_qty_rejected(client, active_event):
    assert (
        client.put(
            "/api/active-order/deposit-return", json={"unit_amount": "2", "quantity": -1}
        ).status_code
        == 400
    )


def test_deposit_return_zero_qty_clears(client, active_event):
    client.put(
        "/api/active-order/deposit-return", json={"unit_amount": "2", "quantity": 3}
    )
    r = client.put(
        "/api/active-order/deposit-return", json={"unit_amount": "2", "quantity": 0}
    )
    assert r.json()["deposit_returns"] == []
    assert D(r.json()["deposit_return_total"]) == D(0)


def test_deposit_return_zero_unit_is_not_stored(client, active_event):
    """Betrag 0 ist keine Rueckgabe - und ruehrt die anderen Sorten nicht an."""
    client.put(
        "/api/active-order/deposit-return", json={"unit_amount": "2", "quantity": 3}
    )
    r = client.put(
        "/api/active-order/deposit-return", json={"unit_amount": "0", "quantity": 3}
    )
    assert [e["unit_amount"] for e in r.json()["deposit_returns"]] == ["2.00"]


def test_deposit_return_persists_across_line_delta(client, active_event):
    _e, vid = active_event
    client.put(
        "/api/active-order/deposit-return", json={"unit_amount": "2", "quantity": 4}
    )
    _delta(client, vid, 1)
    body = client.get("/api/active-order").json()
    assert body["deposit_returns"][0]["quantity"] == 4
    assert D(body["deposit_return_total"]) == D("8.00")


def test_deposit_return_clamps_total_due_at_zero(client, active_event):
    _e, vid = active_event  # Helles 4,60, kein Pfand
    _delta(client, vid, 1)
    r = client.put(
        "/api/active-order/deposit-return", json={"unit_amount": "5", "quantity": 10}
    )
    assert D(r.json()["total_due"]) == D(0)


def test_deposit_return_fractional_unit(client, active_event):
    r = client.put(
        "/api/active-order/deposit-return", json={"unit_amount": "1.50", "quantity": 3}
    )
    assert D(r.json()["deposit_return_total"]) == D("4.50")


def test_deposit_return_money_two_decimals(client, active_event):
    r = client.put(
        "/api/active-order/deposit-return", json={"unit_amount": "2", "quantity": 3}
    )
    # Serialisierung: 2 Nachkommastellen, keine 5-Stellen-Numeric
    assert r.json()["deposit_return_total"] in ("6.00", "6.0", "6")
