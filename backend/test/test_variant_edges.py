"""Randfälle Artikel + Varianten."""
import pytest


def _item(name="Item", category_id=None, deposit="0", variants=None):
    return {
        "name": name,
        "category_id": category_id,
        "deposit_amount": deposit,
        "variants": variants if variants is not None else [{"name": "Std", "price": "1.00"}],
    }


def _add(client, catalog_id, **kw):
    return client.post(f"/api/catalogs/{catalog_id}/stock-items", json=_item(**kw))


# --- Name / Pfand -------------------------------------------------
@pytest.mark.parametrize("length,expected", [(1, 201), (50, 201), (51, 400)])
def test_item_name_length_boundary(client, catalog_id, length, expected):
    assert _add(client, catalog_id, name="N" * length).status_code == expected


@pytest.mark.parametrize("name", ["", "   ", "\t"])
def test_item_blank_name(client, catalog_id, name):
    assert _add(client, catalog_id, name=name).status_code == 400


@pytest.mark.parametrize("deposit,expected", [("0", 201), ("0.01", 201), ("-0.01", 400), ("999999.99", 201)])
def test_item_deposit_bounds(client, catalog_id, deposit, expected):
    assert _add(client, catalog_id, deposit=deposit).status_code == expected


def test_item_name_unicode(client, catalog_id):
    assert _add(client, catalog_id, name="Käsespätzle 🧀").status_code == 201


# --- Varianten-Werte -----------------------------------------------
@pytest.mark.parametrize("price,expected", [("0", 201), ("0.00", 201), ("-0.01", 400), ("100000", 201)])
def test_variant_price_bounds(client, catalog_id, price, expected):
    r = _add(client, catalog_id, variants=[{"name": "V", "price": price}])
    assert r.status_code == expected


@pytest.mark.parametrize("steps,expected", [("1", 201), ("0.001", 201), ("0", 400), ("-1", 400), ("0.5", 201)])
def test_variant_bill_steps_bounds(client, catalog_id, steps, expected):
    r = _add(
        client, catalog_id, variants=[{"name": "V", "price": "1.00", "bill_steps": steps}]
    )
    assert r.status_code == expected


def test_variant_missing_price_is_422(client, catalog_id):
    r = _add(client, catalog_id, variants=[{"name": "V"}])
    assert r.status_code == 422


def test_variant_name_none_stored_as_null(client, catalog_id):
    r = _add(client, catalog_id, variants=[{"price": "1.50"}])
    assert r.status_code == 201
    assert r.json()["variants"][0]["name"] is None


@pytest.mark.parametrize("name", ["", "   ", "\t"])
def test_variant_blank_name_stored_as_null(client, catalog_id, name):
    r = _add(client, catalog_id, variants=[{"name": name, "price": "1.50"}])
    assert r.status_code == 201
    assert r.json()["variants"][0]["name"] is None


def test_item_with_zero_variants_allowed(client, catalog_id):
    r = _add(client, catalog_id, variants=[])
    assert r.status_code == 201
    assert r.json()["variants"] == []


def test_item_with_many_variants(client, catalog_id):
    variants = [{"name": f"V{i}", "price": f"{i + 1}.00"} for i in range(12)]
    r = _add(client, catalog_id, variants=variants)
    assert r.status_code == 201
    assert len(r.json()["variants"]) == 12


# --- Varianten-Dubletten im Batch --------------------------------
def test_variant_batch_dup_same_name_same_price(client, catalog_id):
    r = _add(
        client,
        catalog_id,
        variants=[
            {"name": "A", "price": "2.00"},
            {"name": "A", "price": "2.00", "bill_steps": "2"},
        ],
    )
    assert r.status_code == 409


def test_variant_batch_dup_same_name_same_steps_diff_price(client, catalog_id):
    r = _add(
        client,
        catalog_id,
        variants=[
            {"name": "A", "price": "2.00"},
            {"name": "A", "price": "3.00"},  # default bill_steps 1 bei beiden
        ],
    )
    assert r.status_code == 409


def test_variant_batch_same_price_diff_name_ok(client, catalog_id):
    r = _add(
        client,
        catalog_id,
        variants=[{"name": "0,3", "price": "3.20"}, {"name": "0,5", "price": "3.20"}],
    )
    assert r.status_code == 201


def test_variant_batch_same_name_diff_price_diff_steps_ok(client, catalog_id):
    r = _add(
        client,
        catalog_id,
        variants=[
            {"name": "A", "price": "2.00", "bill_steps": "1"},
            {"name": "A", "price": "3.00", "bill_steps": "2"},
        ],
    )
    assert r.status_code == 201


# --- Kategorie-Bindung -------------------------------------------
def test_item_category_from_other_catalog_404(client, catalog_id):
    other = client.post("/api/catalogs", json={"name": "O"}).json()["id"]
    foreign_cat = client.post(
        f"/api/catalogs/{other}/categories", json={"name": "F"}
    ).json()["id"]
    assert _add(client, catalog_id, category_id=foreign_cat).status_code == 404


def test_item_category_none_allowed(client, catalog_id):
    r = _add(client, catalog_id, category_id=None)
    assert r.status_code == 201
    assert r.json()["category_id"] is None


def test_item_dup_name_same_category_conflict(client, catalog_id):
    cat = client.post(
        f"/api/catalogs/{catalog_id}/categories", json={"name": "K"}
    ).json()["id"]
    _add(client, catalog_id, name="Helles", category_id=cat)
    assert _add(client, catalog_id, name="Helles", category_id=cat).status_code == 409


def test_item_same_name_different_category_ok(client, catalog_id):
    c1 = client.post(
        f"/api/catalogs/{catalog_id}/categories", json={"name": "K1"}
    ).json()["id"]
    c2 = client.post(
        f"/api/catalogs/{catalog_id}/categories", json={"name": "K2"}
    ).json()["id"]
    _add(client, catalog_id, name="Helles", category_id=c1)
    assert _add(client, catalog_id, name="Helles", category_id=c2).status_code == 201


def test_item_reuse_name_of_inactive_item_ok(client, catalog_id):
    cat = client.post(
        f"/api/catalogs/{catalog_id}/categories", json={"name": "K"}
    ).json()["id"]
    iid = _add(client, catalog_id, name="Helles", category_id=cat).json()["id"]
    client.delete(f"/api/stock-items/{iid}")
    assert _add(client, catalog_id, name="Helles", category_id=cat).status_code == 201


# --- Update -----------------------------------------------------
def test_update_item_id_stays_stable_across_many_edits(client, catalog_id):
    iid = _add(client, catalog_id, name="Bier").json()["id"]
    for i in range(5):
        r = client.put(
            f"/api/stock-items/{iid}",
            json={
                "name": f"Bier {i}",
                "deposit_amount": "0",
                "variants": [{"name": "0,5", "price": f"{4 + i}.00"}],
            },
        )
        assert r.status_code == 200
        assert r.json()["id"] == iid


def test_update_item_change_category_to_none(client, catalog_id):
    cat = client.post(
        f"/api/catalogs/{catalog_id}/categories", json={"name": "K"}
    ).json()["id"]
    iid = _add(client, catalog_id, name="X", category_id=cat).json()["id"]
    r = client.put(
        f"/api/stock-items/{iid}",
        json={"name": "X", "category_id": None, "deposit_amount": "0", "variants": []},
    )
    assert r.status_code == 200 and r.json()["category_id"] is None


def test_update_item_variant_foreign_id_treated_as_new(client, catalog_id):
    a = _add(client, catalog_id, name="A", variants=[{"name": "a", "price": "1.00"}]).json()
    b = _add(client, catalog_id, name="B", variants=[{"name": "b", "price": "2.00"}]).json()
    foreign_vid = b["variants"][0]["id"]
    r = client.put(
        f"/api/stock-items/{a['id']}",
        json={
            "name": "A",
            "deposit_amount": "0",
            "variants": [{"id": foreign_vid, "name": "neu", "price": "9.00"}],
        },
    )
    assert r.status_code == 200
    v = r.json()["variants"]
    assert len(v) == 1 and v[0]["id"] != foreign_vid and v[0]["name"] == "neu"


def test_update_item_remove_all_variants(client, catalog_id):
    iid = _add(
        client,
        catalog_id,
        name="X",
        variants=[{"name": "a", "price": "1.00"}, {"name": "b", "price": "2.00"}],
    ).json()["id"]
    r = client.put(
        f"/api/stock-items/{iid}",
        json={"name": "X", "deposit_amount": "0", "variants": []},
    )
    assert r.status_code == 200 and r.json()["variants"] == []


def test_update_inactive_item_conflict(client, catalog_id):
    iid = _add(client, catalog_id, name="Weg").json()["id"]
    client.delete(f"/api/stock-items/{iid}")
    r = client.put(
        f"/api/stock-items/{iid}",
        json={"name": "Weg", "deposit_amount": "0", "variants": []},
    )
    assert r.status_code == 409


def test_update_item_negative_variant_price(client, catalog_id):
    iid = _add(client, catalog_id, name="X").json()["id"]
    r = client.put(
        f"/api/stock-items/{iid}",
        json={
            "name": "X",
            "deposit_amount": "0",
            "variants": [{"name": "a", "price": "-1.00"}],
        },
    )
    assert r.status_code == 400


def test_update_item_not_found(client):
    assert (
        client.put(
            "/api/stock-items/999999",
            json={"name": "X", "deposit_amount": "0", "variants": []},
        ).status_code
        == 404
    )


# --- Delete / List -------------------------------------------
def test_delete_item_twice_conflict(client, catalog_id):
    iid = _add(client, catalog_id, name="X").json()["id"]
    assert client.delete(f"/api/stock-items/{iid}").status_code == 204
    assert client.delete(f"/api/stock-items/{iid}").status_code == 409


def test_delete_item_deactivates_variants(client, catalog_id):
    iid = _add(
        client,
        catalog_id,
        name="X",
        variants=[{"name": "a", "price": "1.00"}, {"name": "b", "price": "2.00"}],
    ).json()["id"]
    client.delete(f"/api/stock-items/{iid}")
    got = client.get(f"/api/stock-items/{iid}").json()
    assert got["is_active"] is False
    assert all(v["is_active"] is False for v in got["variants"])


def test_delete_item_not_found(client):
    assert client.delete("/api/stock-items/999999").status_code == 404


def test_get_item_string_id(client):
    assert client.get("/api/stock-items/abc").status_code == 422


def test_list_items_include_inactive_flag(client, catalog_id):
    a = _add(client, catalog_id, name="A").json()["id"]
    _add(client, catalog_id, name="B")
    client.delete(f"/api/stock-items/{a}")
    assert len(client.get(f"/api/catalogs/{catalog_id}/stock-items").json()) == 1
    assert (
        len(
            client.get(
                f"/api/catalogs/{catalog_id}/stock-items?include_inactive=true"
            ).json()
        )
        == 2
    )


def test_list_items_catalog_not_found(client):
    assert client.get("/api/catalogs/999999/stock-items").status_code == 404


def test_reorder_items_duplicate_ids(client, catalog_id):
    iid = _add(client, catalog_id, name="A").json()["id"]
    r = client.put(
        f"/api/catalogs/{catalog_id}/stock-items/order",
        json={"ordered_ids": [iid, iid]},
    )
    assert r.status_code == 400


def test_reorder_items_unknown_id(client, catalog_id):
    r = client.put(
        f"/api/catalogs/{catalog_id}/stock-items/order", json={"ordered_ids": [999999]}
    )
    assert r.status_code == 404
