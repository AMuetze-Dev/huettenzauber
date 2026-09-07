"""Stufe 3 - Fehlermodell fuer Veranstaltung / aktive Bestellung / Bon."""


# --- Veranstaltung -----------------------------------------------------
def test_create_event_catalog_not_found(client):
    assert client.post("/api/events", json={"catalog_id": 9999, "name": "X"}).status_code == 404


def test_create_event_empty_name(client, catalog_id):
    r = client.post("/api/events", json={"catalog_id": catalog_id, "name": " "})
    assert r.status_code == 400


def test_activate_event_not_found(client):
    assert client.post("/api/events/9999/activate").status_code == 404


# --- aktive Bestellung ohne aktive Veranstaltung ---------------------
def test_get_active_order_without_active_event(client):
    r = client.get("/api/active-order")
    assert r.status_code == 409
    assert "aktive Veranstaltung" in r.json()["detail"]


def test_line_delta_without_active_event(client):
    r = client.post("/api/active-order/lines", json={"variant_id": 1, "delta": "1"})
    assert r.status_code == 409


def test_bill_without_active_event(client):
    assert client.post("/api/bills").status_code == 409


# --- aktive Bestellung mit aktiver Veranstaltung --------------------
def test_line_delta_unknown_variant(client, active_event):
    r = client.post("/api/active-order/lines", json={"variant_id": 999999, "delta": "1"})
    assert r.status_code == 404
    # keine Zeile angelegt
    assert client.get("/api/active-order").json()["lines"] == []


def test_bill_with_empty_active_order(client, active_event):
    r = client.post("/api/bills")
    assert r.status_code == 400
    assert "Keine Positionen" in r.json()["detail"]


def test_line_delta_below_zero_removes_line(client, active_event):
    _event_id, variant_id = active_event
    client.post("/api/active-order/lines", json={"variant_id": variant_id, "delta": "2"})
    r = client.post("/api/active-order/lines", json={"variant_id": variant_id, "delta": "-5"})
    assert r.status_code == 200
    assert r.json()["lines"] == []


def test_deposit_shows_up_in_totals(client, catalog_id):
    cat = client.post(
        f"/api/catalogs/{catalog_id}/categories", json={"name": "Warm"}
    ).json()["id"]
    item = client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json={
            "name": "Glühwein",
            "category_id": cat,
            "deposit_amount": "2.00",
            "variants": [{"name": "Tasse", "price": "4.50"}],
        },
    ).json()
    ev = client.post(
        "/api/events", json={"catalog_id": catalog_id, "name": "F"}
    ).json()["id"]
    client.post(f"/api/events/{ev}/activate")
    vid = item["variants"][0]["id"]
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "2"})
    body = client.get("/api/active-order").json()
    assert body["total_gross"] == "9.00" or float(body["total_gross"]) == 9.0
    assert float(body["total_deposit"]) == 4.0
    assert float(body["total_due"]) == 13.0
