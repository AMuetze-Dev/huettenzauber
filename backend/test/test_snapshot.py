"""D2: der Bon friert Preis/Pfand/Namen ein - spätere Katalog-Änderungen
ändern weder Bon noch Statistik."""
from decimal import Decimal


def D(x):
    return Decimal(str(x))


def _setup(client, deposit="2.00", price="4.50"):
    cid = client.post("/api/catalogs", json={"name": "Snap"}).json()["id"]
    cat = client.post(
        f"/api/catalogs/{cid}/categories", json={"name": "Warm"}
    ).json()["id"]
    item = client.post(
        f"/api/catalogs/{cid}/stock-items",
        json={
            "name": "Glühwein",
            "category_id": cat,
            "deposit_amount": deposit,
            "variants": [{"name": "Tasse", "price": price}],
        },
    ).json()
    ev = client.post("/api/events", json={"catalog_id": cid, "name": "F"}).json()["id"]
    client.post(f"/api/events/{ev}/activate")
    return cid, cat, item, item["variants"][0]["id"]


def test_bill_snapshot_frozen_on_price_change(client):
    _cid, _cat, item, vid = _setup(client, deposit="2.00", price="4.50")
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "2"})
    bill_id = client.post("/api/bills").json()["id"]

    # Preis + Pfand nachträglich ändern
    r = client.put(
        f"/api/stock-items/{item['id']}",
        json={
            "name": "Glühwein",
            "deposit_amount": "3.00",
            "variants": [{"id": vid, "name": "Tasse", "price": "9.99"}],
        },
    )
    assert r.status_code == 200

    bill = client.get(f"/api/bills/{bill_id}").json()
    snap = bill["items"][0]
    assert D(snap["unit_price"]) == D("4.50")
    assert D(snap["deposit_per_unit"]) == D("2.00")
    assert snap["item_name"] == "Glühwein"
    assert snap["variant_name"] == "Tasse"
    assert D(bill["total_gross"]) == D("9.00")
    assert D(bill["total_deposit"]) == D("4.00")


def test_statistics_use_bill_snapshot_not_current_price(client):
    _cid, _cat, item, vid = _setup(client, deposit="0", price="4.00")
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "3"})
    client.post("/api/bills")

    client.put(
        f"/api/stock-items/{item['id']}",
        json={
            "name": "Glühwein",
            "deposit_amount": "0",
            "variants": [{"id": vid, "name": "Tasse", "price": "99.00"}],
        },
    )

    stats = client.get("/api/statistics").json()
    row = stats["consumption"][0]
    assert D(row["quantity"]) == D(3)
    assert D(row["revenue"]) == D("12.00")  # 3 * 4,00, nicht 3 * 99
    assert D(stats["total_gross"]) == D("12.00")


def test_bill_readable_after_item_soft_deleted(client):
    _cid, _cat, item, vid = _setup(client, deposit="0", price="4.00")
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "1"})
    bill_id = client.post("/api/bills").json()["id"]

    assert client.delete(f"/api/stock-items/{item['id']}").status_code == 204

    bill = client.get(f"/api/bills/{bill_id}")
    assert bill.status_code == 200
    assert bill.json()["items"][0]["item_name"] == "Glühwein"


def test_bill_readable_after_category_deleted(client):
    _cid, cat, item, vid = _setup(client, deposit="0", price="4.00")
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "1"})
    bill_id = client.post("/api/bills").json()["id"]

    assert client.delete(f"/api/categories/{cat}").status_code == 204

    assert client.get(f"/api/bills/{bill_id}").status_code == 200


def test_bill_variant_name_null_when_variant_unnamed(client):
    cid = client.post("/api/catalogs", json={"name": "N"}).json()["id"]
    cat = client.post(f"/api/catalogs/{cid}/categories", json={"name": "K"}).json()["id"]
    item = client.post(
        f"/api/catalogs/{cid}/stock-items",
        json={
            "name": "Kaffee",
            "category_id": cat,
            "deposit_amount": "0",
            "variants": [{"price": "2.80"}],
        },
    ).json()
    ev = client.post("/api/events", json={"catalog_id": cid, "name": "F"}).json()["id"]
    client.post(f"/api/events/{ev}/activate")
    vid = item["variants"][0]["id"]
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "1"})
    bill = client.post("/api/bills").json()
    assert bill["items"][0]["variant_name"] is None
    assert bill["items"][0]["item_name"] == "Kaffee"
