"""Stufe-2-Happy-Path: Katalog -> Veranstaltung -> Artikel -> aktive Bestellung -> Bon.

Belegt das Kern-Datenmodell end-to-end inkl. Preis-/Pfand-Snapshot im Bon.
Edge-Cases / Validierung kommen mit Stufe 3/4 (siehe TESTPLAN.md).
"""
from decimal import Decimal


def D(value) -> Decimal:
    return Decimal(str(value))


def test_happy_path(client):
    # --- Katalog + Kategorie + Artikel -----------------------------------
    catalog = client.post("/api/catalogs", json={"name": "Glühweinmeile"})
    assert catalog.status_code == 201
    cid = catalog.json()["id"]

    category = client.post(
        f"/api/catalogs/{cid}/categories",
        json={"name": "Warme Getränke", "icon": "MdCoffee", "sort_order": 0},
    )
    assert category.status_code == 201
    cat_id = category.json()["id"]

    item = client.post(
        f"/api/catalogs/{cid}/stock-items",
        json={
            "name": "Glühwein rot",
            "category_id": cat_id,
            "deposit_amount": "2.00",
            "variants": [{"name": "Tasse", "price": "4.50", "bill_steps": "1"}],
        },
    )
    assert item.status_code == 201, item.text
    variant_id = item.json()["variants"][0]["id"]

    # --- Veranstaltung anlegen + aktivieren -----------------------------
    event = client.post(
        "/api/events", json={"catalog_id": cid, "name": "Glühweinmeile Dez 2026"}
    )
    assert event.status_code == 201
    eid = event.json()["id"]

    activate = client.post(f"/api/events/{eid}/activate")
    assert activate.status_code == 200
    assert activate.json()["is_active"] is True

    # --- aktive Bestellung: 3x Glühwein per Zeilen-Delta ----------------
    for _ in range(3):
        resp = client.post(
            "/api/active-order/lines", json={"variant_id": variant_id, "delta": "1"}
        )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["lines"]) == 1
    assert body["lines"][0]["item_variant_id"] == variant_id
    assert D(body["lines"][0]["quantity"]) == D(3)
    assert D(body["total_gross"]) == D("13.50")
    assert D(body["total_deposit"]) == D("6.00")
    assert D(body["total_due"]) == D("19.50")

    # Delta -1
    resp = client.post(
        "/api/active-order/lines", json={"variant_id": variant_id, "delta": "-1"}
    )
    assert D(resp.json()["total_gross"]) == D("9.00")

    # --- Bon: Snapshot ------------------------------------------------------
    bill = client.post("/api/bills")
    assert bill.status_code == 201, bill.text
    b = bill.json()
    assert D(b["total_gross"]) == D("9.00")
    assert D(b["total_deposit"]) == D("4.00")
    assert len(b["items"]) == 1
    snap = b["items"][0]
    assert snap["item_name"] == "Glühwein rot"
    assert snap["variant_name"] == "Tasse"
    assert D(snap["unit_price"]) == D("4.50")
    assert D(snap["deposit_per_unit"]) == D("2.00")
    assert D(snap["quantity"]) == D(2)

    # aktive Bestellung ist nach dem Bon geleert, Datensatz bleibt
    after = client.get("/api/active-order")
    assert after.status_code == 200
    assert after.json()["lines"] == []


def test_only_one_event_active_at_a_time(client):
    catalog = client.post("/api/catalogs", json={"name": "K"}).json()
    e1 = client.post("/api/events", json={"catalog_id": catalog["id"], "name": "E1"}).json()
    e2 = client.post("/api/events", json={"catalog_id": catalog["id"], "name": "E2"}).json()

    client.post(f"/api/events/{e1['id']}/activate")
    client.post(f"/api/events/{e2['id']}/activate")

    assert client.get("/api/active-order").json()["event_id"] == e2["id"]
