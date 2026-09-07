import random


def create_category(client, name="TestCat", icon="MdTest"):
    response = client.post("/categories/", json={"name": name, "icon": icon})
    assert response.status_code == 201
    return response.json()["id"]


def create_stock_item(client, name, category_id, variants=None):
    if variants is None:
        variants = [{"name": "Standard", "price": 1.0, "bill_steps": 1.0}]
    response = client.post(
        "/stock-items/",
        json={
            "name": name,
            "category_id": category_id,
            "item_variants": variants,
        },
    )
    if response.status_code != 201:
        print(response.json())
    assert response.status_code == 201
    return response.json()["id"]


def test_sorting_initial_order(client):
    cat_id = create_category(client)
    item1 = create_stock_item(client, "A", cat_id)
    item2 = create_stock_item(client, "B", cat_id)
    item3 = create_stock_item(client, "C", cat_id)
    payload = {"ordered_item_ids": [item3, item1, item2]}
    response = client.put("/item-sorting/", json=payload)
    assert response.status_code == 204
    response = client.get("/item-sorting/")
    assert response.status_code == 200
    data = response.json()
    assert [d["item_id"] for d in data] == [item3, item1, item2]


def test_sorting_duplicate_ids(client):
    cat_id = create_category(client)
    item1 = create_stock_item(client, "A", cat_id)
    item2 = create_stock_item(client, "B", cat_id)
    payload = {"ordered_item_ids": [item1, item2, item1]}
    response = client.put("/item-sorting/", json=payload)
    assert response.status_code == 400


def test_sorting_missing_item(client):
    cat_id = create_category(client)
    item1 = create_stock_item(client, "A", cat_id)
    payload = {"ordered_item_ids": [item1, 9999]}
    response = client.put("/item-sorting/", json=payload)
    assert response.status_code == 400


def test_sorting_empty_list(client):
    response = client.put("/item-sorting/", json={"ordered_item_ids": []})
    assert response.status_code == 400


def test_sorting_order_persistence(client):
    cat_id = create_category(client)
    item1 = create_stock_item(client, "A", cat_id)
    item2 = create_stock_item(client, "B", cat_id)
    item3 = create_stock_item(client, "C", cat_id)
    payload = {"ordered_item_ids": [item2, item3, item1]}
    client.put("/item-sorting/", json=payload)
    response = client.get("/item-sorting/")
    assert [d["item_id"] for d in response.json()] == [item2, item3, item1]


def test_sorting_with_category_switch(client):
    cat1 = create_category(client)
    cat2 = create_category(client, "TestCat2")
    item1 = create_stock_item(client, "A", cat1)
    item2 = create_stock_item(client, "B", cat1)
    client.put("/item-sorting/", json={"ordered_item_ids": [item2, item1]})
    response = client.put(f"/stock-items/{item1}", json={"name": "A", "category_id": cat2, "item_variants": [{"name": "v", "price": 1.0, "bill_steps": 1.0}]})
    assert response.status_code == 200
    new_item1_id = response.json()["id"]
    client.put("/item-sorting/", json={"ordered_item_ids": [new_item1_id]})
    response = client.get("/item-sorting/")
    ids = [d["item_id"] for d in response.json()]
    assert new_item1_id in ids


def test_sorting_after_delete(client):
    cat_id = create_category(client)
    item1 = create_stock_item(client, "A", cat_id)
    item2 = create_stock_item(client, "B", cat_id)
    client.put("/item-sorting/", json={"ordered_item_ids": [item1, item2]})
    client.delete(f"/stock-items/{item1}")
    response = client.get("/item-sorting/")
    ids = [d["item_id"] for d in response.json()]
    assert item1 not in ids


def test_sorting_move_to_first(client):
    cat_id = create_category(client)
    item1 = create_stock_item(client, "A", cat_id)
    item2 = create_stock_item(client, "B", cat_id)
    item3 = create_stock_item(client, "C", cat_id)
    client.put("/item-sorting/", json={"ordered_item_ids": [item1, item2, item3]})
    client.put("/item-sorting/", json={"ordered_item_ids": [item3, item1, item2]})
    response = client.get("/item-sorting/")
    assert [d["item_id"] for d in response.json()] == [item3, item1, item2]


def test_sorting_move_to_last(client):
    cat_id = create_category(client)
    item1 = create_stock_item(client, "A", cat_id)
    item2 = create_stock_item(client, "B", cat_id)
    item3 = create_stock_item(client, "C", cat_id)
    client.put("/item-sorting/", json={"ordered_item_ids": [item1, item2, item3]})
    client.put("/item-sorting/", json={"ordered_item_ids": [item2, item3, item1]})
    response = client.get("/item-sorting/")
    assert [d["item_id"] for d in response.json()] == [item2, item3, item1]


def test_sorting_move_middle(client):
    cat_id = create_category(client)
    item1 = create_stock_item(client, "A", cat_id)
    item2 = create_stock_item(client, "B", cat_id)
    item3 = create_stock_item(client, "C", cat_id)
    client.put("/item-sorting/", json={"ordered_item_ids": [item1, item2, item3]})
    client.put("/item-sorting/", json={"ordered_item_ids": [item1, item3, item2]})
    response = client.get("/item-sorting/")
    assert [d["item_id"] for d in response.json()] == [item1, item3, item2]


def test_sorting_with_multiple_categories(client):
    cat1 = create_category(client, "A")
    cat2 = create_category(client, "B")
    item1 = create_stock_item(client, "A", cat1)
    item2 = create_stock_item(client, "B", cat2)
    item3 = create_stock_item(client, "C", cat1)
    client.put("/item-sorting/", json={"ordered_item_ids": [item1, item3, item2]})
    response = client.get("/item-sorting/")
    ids = [d["item_id"] for d in response.json()]
    assert set([item1, item2, item3]) == set(ids)


def test_sorting_update_after_category_switch(client):
    cat1 = create_category(client, "A")
    cat2 = create_category(client, "B")
    item1 = create_stock_item(client, "A", cat1)
    client.put("/item-sorting/", json={"ordered_item_ids": [item1]})
    response = client.put(f"/stock-items/{item1}", json={"name": "A", "category_id": cat2, "item_variants": [{"name": "v", "price": 1.0, "bill_steps": 1.0}]})
    assert response.status_code == 200
    new_item1_id = response.json()["id"]
    client.put("/item-sorting/", json={"ordered_item_ids": [new_item1_id]})
    response = client.get("/item-sorting/")
    assert new_item1_id in [d["item_id"] for d in response.json()]


def test_sorting_invalid_sort_order(client):
    cat_id = create_category(client)
    item1 = create_stock_item(client, "A", cat_id)
    response = client.put("/item-sorting/", json={"ordered_item_ids": [item1, 9999]})
    assert response.status_code == 400


def test_sorting_reorder_after_removal(client):
    cat_id = create_category(client)
    item1 = create_stock_item(client, "A", cat_id)
    item2 = create_stock_item(client, "B", cat_id)
    item3 = create_stock_item(client, "C", cat_id)
    client.put("/item-sorting/", json={"ordered_item_ids": [item1, item2, item3]})
    client.delete(f"/stock-items/{item2}")
    client.put("/item-sorting/", json={"ordered_item_ids": [item3, item1]})
    response = client.get("/item-sorting/")
    assert [d["item_id"] for d in response.json()] == [item3, item1]


def test_sorting_with_inactive_items(client):
    cat_id = create_category(client)
    item1 = create_stock_item(client, "A", cat_id)
    item2 = create_stock_item(client, "B", cat_id)
    client.put("/item-sorting/", json={"ordered_item_ids": [item1, item2]})
    client.delete(f"/stock-items/{item2}")
    response = client.get("/item-sorting/")
    ids = [d["item_id"] for d in response.json()]
    assert item2 not in ids


def test_sorting_with_repeated_puts(client):
    cat_id = create_category(client)
    item1 = create_stock_item(client, "A", cat_id)
    item2 = create_stock_item(client, "B", cat_id)
    client.put("/item-sorting/", json={"ordered_item_ids": [item1, item2]})
    client.put("/item-sorting/", json={"ordered_item_ids": [item2, item1]})
    client.put("/item-sorting/", json={"ordered_item_ids": [item1, item2]})
    response = client.get("/item-sorting/")
    assert [d["item_id"] for d in response.json()] == [item1, item2]


def test_sorting_with_large_number_of_items(client):
    cat_id = create_category(client)
    item_ids = [create_stock_item(client, f"Item{i}", cat_id) for i in range(20)]
    client.put("/item-sorting/", json={"ordered_item_ids": item_ids[::-1]})
    response = client.get("/item-sorting/")
    assert [d["item_id"] for d in response.json()] == item_ids[::-1]


def test_sorting_with_gaps_in_ids(client):
    cat_id = create_category(client)
    item1 = create_stock_item(client, "A", cat_id)
    item2 = create_stock_item(client, "B", cat_id)
    item3 = create_stock_item(client, "C", cat_id)
    client.delete(f"/stock-items/{item3}")
    client.put("/item-sorting/", json={"ordered_item_ids": [item2, item1]})
    response = client.get("/item-sorting/")
    assert [d["item_id"] for d in response.json()] == [item2, item1]


def test_sorting_with_all_items_in_one_category(client):
    cat_id = create_category(client)
    item_ids = [create_stock_item(client, f"Item{i}", cat_id) for i in range(10)]
    client.put("/item-sorting/", json={"ordered_item_ids": item_ids})
    response = client.get("/item-sorting/")
    assert [d["item_id"] for d in response.json()] == item_ids


def test_sorting_with_items_in_multiple_categories(client):
    cat1 = create_category(client, "A")
    cat2 = create_category(client, "B")
    items_cat1 = [create_stock_item(client, f"A{i}", cat1) for i in range(5)]
    items_cat2 = [create_stock_item(client, f"B{i}", cat2) for i in range(5)]
    all_items = items_cat1 + items_cat2
    client.put("/item-sorting/", json={"ordered_item_ids": all_items})
    response = client.get("/item-sorting/")
    assert set([d["item_id"] for d in response.json()]) == set(all_items)


def test_sorting_with_category_switch_and_reorder(client):
    cat1 = create_category(client, "A")
    cat2 = create_category(client, "B")
    item1 = create_stock_item(client, "A", cat1)
    item2 = create_stock_item(client, "B", cat1)
    client.put("/item-sorting/", json={"ordered_item_ids": [item1, item2]})
    response = client.put(f"/stock-items/{item2}", json={"name": "B", "category_id": cat2, "item_variants": [{"name": "v", "price": 1.0, "bill_steps": 1.0}]})
    assert response.status_code == 200
    new_item2 = response.json()["id"]
    client.put("/item-sorting/", json={"ordered_item_ids": [new_item2]})
    response = client.get("/item-sorting/")
    ids = [d["item_id"] for d in response.json()]
    assert new_item2 in ids


def test_sorting_with_invalid_payload(client):
    response = client.put("/item-sorting/", json={})
    assert response.status_code == 422


def test_sorting_with_nonexistent_category(client):
    response = client.put("/item-sorting/", json={"ordered_item_ids": [9999]})
    assert response.status_code == 400


def test_sorting_with_partial_existing_items(client):
    cat_id = create_category(client)
    item1 = create_stock_item(client, "A", cat_id)
    response = client.put("/item-sorting/", json={"ordered_item_ids": [item1, 9999]})
    assert response.status_code == 400


def test_sorting_with_no_items(client):
    response = client.get("/item-sorting/")
    assert response.status_code == 200
    assert response.json() == []


def test_sorting_with_update_and_delete(client):
    cat_id = create_category(client)
    item1 = create_stock_item(client, "A", cat_id)
    item2 = create_stock_item(client, "B", cat_id)
    client.put("/item-sorting/", json={"ordered_item_ids": [item1, item2]})
    client.delete(f"/stock-items/{item1}")
    response = client.get("/item-sorting/")
    ids = [d["item_id"] for d in response.json()]
    assert item1 not in ids
    assert item2 in ids


def test_sorting_with_update_to_same_category(client):
    cat_id = create_category(client)
    item1 = create_stock_item(client, "A", cat_id)
    client.put("/item-sorting/", json={"ordered_item_ids": [item1]})
    response = client.put(f"/stock-items/{item1}", json={"name": "A", "category_id": cat_id, "item_variants": [{"name": "v", "price": 1.0, "bill_steps": 1.0}]})
    assert response.status_code == 200
    new_item1 = response.json()["id"]
    client.put("/item-sorting/", json={"ordered_item_ids": [new_item1]})
    response = client.get("/item-sorting/")
    ids = [d["item_id"] for d in response.json()]
    assert new_item1 in ids


def test_sorting_with_update_to_new_category_and_reorder(client):
    cat1 = create_category(client, "A")
    cat2 = create_category(client, "B")
    item1 = create_stock_item(client, "A", cat1)
    item2 = create_stock_item(client, "B", cat1)
    client.put("/item-sorting/", json={"ordered_item_ids": [item1, item2]})
    response = client.put(f"/stock-items/{item1}", json={"name": "A", "category_id": cat2, "item_variants": [{"name": "v", "price": 1.0, "bill_steps": 1.0}]})
    assert response.status_code == 200
    new_item1 = response.json()["id"]
    client.put("/item-sorting/", json={"ordered_item_ids": [new_item1]})
    response = client.get("/item-sorting/")
    ids = [d["item_id"] for d in response.json()]
    assert new_item1 in ids


def test_sorting_reverse_order(client):
    cat_id = create_category(client)
    item_ids = [create_stock_item(client, f"Item{i}", cat_id) for i in range(10)]
    client.put("/item-sorting/", json={"ordered_item_ids": item_ids[::-1]})
    response = client.get("/item-sorting/")
    assert [d["item_id"] for d in response.json()] == item_ids[::-1]


def test_sorting_shuffle_order(client):
    cat_id = create_category(client)
    item_ids = [create_stock_item(client, f"Item{i}", cat_id) for i in range(10)]
    shuffled = item_ids[:]
    random.shuffle(shuffled)
    client.put("/item-sorting/", json={"ordered_item_ids": shuffled})
    response = client.get("/item-sorting/")
    assert [d["item_id"] for d in response.json()] == shuffled


def test_sorting_with_very_large_number_of_items(client):
    cat_id = create_category(client)
    item_ids = [create_stock_item(client, f"Item{i}", cat_id) for i in range(100)]
    client.put("/item-sorting/", json={"ordered_item_ids": item_ids})
    response = client.get("/item-sorting/")
    assert [d["item_id"] for d in response.json()] == item_ids


def test_sorting_with_gaps_after_bulk_delete(client):
    cat_id = create_category(client)
    item_ids = [create_stock_item(client, f"Item{i}", cat_id) for i in range(10)]
    for i in range(0, 10, 2):
        client.delete(f"/stock-items/{item_ids[i]}")
    remaining = [item_ids[i] for i in range(10) if i % 2 == 1]
    client.put("/item-sorting/", json={"ordered_item_ids": remaining})
    response = client.get("/item-sorting/")
    assert [d["item_id"] for d in response.json()] == remaining


def test_sorting_with_all_items_deleted(client):
    cat_id = create_category(client)
    ids = [create_stock_item(client, f"Item{i}", cat_id) for i in range(5)]
    client.put("/item-sorting/", json={"ordered_item_ids": ids})
    for item_id in ids:
        client.delete(f"/stock-items/{item_id}")
    response = client.get("/item-sorting/")
    assert response.json() == []


def test_sorting_with_reinsertion_after_delete(client):
    cat_id = create_category(client)
    item1 = create_stock_item(client, "A", cat_id)
    client.put("/item-sorting/", json={"ordered_item_ids": [item1]})
    client.delete(f"/stock-items/{item1}")
    item2 = create_stock_item(client, "A", cat_id)
    client.put("/item-sorting/", json={"ordered_item_ids": [item2]})
    response = client.get("/item-sorting/")
    assert [d["item_id"] for d in response.json()] == [item2]


def test_sorting_with_multiple_category_switches(client):
    cat1 = create_category(client, "A")
    cat2 = create_category(client, "B")
    item = create_stock_item(client, "Switcher", cat1)
    client.put("/item-sorting/", json={"ordered_item_ids": [item]})
    current_id = item
    for _ in range(3):
        response = client.put(f"/stock-items/{current_id}", json={"name": "Switcher", "category_id": cat2, "item_variants": [{"name": "v", "price": 1.0, "bill_steps": 1.0}]})
        assert response.status_code == 200
        current_id = response.json()["id"]
        client.put("/item-sorting/", json={"ordered_item_ids": [current_id]})
        response = client.put(f"/stock-items/{current_id}", json={"name": "Switcher", "category_id": cat1, "item_variants": [{"name": "v", "price": 1.0, "bill_steps": 1.0}]})
        assert response.status_code == 200
        current_id = response.json()["id"]
        client.put("/item-sorting/", json={"ordered_item_ids": [current_id]})
    response = client.get("/item-sorting/")
    assert current_id in [d["item_id"] for d in response.json()]


def test_sorting_with_all_items_same_name_different_categories(client):
    cat1 = create_category(client, "A")
    cat2 = create_category(client, "B")
    item1 = create_stock_item(client, "X", cat1)
    item2 = create_stock_item(client, "X", cat2)
    client.put("/item-sorting/", json={"ordered_item_ids": [item1, item2]})
    response = client.get("/item-sorting/")
    assert set([d["item_id"] for d in response.json()]) == set([item1, item2])


def test_sorting_with_long_names(client):
    cat_id = create_category(client)
    long_name = "A" * 100
    item1 = client.post("/stock-items/", json={"name": long_name, "category_id": cat_id, "item_variants": [{"name": "v", "price": 1.0, "bill_steps": 1.0}]})
    assert item1.status_code == 400


def test_sorting_with_special_characters(client):
    cat_id = create_category(client)
    item1 = create_stock_item(client, "ÄÖÜ", cat_id)
    item2 = create_stock_item(client, "ß!?", cat_id)
    client.put("/item-sorting/", json={"ordered_item_ids": [item2, item1]})
    response = client.get("/item-sorting/")
    assert [d["item_id"] for d in response.json()] == [item2, item1]


def test_sorting_with_unicode_names(client):
    cat_id = create_category(client)
    item1 = create_stock_item(client, "🍺", cat_id)
    item2 = create_stock_item(client, "🍷", cat_id)
    client.put("/item-sorting/", json={"ordered_item_ids": [item1, item2]})
    response = client.get("/item-sorting/")
    assert [d["item_id"] for d in response.json()] == [item1, item2]


def test_sorting_with_many_category_switches_and_bulk(client):
    cat_ids = [create_category(client, f"Cat{i}") for i in range(5)]
    items = [create_stock_item(client, f"Item{i}", cat_ids[i % 5]) for i in range(20)]
    client.put("/item-sorting/", json={"ordered_item_ids": items[::-1]})
    response = client.get("/item-sorting/")
    assert [d["item_id"] for d in response.json()] == items[::-1]
    new_items = []
    for idx, item in enumerate(items):
        response = client.put(f"/stock-items/{item}", json={"name": f"ItemX_{idx}", "category_id": cat_ids[0], "item_variants": [{"name": "v", "price": 1.0, "bill_steps": 1.0}]})
        assert response.status_code == 200
        new_items.append(response.json()["id"])
    client.put("/item-sorting/", json={"ordered_item_ids": new_items})
    response = client.get("/item-sorting/")
    assert [d["item_id"] for d in response.json()] == new_items


def test_sorting_with_partial_bulk_update(client):
    cat_id = create_category(client)
    items = [create_stock_item(client, f"Item{i}", cat_id) for i in range(10)]
    client.put("/item-sorting/", json={"ordered_item_ids": items[:5]})
    response = client.get("/item-sorting/")
    ids = [d["item_id"] for d in response.json()]
    for i in items[:5]:
        assert i in ids


def test_sorting_with_bulk_update_and_delete(client):
    cat_id = create_category(client)
    items = [create_stock_item(client, f"Item{i}", cat_id) for i in range(10)]
    client.put("/item-sorting/", json={"ordered_item_ids": items})
    for i in items[:5]:
        client.delete(f"/stock-items/{i}")
    response = client.get("/item-sorting/")
    ids = [d["item_id"] for d in response.json()]
    for i in items[:5]:
        assert i not in ids
    for i in items[5:]:
        assert i in ids


def test_sorting_with_bulk_update_and_reinsertion(client):
    cat_id = create_category(client)
    items = [create_stock_item(client, f"Item{i}", cat_id) for i in range(5)]
    client.put("/item-sorting/", json={"ordered_item_ids": items})
    for i in items:
        client.delete(f"/stock-items/{i}")
    new_items = [create_stock_item(client, f"ItemX{i}", cat_id) for i in range(5)]
    client.put("/item-sorting/", json={"ordered_item_ids": new_items})
    response = client.get("/item-sorting/")
    assert [d["item_id"] for d in response.json()] == new_items


def test_sorting_with_bulk_update_and_special_names(client):
    cat_id = create_category(client)
    items = [create_stock_item(client, f"Item_{i}#€", cat_id) for i in range(10)]
    client.put("/item-sorting/", json={"ordered_item_ids": items[::-1]})
    response = client.get("/item-sorting/")
    assert [d["item_id"] for d in response.json()] == items[::-1]


def test_sorting_with_bulk_update_and_unicode_names(client):
    cat_id = create_category(client)
    items = [create_stock_item(client, f"🍺{i}", cat_id) for i in range(10)]
    client.put("/item-sorting/", json={"ordered_item_ids": items})
    response = client.get("/item-sorting/")
    assert [d["item_id"] for d in response.json()] == items


def test_sorting_with_bulk_update_and_long_names(client):
    cat_id = create_category(client)
    items = [create_stock_item(client, "A" * (i + 1), cat_id) for i in range(10)]
    client.put("/item-sorting/", json={"ordered_item_ids": items[::-1]})
    response = client.get("/item-sorting/")
    assert [d["item_id"] for d in response.json()] == items[::-1]


def test_sorting_with_bulk_update_and_switch_back_and_forth(client):
    cat1 = create_category(client, "A")
    cat2 = create_category(client, "B")
    items = [create_stock_item(client, f"Item{i}", cat1) for i in range(5)]
    client.put("/item-sorting/", json={"ordered_item_ids": items})
    current_items = items
    for switch_idx in range(2):
        new_items = []
        for idx, item in enumerate(current_items):
            response = client.put(
                f"/stock-items/{item}",
                json={
                    "name": f"ItemX_{switch_idx}_{idx}",
                    "category_id": cat2,
                    "item_variants": [{"name": "v", "price": 1.0, "bill_steps": 1.0}]
                }
            )
            assert response.status_code == 200
            new_items.append(response.json()["id"])
        client.put("/item-sorting/", json={"ordered_item_ids": new_items})
        current_items = []
        for idx, item in enumerate(new_items):
            response = client.put(
                f"/stock-items/{item}",
                json={
                    "name": f"ItemX_{switch_idx + 1}_{idx}",
                    "category_id": cat1,
                    "item_variants": [{"name": "v", "price": 1.0, "bill_steps": 1.0}]
                }
            )
            assert response.status_code == 200
            current_items.append(response.json()["id"])
        client.put("/item-sorting/", json={"ordered_item_ids": current_items})
    response = client.get("/item-sorting/")
    assert [d["item_id"] for d in response.json()] == current_items
