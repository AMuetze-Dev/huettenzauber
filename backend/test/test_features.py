"""Neue Features: Schnellzugriff, Katalog duplizieren, eigenstaendige
Pfandrueckgabe, Kassenschnitt, Health."""
from decimal import Decimal


def D(x):
    return Decimal(str(x))


def _item(client, catalog_id, name, *, cat=None, price="4.00", deposit="0", fav=False):
    return client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json={
            "name": name,
            "category_id": cat,
            "deposit_amount": deposit,
            "is_favorite": fav,
            "variants": [{"name": "Std", "price": price}],
        },
    ).json()


# --- Health ----------------------------------------------------
def test_health_reports_ok_and_db(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"
    assert body["access_code_required"] is False


def test_access_check_without_code_is_valid(client):
    r = client.get("/api/access-check")
    assert r.status_code == 200
    assert r.json() == {"required": False, "valid": True}


# --- Schnellzugriff -------------------------------------------
def test_favorite_flag_on_create_and_list(client, catalog_id):
    _item(client, catalog_id, "Normal")
    fav = _item(client, catalog_id, "Gluehwein", fav=True)
    favorites = client.get(f"/api/catalogs/{catalog_id}/favorites").json()
    assert [f["id"] for f in favorites] == [fav["id"]]
    assert favorites[0]["is_favorite"] is True


def test_favorite_toggle_endpoint(client, catalog_id):
    it = _item(client, catalog_id, "Bier")
    r = client.put(f"/api/stock-items/{it['id']}/favorite", json={"is_favorite": True})
    assert r.status_code == 200 and r.json()["is_favorite"] is True
    assert len(client.get(f"/api/catalogs/{catalog_id}/favorites").json()) == 1

    r = client.put(f"/api/stock-items/{it['id']}/favorite", json={"is_favorite": False})
    assert r.json()["is_favorite"] is False
    assert client.get(f"/api/catalogs/{catalog_id}/favorites").json() == []


def test_inactive_item_cannot_become_favorite(client, catalog_id):
    it = _item(client, catalog_id, "Weg")
    client.delete(f"/api/stock-items/{it['id']}")
    r = client.put(f"/api/stock-items/{it['id']}/favorite", json={"is_favorite": True})
    assert r.status_code == 409


def test_deleted_item_drops_out_of_favorites(client, catalog_id):
    it = _item(client, catalog_id, "Fav", fav=True)
    assert len(client.get(f"/api/catalogs/{catalog_id}/favorites").json()) == 1
    client.delete(f"/api/stock-items/{it['id']}")
    assert client.get(f"/api/catalogs/{catalog_id}/favorites").json() == []


def test_favorites_respect_sort_order(client, catalog_id):
    a = _item(client, catalog_id, "A", fav=True)
    b = _item(client, catalog_id, "B", fav=True)
    client.put(
        f"/api/catalogs/{catalog_id}/stock-items/order",
        json={"ordered_ids": [b["id"], a["id"]]},
    )
    favs = client.get(f"/api/catalogs/{catalog_id}/favorites").json()
    assert [f["id"] for f in favs] == [b["id"], a["id"]]


def test_update_keeps_favorite_and_color(client, catalog_id):
    it = _item(client, catalog_id, "X", fav=True)
    r = client.put(
        f"/api/stock-items/{it['id']}",
        json={
            "name": "X",
            "deposit_amount": "0",
            "is_favorite": True,
            "color": "#c8a875",
            "variants": [],
        },
    )
    assert r.json()["is_favorite"] is True
    assert r.json()["color"] == "#c8a875"


# --- Katalog duplizieren --------------------------------------
def test_duplicate_catalog_copies_structure(client, catalog_id):
    cat = client.post(
        f"/api/catalogs/{catalog_id}/categories", json={"name": "Warm", "icon": "MdX"}
    ).json()["id"]
    _item(client, catalog_id, "Gluehwein", cat=cat, price="4.50", deposit="2.00", fav=True)
    _item(client, catalog_id, "Kaffee", cat=cat, price="2.80")

    r = client.post(
        f"/api/catalogs/{catalog_id}/duplicate", json={"name": "Kopie 2027"}
    )
    assert r.status_code == 201
    new_id = r.json()["id"]
    assert new_id != catalog_id

    cats = client.get(f"/api/catalogs/{new_id}/categories").json()
    assert [c["name"] for c in cats] == ["Warm"]
    items = client.get(f"/api/catalogs/{new_id}/stock-items").json()
    assert {i["name"] for i in items} == {"Gluehwein", "Kaffee"}
    gl = next(i for i in items if i["name"] == "Gluehwein")
    assert D(gl["deposit_amount"]) == D("2.00")
    assert gl["is_favorite"] is True
    assert D(gl["variants"][0]["price"]) == D("4.50")
    # Kategorie der Kopie zeigt auf die KOPIE, nicht aufs Original
    assert gl["category_id"] == cats[0]["id"]


def test_duplicate_catalog_skips_inactive_items(client, catalog_id):
    keep = _item(client, catalog_id, "Bleibt")
    gone = _item(client, catalog_id, "Weg")
    client.delete(f"/api/stock-items/{gone['id']}")
    new_id = client.post(
        f"/api/catalogs/{catalog_id}/duplicate", json={"name": "Kopie"}
    ).json()["id"]
    names = {
        i["name"]
        for i in client.get(f"/api/catalogs/{new_id}/stock-items?include_inactive=true").json()
    }
    assert names == {"Bleibt"}
    assert keep["name"] in names


def test_duplicate_catalog_duplicate_name_conflict(client, catalog_id):
    assert (
        client.post(
            f"/api/catalogs/{catalog_id}/duplicate", json={"name": "Testkatalog"}
        ).status_code
        == 409
    )


def test_duplicate_catalog_not_found(client):
    assert (
        client.post("/api/catalogs/999999/duplicate", json={"name": "X"}).status_code
        == 404
    )


# --- Eigenstaendige Pfandrueckgabe ----------------------------
def test_standalone_deposit_return_roundtrip(client, active_event):
    r = client.post(
        "/api/deposit-returns", json={"unit_amount": "2.00", "quantity": 5}
    )
    assert r.status_code == 201
    body = r.json()
    assert body["bill_id"] is None
    assert D(body["total_amount"]) == D("10.00")

    rows = client.get("/api/deposit-returns").json()
    assert len(rows) == 1

    assert client.delete(f"/api/deposit-returns/{body['id']}").status_code == 204
    assert client.get("/api/deposit-returns").json() == []


def test_standalone_deposit_return_validation(client, active_event):
    assert (
        client.post(
            "/api/deposit-returns", json={"unit_amount": "0", "quantity": 5}
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/deposit-returns", json={"unit_amount": "2", "quantity": 0}
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/deposit-returns", json={"unit_amount": "-2", "quantity": 1}
        ).status_code
        == 400
    )


def test_bill_deposit_return_is_recorded_and_not_deletable(client, active_event):
    _e, vid = active_event
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "2"})
    client.put(
        "/api/active-order/deposit-return", json={"unit_amount": "2.00", "quantity": 3}
    )
    bill = client.post("/api/bills").json()

    rows = client.get("/api/deposit-returns").json()
    assert len(rows) == 1
    assert rows[0]["bill_id"] == bill["id"]
    assert D(rows[0]["total_amount"]) == D("6.00")
    # gehoert zum Bon -> nur ueber Storno
    assert client.delete(f"/api/deposit-returns/{rows[0]['id']}").status_code == 409


def test_deposit_returns_standalone_filter(client, active_event):
    _e, vid = active_event
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "1"})
    client.put(
        "/api/active-order/deposit-return", json={"unit_amount": "2.00", "quantity": 1}
    )
    client.post("/api/bills")
    client.post("/api/deposit-returns", json={"unit_amount": "2.00", "quantity": 2})

    assert len(client.get("/api/deposit-returns").json()) == 2
    only = client.get("/api/deposit-returns?standalone_only=true").json()
    assert len(only) == 1 and only[0]["bill_id"] is None


# --- Kassenschnitt --------------------------------------------
def test_cash_count_empty_day(client, active_event):
    r = client.get("/api/cash-count")
    assert r.status_code == 200
    b = r.json()
    assert b["bill_count"] == 0
    assert D(b["opening_float"]) == D(0)
    assert D(b["expected_cash"]) == D(0)
    assert b["counted_cash"] is None
    assert b["difference"] is None
    assert b["closed"] is False


def test_cash_float_is_stored_and_used(client, active_event):
    r = client.put("/api/cash-float", json={"amount": "200.00"})
    assert r.status_code == 200
    assert D(r.json()["opening_float"]) == D("200.00")
    assert D(r.json()["expected_cash"]) == D("200.00")


def test_cash_count_full_flow(client, active_event):
    _e, vid = active_event  # 4,60 ohne Pfand
    client.put("/api/cash-float", json={"amount": "100.00"})

    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "5"})
    client.post("/api/bills")  # 23,00 rein
    client.post("/api/deposit-returns", json={"unit_amount": "2.00", "quantity": 4})  # 8,00 raus

    b = client.get("/api/cash-count").json()
    assert b["bill_count"] == 1
    assert D(b["total_gross"]) == D("23.00")
    assert D(b["standalone_deposit_return"]) == D("8.00")
    assert D(b["cash_income"]) == D("15.00")  # 23 - 8
    assert D(b["expected_cash"]) == D("115.00")  # + Startgeld


def test_day_close_with_counted_cash_and_difference(client, active_event):
    _e, vid = active_event
    client.put("/api/cash-float", json={"amount": "50.00"})
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "1"})
    client.post("/api/bills")  # 4,60

    r = client.post("/api/day-close", json={"counted_cash": "54.10"})
    assert r.status_code == 200
    assert D(r.json()["opening_float"]) == D("50.00")
    assert D(r.json()["counted_cash"]) == D("54.10")

    cc = client.get("/api/cash-count").json()
    assert D(cc["expected_cash"]) == D("54.60")
    assert D(cc["difference"]) == D("-0.50")
    assert cc["closed"] is True


def test_day_close_without_counted_cash_leaves_difference_none(client, active_event):
    client.post("/api/day-close", json={})
    cc = client.get("/api/cash-count").json()
    assert cc["closed"] is True
    assert cc["counted_cash"] is None and cc["difference"] is None


def test_voided_bill_removed_from_cash_count(client, active_event):
    _e, vid = active_event
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "1"})
    bill = client.post("/api/bills").json()
    assert D(client.get("/api/cash-count").json()["cash_income"]) == D("4.60")
    client.post(f"/api/bills/{bill['id']}/void")
    assert D(client.get("/api/cash-count").json()["cash_income"]) == D(0)
