"""Reihenfolge im Katalog.

Die Kachelwand am Bedienterminal folgt `sort_order`. Zwei Dinge duerfen darum
nie passieren: Neues draengelt sich nach vorn, und eine Preisaenderung
verschiebt einen Artikel.
"""


def cat_names(client, catalog_id):
    return [c["name"] for c in client.get(f"/api/catalogs/{catalog_id}/categories").json()]


def item_names(client, catalog_id):
    return [
        i["name"]
        for i in client.get(f"/api/catalogs/{catalog_id}/stock-items").json()
    ]


def add_cat(client, catalog_id, name, **kw):
    return client.post(
        f"/api/catalogs/{catalog_id}/categories", json={"name": name, **kw}
    ).json()


def add_item(client, catalog_id, name, price="1.00", **kw):
    return client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json={
            "name": name,
            "category_id": None,
            "deposit_amount": "0",
            "variants": [{"name": None, "price": price}],
            **kw,
        },
    ).json()


# --- Neues haengt hinten an -------------------------------------
def test_new_categories_append_in_creation_order(client, catalog_id):
    for n in ["Bier", "Wein", "Kaffee"]:
        add_cat(client, catalog_id, n)
    assert cat_names(client, catalog_id) == ["Bier", "Wein", "Kaffee"]


def test_new_categories_get_distinct_sort_orders(client, catalog_id):
    orders = [add_cat(client, catalog_id, n)["sort_order"] for n in ["A", "B", "C"]]
    assert orders == [0, 1, 2]


def test_new_items_append_in_creation_order(client, catalog_id):
    for n in ["Helles", "Weizen", "Radler"]:
        add_item(client, catalog_id, n)
    assert item_names(client, catalog_id) == ["Helles", "Weizen", "Radler"]


def test_explicit_sort_order_still_wins(client, catalog_id):
    add_cat(client, catalog_id, "Erste")
    spaet = add_cat(client, catalog_id, "Spaeter", sort_order=99)
    assert spaet["sort_order"] == 99


def test_appending_after_an_explicit_high_value(client, catalog_id):
    add_cat(client, catalog_id, "Hoch", sort_order=50)
    danach = add_cat(client, catalog_id, "Danach")
    assert danach["sort_order"] == 51


# --- Bearbeiten laesst die Position in Ruhe ---------------------
def test_editing_an_item_keeps_its_position(client, catalog_id):
    add_item(client, catalog_id, "Erster")
    zweiter = add_item(client, catalog_id, "Zweiter")
    add_item(client, catalog_id, "Dritter")

    client.put(
        f"/api/stock-items/{zweiter['id']}",
        json={
            "name": "Zweiter",
            "category_id": None,
            "deposit_amount": "0",
            "variants": [
                {"id": zweiter["variants"][0]["id"], "name": None, "price": "9.99"}
            ],
        },
    )

    assert item_names(client, catalog_id) == ["Erster", "Zweiter", "Dritter"]


def test_renaming_a_category_keeps_its_position(client, catalog_id):
    add_cat(client, catalog_id, "Bier")
    wein = add_cat(client, catalog_id, "Wein")
    add_cat(client, catalog_id, "Kaffee")

    client.put(f"/api/categories/{wein['id']}", json={"name": "Weine", "icon": "x"})

    assert cat_names(client, catalog_id) == ["Bier", "Weine", "Kaffee"]


def test_explicit_sort_order_on_update_still_moves(client, catalog_id):
    bier = add_cat(client, catalog_id, "Bier")
    add_cat(client, catalog_id, "Wein")

    client.put(
        f"/api/categories/{bier['id']}",
        json={"name": "Bier", "icon": "x", "sort_order": 9},
    )

    assert cat_names(client, catalog_id) == ["Wein", "Bier"]


def test_negative_sort_order_on_update_is_400(client, catalog_id):
    c = add_cat(client, catalog_id, "Bier")
    r = client.put(
        f"/api/categories/{c['id']}",
        json={"name": "Bier", "icon": "x", "sort_order": -1},
    )
    assert r.status_code == 400


# --- Explizites Umsortieren bleibt massgeblich ------------------
def test_reorder_beats_creation_order(client, catalog_id):
    a = add_cat(client, catalog_id, "A")
    b = add_cat(client, catalog_id, "B")
    c = add_cat(client, catalog_id, "C")

    client.put(
        f"/api/catalogs/{catalog_id}/categories/order",
        json={"ordered_ids": [c["id"], a["id"], b["id"]]},
    )

    assert cat_names(client, catalog_id) == ["C", "A", "B"]


def test_new_category_lands_behind_a_reordered_list(client, catalog_id):
    a = add_cat(client, catalog_id, "A")
    b = add_cat(client, catalog_id, "B")
    client.put(
        f"/api/catalogs/{catalog_id}/categories/order",
        json={"ordered_ids": [b["id"], a["id"]]},
    )

    add_cat(client, catalog_id, "Neu")

    assert cat_names(client, catalog_id) == ["B", "A", "Neu"]


def test_deactivated_item_does_not_free_its_slot_for_a_newcomer(client, catalog_id):
    """Nach dem Deaktivieren bleibt die Position belegt - der naechste Artikel
    haengt trotzdem hinten an und rutscht nicht in die Luecke."""
    add_item(client, catalog_id, "Erster")
    zweiter = add_item(client, catalog_id, "Zweiter")
    client.delete(f"/api/stock-items/{zweiter['id']}")

    add_item(client, catalog_id, "Dritter")

    assert item_names(client, catalog_id) == ["Erster", "Dritter"]
    alle = client.get(
        f"/api/catalogs/{catalog_id}/stock-items?include_inactive=true"
    ).json()
    assert [i["name"] for i in alle] == ["Erster", "Zweiter", "Dritter"]
