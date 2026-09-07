"""Stufe 3 - Fehlermodell fuer den Katalog-Slice (TESTPLAN.md §4.1 / §4.2)."""


def test_create_catalog_empty_name(client):
    assert client.post("/api/catalogs", json={"name": ""}).status_code == 400


def test_create_catalog_whitespace_name(client):
    assert client.post("/api/catalogs", json={"name": "   "}).status_code == 400


def test_create_catalog_too_long(client):
    assert client.post("/api/catalogs", json={"name": "A" * 81}).status_code == 400


def test_create_catalog_duplicate(client):
    client.post("/api/catalogs", json={"name": "Glühweinmeile"})
    r = client.post("/api/catalogs", json={"name": "Glühweinmeile"})
    assert r.status_code == 409
    assert "existiert bereits" in r.json()["detail"]


def test_add_category_catalog_not_found(client):
    assert client.post("/api/catalogs/9999/categories", json={"name": "X"}).status_code == 404


def test_add_category_empty_name(client, catalog_id):
    assert (
        client.post(f"/api/catalogs/{catalog_id}/categories", json={"name": " "}).status_code
        == 400
    )


def test_add_category_duplicate_in_catalog(client, catalog_id):
    client.post(f"/api/catalogs/{catalog_id}/categories", json={"name": "Bier"})
    r = client.post(f"/api/catalogs/{catalog_id}/categories", json={"name": "Bier"})
    assert r.status_code == 409


def test_same_category_name_in_different_catalog_ok(client, catalog_id):
    other = client.post("/api/catalogs", json={"name": "Zweiter"}).json()["id"]
    client.post(f"/api/catalogs/{catalog_id}/categories", json={"name": "Bier"})
    r = client.post(f"/api/catalogs/{other}/categories", json={"name": "Bier"})
    assert r.status_code == 201


def _item(name="Cola", category_id=None, deposit="0", variants=None):
    return {
        "name": name,
        "category_id": category_id,
        "deposit_amount": deposit,
        "variants": variants or [{"name": "Standard", "price": "1.00"}],
    }


def test_add_stock_item_catalog_not_found(client):
    assert client.post("/api/catalogs/9999/stock-items", json=_item()).status_code == 404


def test_add_stock_item_empty_name(client, catalog_id):
    r = client.post(f"/api/catalogs/{catalog_id}/stock-items", json=_item(name=""))
    assert r.status_code == 400


def test_add_stock_item_category_not_found(client, catalog_id):
    r = client.post(
        f"/api/catalogs/{catalog_id}/stock-items", json=_item(category_id=9999)
    )
    assert r.status_code == 404


def test_add_stock_item_category_from_other_catalog(client, catalog_id):
    other = client.post("/api/catalogs", json={"name": "Zweiter"}).json()["id"]
    foreign_cat = client.post(
        f"/api/catalogs/{other}/categories", json={"name": "Fremd"}
    ).json()["id"]
    r = client.post(
        f"/api/catalogs/{catalog_id}/stock-items", json=_item(category_id=foreign_cat)
    )
    assert r.status_code == 404


def test_add_stock_item_duplicate_active_name(client, catalog_id):
    cat = client.post(
        f"/api/catalogs/{catalog_id}/categories", json={"name": "Bier"}
    ).json()["id"]
    client.post(f"/api/catalogs/{catalog_id}/stock-items", json=_item("Helles", cat))
    r = client.post(f"/api/catalogs/{catalog_id}/stock-items", json=_item("Helles", cat))
    assert r.status_code == 409


def test_add_stock_item_negative_deposit(client, catalog_id):
    r = client.post(
        f"/api/catalogs/{catalog_id}/stock-items", json=_item(deposit="-1")
    )
    assert r.status_code == 400


def test_variant_negative_price(client, catalog_id):
    r = client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json=_item(variants=[{"name": "X", "price": "-1.00"}]),
    )
    assert r.status_code == 400


def test_variant_zero_bill_steps(client, catalog_id):
    r = client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json=_item(variants=[{"name": "X", "price": "1.00", "bill_steps": "0"}]),
    )
    assert r.status_code == 400


def test_variant_batch_duplicate_name_and_price(client, catalog_id):
    r = client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json=_item(
            variants=[
                {"name": "Dup", "price": "1.00"},
                {"name": "Dup", "price": "1.00", "bill_steps": "2"},
            ]
        ),
    )
    assert r.status_code == 409


def test_variant_batch_same_price_different_name_ok(client, catalog_id):
    r = client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json=_item(
            variants=[
                {"name": "0,3 l", "price": "3.20"},
                {"name": "0,5 l", "price": "3.20"},
            ]
        ),
    )
    assert r.status_code == 201
