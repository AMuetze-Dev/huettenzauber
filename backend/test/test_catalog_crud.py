"""Stufe 4 - Katalog/Kategorie/Artikel CRUD (v2-API)."""


def _mk_item(name="Cola", category_id=None, deposit="0", variants=None):
    return {
        "name": name,
        "category_id": category_id,
        "deposit_amount": deposit,
        "variants": variants or [{"name": "Standard", "price": "1.00"}],
    }


# --- Katalog ------------------------------------------------------------
def test_list_catalogs(client):
    assert client.get("/api/catalogs").json() == []
    client.post("/api/catalogs", json={"name": "A"})
    client.post("/api/catalogs", json={"name": "B"})
    names = [c["name"] for c in client.get("/api/catalogs").json()]
    assert names == ["A", "B"]


def test_get_catalog_404(client):
    assert client.get("/api/catalogs/9999").status_code == 404


def test_update_catalog(client, catalog_id):
    r = client.put(f"/api/catalogs/{catalog_id}", json={"name": "Neu"})
    assert r.status_code == 200 and r.json()["name"] == "Neu"


def test_update_catalog_duplicate(client, catalog_id):
    other = client.post("/api/catalogs", json={"name": "Zweiter"}).json()["id"]
    r = client.put(f"/api/catalogs/{other}", json={"name": "Testkatalog"})
    assert r.status_code == 409


def test_delete_catalog(client, catalog_id):
    assert client.delete(f"/api/catalogs/{catalog_id}").status_code == 204
    assert client.get(f"/api/catalogs/{catalog_id}").status_code == 404


def test_delete_catalog_with_event_blocked(client, catalog_id):
    client.post("/api/events", json={"catalog_id": catalog_id, "name": "E"})
    assert client.delete(f"/api/catalogs/{catalog_id}").status_code == 409


# --- Kategorie ---------------------------------------------------------
def test_category_list_and_update(client, catalog_id):
    cid = client.post(
        f"/api/catalogs/{catalog_id}/categories", json={"name": "Bier"}
    ).json()["id"]
    r = client.put(
        f"/api/categories/{cid}", json={"name": "Biere", "icon": "MdSportsBar", "sort_order": 3}
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Biere" and r.json()["sort_order"] == 3
    assert [c["name"] for c in client.get(f"/api/catalogs/{catalog_id}/categories").json()] == [
        "Biere"
    ]


def test_category_update_duplicate(client, catalog_id):
    client.post(f"/api/catalogs/{catalog_id}/categories", json={"name": "A"})
    b = client.post(f"/api/catalogs/{catalog_id}/categories", json={"name": "B"}).json()["id"]
    r = client.put(f"/api/categories/{b}", json={"name": "A", "icon": "X"})
    assert r.status_code == 409


def test_delete_category_nulls_item_category(client, catalog_id):
    cid = client.post(
        f"/api/catalogs/{catalog_id}/categories", json={"name": "Bier"}
    ).json()["id"]
    item = client.post(
        f"/api/catalogs/{catalog_id}/stock-items", json=_mk_item("Helles", cid)
    ).json()
    assert client.delete(f"/api/categories/{cid}").status_code == 204
    assert client.get(f"/api/stock-items/{item['id']}").json()["category_id"] is None


def test_reorder_categories(client, catalog_id):
    ids = [
        client.post(
            f"/api/catalogs/{catalog_id}/categories", json={"name": n}
        ).json()["id"]
        for n in ("A", "B", "C")
    ]
    r = client.put(
        f"/api/catalogs/{catalog_id}/categories/order",
        json={"ordered_ids": [ids[2], ids[0], ids[1]]},
    )
    assert r.status_code == 200
    assert [c["id"] for c in r.json()] == [ids[2], ids[0], ids[1]]


def test_reorder_categories_duplicate_ids(client, catalog_id):
    cid = client.post(
        f"/api/catalogs/{catalog_id}/categories", json={"name": "A"}
    ).json()["id"]
    r = client.put(
        f"/api/catalogs/{catalog_id}/categories/order", json={"ordered_ids": [cid, cid]}
    )
    assert r.status_code == 400


def test_reorder_categories_unknown_id(client, catalog_id):
    r = client.put(
        f"/api/catalogs/{catalog_id}/categories/order", json={"ordered_ids": [9999]}
    )
    assert r.status_code == 404


# --- Artikel ----------------------------------------------------------
def test_stock_item_list_active_only(client, catalog_id):
    a = client.post(f"/api/catalogs/{catalog_id}/stock-items", json=_mk_item("A")).json()
    client.post(f"/api/catalogs/{catalog_id}/stock-items", json=_mk_item("B"))
    client.delete(f"/api/stock-items/{a['id']}")
    active = client.get(f"/api/catalogs/{catalog_id}/stock-items").json()
    assert [i["name"] for i in active] == ["B"]
    allitems = client.get(
        f"/api/catalogs/{catalog_id}/stock-items?include_inactive=true"
    ).json()
    assert {i["name"] for i in allitems} == {"A", "B"}


def test_update_stock_item_keeps_id_and_edits_variants(client, catalog_id):
    created = client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json=_mk_item("Bier", variants=[{"name": "0,3 l", "price": "3.20"}]),
    ).json()
    item_id = created["id"]
    v0 = created["variants"][0]["id"]

    r = client.put(
        f"/api/stock-items/{item_id}",
        json={
            "name": "Bier hell",
            "deposit_amount": "0",
            "variants": [
                {"id": v0, "name": "0,3 l", "price": "3.50"},   # update
                {"name": "0,5 l", "price": "4.60"},              # neu
            ],
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == item_id  # stabile ID
    assert body["name"] == "Bier hell"
    prices = sorted(str(v["price"]) for v in body["variants"])
    assert prices == ["3.50", "4.60"]
    # v0 blieb dieselbe Zeile
    assert any(v["id"] == v0 and str(v["price"]) == "3.50" for v in body["variants"])


def test_update_stock_item_removes_missing_variant(client, catalog_id):
    created = client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json=_mk_item(
            "Pommes",
            variants=[
                {"name": "klein", "price": "3.50"},
                {"name": "groß", "price": "4.50"},
            ],
        ),
    ).json()
    keep = created["variants"][0]
    r = client.put(
        f"/api/stock-items/{created['id']}",
        json={"name": "Pommes", "deposit_amount": "0", "variants": [keep]},
    )
    assert r.status_code == 200
    assert len(r.json()["variants"]) == 1


def test_update_stock_item_inactive_blocked(client, catalog_id):
    item = client.post(
        f"/api/catalogs/{catalog_id}/stock-items", json=_mk_item("Weg")
    ).json()
    client.delete(f"/api/stock-items/{item['id']}")
    r = client.put(
        f"/api/stock-items/{item['id']}",
        json={"name": "Weg", "deposit_amount": "0", "variants": []},
    )
    assert r.status_code == 409


def test_update_stock_item_negative_price(client, catalog_id):
    item = client.post(
        f"/api/catalogs/{catalog_id}/stock-items", json=_mk_item("X")
    ).json()
    r = client.put(
        f"/api/stock-items/{item['id']}",
        json={
            "name": "X",
            "deposit_amount": "0",
            "variants": [{"name": "A", "price": "-1.00"}],
        },
    )
    assert r.status_code == 400


def test_delete_stock_item_soft(client, catalog_id):
    item = client.post(
        f"/api/catalogs/{catalog_id}/stock-items", json=_mk_item("Soft")
    ).json()
    assert client.delete(f"/api/stock-items/{item['id']}").status_code == 204
    got = client.get(f"/api/stock-items/{item['id']}")
    assert got.status_code == 200 and got.json()["is_active"] is False
    assert client.delete(f"/api/stock-items/{item['id']}").status_code == 409


def test_reorder_stock_items(client, catalog_id):
    ids = [
        client.post(
            f"/api/catalogs/{catalog_id}/stock-items", json=_mk_item(n)
        ).json()["id"]
        for n in ("A", "B", "C")
    ]
    r = client.put(
        f"/api/catalogs/{catalog_id}/stock-items/order",
        json={"ordered_ids": [ids[1], ids[2], ids[0]]},
    )
    assert r.status_code == 200
    assert [i["id"] for i in r.json()] == [ids[1], ids[2], ids[0]]
