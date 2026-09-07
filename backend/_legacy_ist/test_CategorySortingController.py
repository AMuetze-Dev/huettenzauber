def create_category(client, name, icon):
    response = client.post("/categories/", json={"name": name, "icon": icon})
    if response.status_code != 201:
        print(response.status_code, response.json())
    assert response.status_code == 201
    return response.json()["id"]


def test_remove_category_from_sorting_success(client):
    cat_id = create_category(client, "C", "MdC")
    response = client.delete(f"/category-sorting/{cat_id}")
    assert response.status_code == 204


def test_remove_category_from_sorting_not_found(client):
    response = client.delete("/category-sorting/9999")
    assert response.status_code == 404


def test_move_category_success(client):
    cat1 = create_category(client, "D", "MdD")
    create_category(client, "E", "MdE")
    response = client.put(f"/category-sorting/move/{cat1}?sort_order=2")
    assert response.status_code == 200
    data = response.json()
    assert data["category_id"] == cat1
    assert data["sort_order"] == 2


def test_move_category_invalid_sort_order(client):
    cat_id = create_category(client, "F", "MdF")
    response = client.put(f"/category-sorting/move/{cat_id}?sort_order=0")
    assert response.status_code == 400
    response = client.put(f"/category-sorting/move/{cat_id}?sort_order=99")
    assert response.status_code == 400


def test_move_category_not_found(client):
    response = client.put("/category-sorting/move/9999?sort_order=1")
    assert response.status_code == 400


def test_bulk_update_sorting_success(client):
    cat1 = create_category(client, "G", "MdG")
    cat2 = create_category(client, "H", "MdH")
    cat3 = create_category(client, "I", "MdI")
    response = client.put("/category-sorting/bulk", json={"ordered_category_ids": [cat3, cat1, cat2]})
    assert response.status_code == 204
    response = client.get("/category-sorting/")
    assert response.status_code == 200
    data = response.json()
    assert data[0]["category_id"] == cat3
    assert data[1]["category_id"] == cat1
    assert data[2]["category_id"] == cat2


def test_bulk_update_sorting_empty_list(client):
    response = client.put("/category-sorting/bulk", json={"ordered_category_ids": []})
    assert response.status_code == 400


def test_bulk_update_sorting_duplicates(client):
    cat1 = create_category(client, "J", "MdJ")
    create_category(client, "K", "MdK")
    response = client.put("/category-sorting/bulk", json={"ordered_category_ids": [cat1, cat1]})
    assert response.status_code == 400


def test_bulk_update_sorting_missing_category(client):
    cat1 = create_category(client, "L", "MdL")
    response = client.put("/category-sorting/bulk", json={"ordered_category_ids": [cat1, 9999]})
    assert response.status_code == 400


def test_get_all_sortings(client):
    create_category(client, "M", "MdM")
    create_category(client, "N", "MdN")
    response = client.get("/category-sorting/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["sort_order"] == 1
    assert data[1]["sort_order"] == 2


def test_remove_category_from_sorting_twice(client):
    cat_id = create_category(client, "Twice", "MdTwice")
    response = client.delete(f"/category-sorting/{cat_id}")
    assert response.status_code == 204
    response = client.delete(f"/category-sorting/{cat_id}")
    assert response.status_code == 404


def test_move_category_to_same_position(client):
    cat_id = create_category(client, "Same", "MdSame")
    response = client.put(f"/category-sorting/move/{cat_id}?sort_order=1")
    assert response.status_code == 200
    data = response.json()
    assert data["sort_order"] == 1


def test_move_category_with_string_sort_order(client):
    cat_id = create_category(client, "StrSort", "MdStrSort")
    response = client.put(f"/category-sorting/move/{cat_id}?sort_order=abc")
    assert response.status_code == 422


def test_move_category_with_missing_sort_order(client):
    cat_id = create_category(client, "MissSort", "MdMissSort")
    response = client.put(f"/category-sorting/move/{cat_id}")
    assert response.status_code == 422


def test_bulk_update_sorting_with_non_int_id(client):
    cat1 = create_category(client, "BulkA", "MdBulkA")
    response = client.put("/category-sorting/bulk", json={"ordered_category_ids": [cat1, "abc"]})
    assert response.status_code == 422


def test_bulk_update_sorting_with_only_one_category(client):
    cat1 = create_category(client, "BulkOne", "MdBulkOne")
    response = client.put("/category-sorting/bulk", json={"ordered_category_ids": [cat1]})
    assert response.status_code == 204


def test_bulk_update_sorting_with_all_categories_reversed(client):
    cat1 = create_category(client, "BulkRevA", "MdBulkRevA")
    cat2 = create_category(client, "BulkRevB", "MdBulkRevB")
    cat3 = create_category(client, "BulkRevC", "MdBulkRevC")
    response = client.put("/category-sorting/bulk", json={"ordered_category_ids": [cat3, cat2, cat1]})
    assert response.status_code == 204
    response = client.get("/category-sorting/")
    data = response.json()
    assert data[0]["category_id"] == cat3
    assert data[1]["category_id"] == cat2
    assert data[2]["category_id"] == cat1


def test_bulk_update_sorting_with_missing_json_field(client):
    response = client.put("/category-sorting/bulk", json={})
    assert response.status_code == 422


def test_bulk_update_sorting_with_null_in_list(client):
    cat1 = create_category(client, "BulkNull", "MdBulkNull")
    response = client.put("/category-sorting/bulk", json={"ordered_category_ids": [cat1, None]})
    assert response.status_code == 422


def test_bulk_update_sorting_with_extra_category(client):
    cat1 = create_category(client, "BulkExtra", "MdBulkExtra")
    response = client.put("/category-sorting/bulk", json={"ordered_category_ids": [cat1, 9999]})
    assert response.status_code == 400


def test_get_all_sortings_empty(client):
    response = client.get("/category-sorting/")
    assert response.status_code == 200
    assert response.json() == []


def test_remove_category_from_sorting_with_string_id(client):
    response = client.delete("/category-sorting/abc")
    assert response.status_code == 422


def test_move_category_with_string_id(client):
    response = client.put("/category-sorting/move/abc?sort_order=1")
    assert response.status_code == 422


def test_bulk_update_sorting_with_string_id(client):
    response = client.put("/category-sorting/bulk", json={"ordered_category_ids": ["abc"]})
    assert response.status_code == 422


def test_move_category_with_null_sort_order(client):
    cat_id = create_category(client, "NullMove", "MdNullMove")
    response = client.put(f"/category-sorting/move/{cat_id}?sort_order=")
    assert response.status_code == 422


def test_category_sorting_entry_created_on_category_create(client):
    cat_id = create_category(client, "AutoSort", "MdAuto")
    response = client.get("/category-sorting/")
    assert response.status_code == 200
    data = response.json()
    assert any(entry["category_id"] == cat_id for entry in data)


def test_category_sorting_sort_order_is_incremented(client):
    cat1 = create_category(client, "SortA", "MdSortA")
    cat2 = create_category(client, "SortB", "MdSortB")
    response = client.get("/category-sorting/")
    data = response.json()
    sort_orders = [entry["sort_order"] for entry in data if entry["category_id"] in (cat1, cat2)]
    assert sorted(sort_orders) == [1, 2]


def test_category_sorting_entry_deleted_on_category_delete(client):
    cat_id = create_category(client, "DelSort", "MdDelSort")
    response = client.delete(f"/categories/{cat_id}")
    assert response.status_code == 204
    response = client.get("/category-sorting/")
    data = response.json()
    assert not any(entry["category_id"] == cat_id for entry in data)


def test_category_sorting_bulk_update_after_auto_creation(client):
    cat1 = create_category(client, "BulkAutoA", "MdBulkAutoA")
    cat2 = create_category(client, "BulkAutoB", "MdBulkAutoB")
    cat3 = create_category(client, "BulkAutoC", "MdBulkAutoC")
    response = client.put("/category-sorting/bulk", json={"ordered_category_ids": [cat3, cat1, cat2]})
    assert response.status_code == 204
    response = client.get("/category-sorting/")
    data = response.json()
    assert data[0]["category_id"] == cat3
    assert data[1]["category_id"] == cat1
    assert data[2]["category_id"] == cat2


def test_category_sorting_entry_exists_after_update(client):
    cat_id = create_category(client, "UpdateSort", "MdUpdateSort")
    response = client.put(f"/category-sorting/move/{cat_id}?sort_order=1")
    assert response.status_code == 200
    response = client.get("/category-sorting/")
    data = response.json()
    assert any(entry["category_id"] == cat_id for entry in data)


def test_category_sorting_entry_removed_then_readded(client):
    cat_id = create_category(client, "RemoveReadd", "MdRemoveReadd")
    response = client.delete(f"/category-sorting/{cat_id}")
    assert response.status_code == 204
    response = client.get("/category-sorting/")
    data = response.json()
    assert not any(entry["category_id"] == cat_id for entry in data)
    response = client.put("/category-sorting/bulk", json={"ordered_category_ids": [cat_id]})
    assert response.status_code == 400


def test_category_sorting_entry_removed_on_category_delete_even_if_removed_from_sorting(client):
    cat_id = create_category(client, "RemoveDel", "MdRemoveDel")
    response = client.delete(f"/category-sorting/{cat_id}")
    assert response.status_code == 204
    response = client.delete(f"/categories/{cat_id}")
    assert response.status_code == 204
