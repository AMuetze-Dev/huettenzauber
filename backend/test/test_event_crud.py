"""Stufe 4 - Veranstaltungs-CRUD (v2-API)."""


def _catalog(client) -> int:
    return client.post("/api/catalogs", json={"name": "K"}).json()["id"]


def test_list_and_get_event(client):
    cid = _catalog(client)
    e = client.post("/api/events", json={"catalog_id": cid, "name": "Fest 1"}).json()
    assert client.get(f"/api/events/{e['id']}").json()["name"] == "Fest 1"
    assert [x["id"] for x in client.get("/api/events").json()] == [e["id"]]


def test_get_event_404(client):
    assert client.get("/api/events/9999").status_code == 404


def test_active_event_204_then_event(client):
    cid = _catalog(client)
    assert client.get("/api/events/active").status_code == 204
    e = client.post("/api/events", json={"catalog_id": cid, "name": "F"}).json()
    client.post(f"/api/events/{e['id']}/activate")
    r = client.get("/api/events/active")
    assert r.status_code == 200 and r.json()["id"] == e["id"]


def test_update_event_rename(client):
    cid = _catalog(client)
    e = client.post("/api/events", json={"catalog_id": cid, "name": "Alt"}).json()
    r = client.put(f"/api/events/{e['id']}", json={"name": "Neu"})
    assert r.status_code == 200 and r.json()["name"] == "Neu"


def test_update_event_empty_name(client):
    cid = _catalog(client)
    e = client.post("/api/events", json={"catalog_id": cid, "name": "Alt"}).json()
    assert client.put(f"/api/events/{e['id']}", json={"name": "  "}).status_code == 400


def test_archive_event(client):
    cid = _catalog(client)
    e = client.post("/api/events", json={"catalog_id": cid, "name": "F"}).json()
    client.post(f"/api/events/{e['id']}/activate")
    r = client.post(f"/api/events/{e['id']}/archive")
    assert r.status_code == 200
    assert r.json()["is_active"] is False and r.json()["ended_at"] is not None
    assert client.get("/api/events/active").status_code == 204


def test_activate_archived_event_blocked(client):
    cid = _catalog(client)
    e = client.post("/api/events", json={"catalog_id": cid, "name": "F"}).json()
    client.post(f"/api/events/{e['id']}/archive")
    assert client.post(f"/api/events/{e['id']}/activate").status_code == 409


def test_activate_switches_active_event(client):
    cid = _catalog(client)
    e1 = client.post("/api/events", json={"catalog_id": cid, "name": "E1"}).json()
    e2 = client.post("/api/events", json={"catalog_id": cid, "name": "E2"}).json()
    client.post(f"/api/events/{e1['id']}/activate")
    client.post(f"/api/events/{e2['id']}/activate")
    assert client.get(f"/api/events/{e1['id']}").json()["is_active"] is False
    assert client.get(f"/api/events/{e2['id']}").json()["is_active"] is True


def test_delete_event(client):
    cid = _catalog(client)
    e = client.post("/api/events", json={"catalog_id": cid, "name": "F"}).json()
    assert client.delete(f"/api/events/{e['id']}").status_code == 204
    assert client.get(f"/api/events/{e['id']}").status_code == 404


def test_delete_event_with_bill_blocked(client):
    cid = client.post("/api/catalogs", json={"name": "K"}).json()["id"]
    cat = client.post(
        f"/api/catalogs/{cid}/categories", json={"name": "G"}
    ).json()["id"]
    item = client.post(
        f"/api/catalogs/{cid}/stock-items",
        json={
            "name": "Bier",
            "category_id": cat,
            "deposit_amount": "0",
            "variants": [{"name": "0,5 l", "price": "4.60"}],
        },
    ).json()
    e = client.post("/api/events", json={"catalog_id": cid, "name": "F"}).json()
    client.post(f"/api/events/{e['id']}/activate")
    client.post(
        "/api/active-order/lines",
        json={"variant_id": item["variants"][0]["id"], "delta": "1"},
    )
    client.post("/api/bills")
    assert client.delete(f"/api/events/{e['id']}").status_code == 409
