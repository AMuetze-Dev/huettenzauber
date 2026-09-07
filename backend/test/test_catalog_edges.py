"""Randfälle Katalog + Kategorie (v2-API)."""
import pytest


# --- Katalog-Name-Grenzen ---------------------------------------------
@pytest.mark.parametrize("length,expected", [(1, 201), (80, 201), (81, 400), (200, 400)])
def test_catalog_name_length_boundary(client, length, expected):
    r = client.post("/api/catalogs", json={"name": "K" * length})
    assert r.status_code == expected


@pytest.mark.parametrize("name", ["", " ", "   ", "\t", "\n  "])
def test_catalog_name_blank_rejected(client, name):
    assert client.post("/api/catalogs", json={"name": name}).status_code == 400


def test_catalog_name_trimmed_before_store(client):
    cid = client.post("/api/catalogs", json={"name": "  Randkatalog  "}).json()["id"]
    assert client.get(f"/api/catalogs/{cid}").json()["name"] == "Randkatalog"


def test_catalog_name_unicode_and_emoji(client):
    r = client.post("/api/catalogs", json={"name": "Glühwein 🍷 Straße"})
    assert r.status_code == 201
    assert r.json()["name"] == "Glühwein 🍷 Straße"


def test_catalog_duplicate_after_trim(client):
    client.post("/api/catalogs", json={"name": "Doppel"})
    assert client.post("/api/catalogs", json={"name": "  Doppel  "}).status_code == 409


def test_catalog_update_to_own_name_is_noop(client, catalog_id):
    r = client.put(f"/api/catalogs/{catalog_id}", json={"name": "Testkatalog"})
    assert r.status_code == 200


def test_catalog_update_not_found(client):
    assert client.put("/api/catalogs/999999", json={"name": "X"}).status_code == 404


def test_catalog_update_blank(client, catalog_id):
    assert client.put(f"/api/catalogs/{catalog_id}", json={"name": " "}).status_code == 400


def test_catalog_delete_not_found(client):
    assert client.delete("/api/catalogs/999999").status_code == 404


def test_catalog_get_string_id(client):
    assert client.get("/api/catalogs/abc").status_code == 422


# --- Kategorie -------------------------------------------------------
@pytest.mark.parametrize("length,expected", [(1, 201), (50, 201), (51, 400)])
def test_category_name_length_boundary(client, catalog_id, length, expected):
    r = client.post(
        f"/api/catalogs/{catalog_id}/categories", json={"name": "C" * length}
    )
    assert r.status_code == expected


def test_category_empty_icon_rejected(client, catalog_id):
    r = client.post(
        f"/api/catalogs/{catalog_id}/categories", json={"name": "Bier", "icon": ""}
    )
    assert r.status_code == 400


def test_category_default_icon(client, catalog_id):
    r = client.post(f"/api/catalogs/{catalog_id}/categories", json={"name": "Bier"})
    assert r.json()["icon"] == "MdCategory"


def test_category_same_name_other_catalog_allowed(client, catalog_id):
    other = client.post("/api/catalogs", json={"name": "Zweit"}).json()["id"]
    client.post(f"/api/catalogs/{catalog_id}/categories", json={"name": "Bier"})
    assert (
        client.post(f"/api/catalogs/{other}/categories", json={"name": "Bier"}).status_code
        == 201
    )


def test_category_update_rename_and_icon_and_sort(client, catalog_id):
    cid = client.post(
        f"/api/catalogs/{catalog_id}/categories", json={"name": "Bier"}
    ).json()["id"]
    r = client.put(
        f"/api/categories/{cid}",
        json={"name": "Biere", "icon": "MdSportsBar", "sort_order": 7},
    )
    assert r.status_code == 200
    body = r.json()
    assert (body["name"], body["icon"], body["sort_order"]) == ("Biere", "MdSportsBar", 7)


def test_category_update_to_own_name(client, catalog_id):
    cid = client.post(
        f"/api/catalogs/{catalog_id}/categories", json={"name": "Bier"}
    ).json()["id"]
    assert (
        client.put(
            f"/api/categories/{cid}", json={"name": "Bier", "icon": "MdX"}
        ).status_code
        == 200
    )


def test_category_update_not_found(client):
    assert (
        client.put("/api/categories/999999", json={"name": "X", "icon": "Y"}).status_code
        == 404
    )


def test_category_delete_not_found(client):
    assert client.delete("/api/categories/999999").status_code == 404


def test_category_list_ordered_by_sort_order(client, catalog_id):
    a = client.post(
        f"/api/catalogs/{catalog_id}/categories", json={"name": "A", "sort_order": 5}
    ).json()["id"]
    b = client.post(
        f"/api/catalogs/{catalog_id}/categories", json={"name": "B", "sort_order": 1}
    ).json()["id"]
    ids = [c["id"] for c in client.get(f"/api/catalogs/{catalog_id}/categories").json()]
    assert ids == [b, a]


# --- Kategorie-Reorder --------------------------------------------
def test_reorder_categories_partial_subset_reorders_given_only(client, catalog_id):
    ids = [
        client.post(
            f"/api/catalogs/{catalog_id}/categories", json={"name": n}
        ).json()["id"]
        for n in ("A", "B", "C")
    ]
    # nur A und C in umgekehrter Reihenfolge -> B bleibt, wo es war (Index 1)
    r = client.put(
        f"/api/catalogs/{catalog_id}/categories/order",
        json={"ordered_ids": [ids[2], ids[0]]},
    )
    assert r.status_code == 200
    order = [c["id"] for c in r.json()]
    assert order.index(ids[2]) < order.index(ids[0])


def test_reorder_categories_foreign_id_404(client, catalog_id):
    other = client.post("/api/catalogs", json={"name": "Fremd"}).json()["id"]
    foreign = client.post(
        f"/api/catalogs/{other}/categories", json={"name": "X"}
    ).json()["id"]
    r = client.put(
        f"/api/catalogs/{catalog_id}/categories/order", json={"ordered_ids": [foreign]}
    )
    assert r.status_code == 404


def test_reorder_categories_empty_list(client, catalog_id):
    r = client.put(
        f"/api/catalogs/{catalog_id}/categories/order", json={"ordered_ids": []}
    )
    assert r.status_code == 200


def test_reorder_categories_non_int(client, catalog_id):
    r = client.put(
        f"/api/catalogs/{catalog_id}/categories/order", json={"ordered_ids": ["x"]}
    )
    assert r.status_code == 422


def test_reorder_categories_catalog_not_found(client):
    assert (
        client.put(
            "/api/catalogs/999999/categories/order", json={"ordered_ids": [1]}
        ).status_code
        == 404
    )
