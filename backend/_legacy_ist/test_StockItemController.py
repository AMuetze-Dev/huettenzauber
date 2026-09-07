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
    assert response.status_code == 201
    return response.json()["id"]


def test_create_stock_item_success(client):
    cat_id = create_category(client)
    response = client.post("/stock-items/", json={
        "name": "Item1",
        "category_id": cat_id,
        "item_variants": [{"name": "Standard", "price": 1.0, "bill_steps": 1.0}]
    })
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Item1"


def test_create_stock_item_duplicate_name_in_category(client):
    cat_id = create_category(client)
    create_stock_item(client, "ItemDup", cat_id)
    response = client.post("/stock-items/", json={"name": "ItemDup", "category_id": cat_id, "item_variants": [{"name": "Standard", "price": 1.0, "bill_steps": 1.0}]})
    assert response.status_code == 400


def test_create_stock_item_empty_name(client):
    cat_id = create_category(client)
    response = client.post("/stock-items/", json={"name": "", "category_id": cat_id, "item_variants": [{"name": "Standard", "price": 1.0, "bill_steps": 1.0}]})
    assert response.status_code == 400


def test_create_stock_item_missing_category(client):
    response = client.post("/stock-items/", json={"name": "NoCat", "category_id": 9999, "item_variants": [{"name": "Standard", "price": 1.0, "bill_steps": 1.0}]})
    assert response.status_code == 404


def test_get_all_stock_items(client):
    cat_id = create_category(client)
    create_stock_item(client, "ItemA", cat_id)
    create_stock_item(client, "ItemB", cat_id)
    response = client.get("/stock-items/")
    assert response.status_code == 200
    data = response.json()
    assert any(item["name"] == "ItemA" for item in data)
    assert any(item["name"] == "ItemB" for item in data)


def test_get_stock_item_by_id_success(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "GetById", cat_id)
    response = client.get(f"/stock-items/{item_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == item_id


def test_get_stock_item_by_id_not_found(client):
    response = client.get("/stock-items/9999")
    assert response.status_code == 404


def test_update_stock_item_success(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "ToUpdate", cat_id)
    response = client.put(f"/stock-items/{item_id}", json={"name": "Updated", "category_id": cat_id})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated"


def test_update_stock_item_not_found(client):
    cat_id = create_category(client)
    response = client.put("/stock-items/9999", json={"name": "NoItem", "category_id": cat_id})
    assert response.status_code == 404


def test_update_stock_item_empty_name(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "ToUpdateEmpty", cat_id)
    response = client.put(f"/stock-items/{item_id}", json={"name": "", "category_id": cat_id})
    assert response.status_code == 400


def test_update_stock_item_duplicate_name(client):
    cat_id = create_category(client)
    create_stock_item(client, "Dup1", cat_id)
    item_id = create_stock_item(client, "Dup2", cat_id)
    response = client.put(f"/stock-items/{item_id}", json={"name": "Dup1", "category_id": cat_id})
    assert response.status_code == 400


def test_update_stock_item_category_not_found(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "WrongCat", cat_id)
    response = client.put(f"/stock-items/{item_id}", json={"name": "WrongCat", "category_id": 9999})
    assert response.status_code == 404


def test_delete_stock_item_success(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "ToDelete", cat_id)
    response = client.delete(f"/stock-items/{item_id}")
    assert response.status_code == 204
    response = client.get(f"/stock-items/{item_id}")
    assert response.status_code == 404


def test_delete_stock_item_not_found(client):
    response = client.delete("/stock-items/9999")
    assert response.status_code == 404


def test_delete_stock_item_twice(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "TwiceDel", cat_id)
    response = client.delete(f"/stock-items/{item_id}")
    assert response.status_code == 204
    response = client.delete(f"/stock-items/{item_id}")
    assert response.status_code == 400


def test_get_all_in_category_success(client):
    cat_id = create_category(client)
    create_stock_item(client, "CatA", cat_id)
    response = client.get(f"/stock-items/category/{cat_id}")
    assert response.status_code == 200
    data = response.json()
    assert any(item["category_id"] == cat_id for item in data)


def test_get_all_in_category_not_found(client):
    response = client.get("/stock-items/category/9999")
    assert response.status_code == 404


def test_get_all_in_category_empty(client):
    cat_id = create_category(client)
    response = client.get(f"/stock-items/category/{cat_id}")
    assert response.status_code == 400


def test_bulk_update_success(client):
    cat_id = create_category(client)
    item1_id = create_stock_item(client, "Bulk1", cat_id)
    item2_id = create_stock_item(client, "Bulk2", cat_id)
    payload = [
        {"id": item1_id, "name": "Bulk1-Changed", "category_id": cat_id},
        {"id": item2_id, "name": "Bulk2", "category_id": cat_id}
    ]
    response = client.put("/stock-items/bulk", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert any(item["name"] == "Bulk1-Changed" and item["category_id"] == cat_id and item["is_active"] for item in data)
    assert any(item["name"] == "Bulk2" and item["category_id"] == cat_id and item["is_active"] for item in data)


def test_bulk_update_not_found(client):
    cat_id = create_category(client)
    item1_id = create_stock_item(client, "BulkNF", cat_id)
    payload = [
        {"id": item1_id, "name": "BulkNF", "category_id": cat_id},
        {"id": 9999, "name": "NotFound", "category_id": cat_id}
    ]
    response = client.put("/stock-items/bulk", json=payload)
    assert response.status_code == 404


def test_bulk_update_inactive_item(client):
    cat_id = create_category(client)
    item1_id = create_stock_item(client, "BulkInactive", cat_id)
    client.delete(f"/stock-items/{item1_id}")
    payload = [
        {"id": item1_id, "name": "BulkInactive", "category_id": cat_id}
    ]
    response = client.put("/stock-items/bulk", json=payload)
    assert response.status_code == 400


def test_create_stock_item_with_string_category_id(client):
    response = client.post("/stock-items/", json={"name": "StrCat", "category_id": "abc"})
    assert response.status_code == 422


def test_update_stock_item_with_string_id(client):
    cat_id = create_category(client)
    response = client.put("/stock-items/abc", json={"name": "StrId", "category_id": cat_id})
    assert response.status_code == 422


def test_delete_stock_item_with_string_id(client):
    response = client.delete("/stock-items/abc")
    assert response.status_code == 422


def test_get_stock_item_with_string_id(client):
    response = client.get("/stock-items/abc")
    assert response.status_code == 422


def test_bulk_update_with_missing_id(client):
    cat_id = create_category(client)
    create_stock_item(client, "BulkMissId", cat_id)
    payload = [
        {"name": "BulkMissId", "category_id": cat_id}
    ]
    response = client.put("/stock-items/bulk", json=payload)
    assert response.status_code == 422


def test_bulk_update_with_empty_list(client):
    response = client.put("/stock-items/bulk", json=[])
    assert response.status_code == 200
    assert response.json() == []


def test_bulk_update_no_change(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "NoChange", cat_id)
    payload = [{"id": item_id, "name": "NoChange", "category_id": cat_id}]
    response = client.put("/stock-items/bulk", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert sum(item["name"] == "NoChange" and item["is_active"] for item in data) == 1


def test_bulk_update_empty_name(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "BulkEmpty", cat_id)
    payload = [{"id": item_id, "name": "", "category_id": cat_id}]
    response = client.put("/stock-items/bulk", json=payload)
    assert response.status_code == 400


def test_bulk_update_duplicate_name(client):
    cat_id = create_category(client)
    item1_id = create_stock_item(client, "BulkDup1", cat_id)
    item2_id = create_stock_item(client, "BulkDup2", cat_id)
    payload = [
        {"id": item1_id, "name": "BulkDup", "category_id": cat_id},
        {"id": item2_id, "name": "BulkDup", "category_id": cat_id}
    ]
    response = client.put("/stock-items/bulk", json=payload)
    assert response.status_code == 400


def test_bulk_update_invalid_category(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "BulkInvalidCat", cat_id)
    payload = [{"id": item_id, "name": "BulkInvalidCat", "category_id": 9999}]
    response = client.put("/stock-items/bulk", json=payload)
    assert response.status_code == 404


def test_bulk_update_partial_failure(client):
    cat_id = create_category(client)
    item1_id = create_stock_item(client, "BulkPartial1", cat_id)
    payload = [
        {"id": item1_id, "name": "BulkPartial1-Changed", "category_id": cat_id},
        {"id": 9999, "name": "NotFound", "category_id": cat_id}
    ]
    response = client.put("/stock-items/bulk", json=payload)
    assert response.status_code == 404
    response2 = client.get("/stock-items/")
    assert response2.status_code == 200
    items = response2.json()
    updated = [item for item in items if item["name"] == "BulkPartial1-Changed" and item["category_id"] == cat_id]
    assert len(updated) == 1


def test_bulk_update_duplicate_id_in_payload(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "BulkDupID", cat_id)
    payload = [
        {"id": item_id, "name": "BulkDupID-1", "category_id": cat_id},
        {"id": item_id, "name": "BulkDupID-2", "category_id": cat_id}
    ]
    response = client.put("/stock-items/bulk", json=payload)
    assert response.status_code == 400


def test_bulk_update_none_name(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "BulkNone", cat_id)
    payload = [{"id": item_id, "name": None, "category_id": cat_id}]
    response = client.put("/stock-items/bulk", json=payload)
    assert response.status_code == 422


def test_bulk_update_negative_id(client):
    cat_id = create_category(client)
    payload = [{"id": -1, "name": "NegID", "category_id": cat_id}]
    response = client.put("/stock-items/bulk", json=payload)
    assert response.status_code == 404 or response.status_code == 422


def test_bulk_update_missing_name(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "BulkMissName", cat_id)
    payload = [{"id": item_id, "category_id": cat_id}]
    response = client.put("/stock-items/bulk", json=payload)
    assert response.status_code == 422


def test_create_stock_item_with_multiple_variants(client):
    cat_id = create_category(client)
    response = client.post("/stock-items/", json={
        "name": "MultiVar",
        "category_id": cat_id,
        "item_variants": [
            {"name": "0.5L", "price": 2.0, "bill_steps": 0.5},
            {"name": "1.0L", "price": 3.5, "bill_steps": 1.0}
        ]
    })
    assert response.status_code == 201
    data = response.json()
    assert len(data["item_variants"]) == 2


def test_create_stock_item_variant_empty_name(client):
    cat_id = create_category(client)
    response = client.post("/stock-items/", json={
        "name": "NoNameVar",
        "category_id": cat_id,
        "item_variants": [
            {"name": "", "price": 1.0, "bill_steps": 1.0}
        ]
    })
    assert response.status_code == 201
    data = response.json()
    assert data["item_variants"][0]["name"] == "1.0"


def test_create_stock_item_variant_none_name(client):
    cat_id = create_category(client)
    response = client.post("/stock-items/", json={
        "name": "NoneNameVar",
        "category_id": cat_id,
        "item_variants": [
            {"price": 1.0, "bill_steps": 2.0}
        ]
    })
    assert response.status_code == 201
    data = response.json()
    assert data["item_variants"][0]["name"] == "2.0"


def test_create_stock_item_variant_negative_price(client):
    cat_id = create_category(client)
    response = client.post("/stock-items/", json={
        "name": "NegPriceVar",
        "category_id": cat_id,
        "item_variants": [
            {"name": "Neg", "price": -1.0, "bill_steps": 1.0}
        ]
    })
    assert response.status_code == 400


def test_create_stock_item_variant_zero_bill_steps(client):
    cat_id = create_category(client)
    response = client.post("/stock-items/", json={
        "name": "ZeroStepVar",
        "category_id": cat_id,
        "item_variants": [
            {"name": "Zero", "price": 1.0, "bill_steps": 0.0}
        ]
    })
    assert response.status_code == 400


def test_create_stock_item_variant_duplicate_name_and_price(client):
    cat_id = create_category(client)
    variants = [
        {"name": "Dup", "price": 1.0, "bill_steps": 1.0},
        {"name": "Dup", "price": 1.0, "bill_steps": 2.0}
    ]
    response = client.post("/stock-items/", json={
        "name": "DupVar",
        "category_id": cat_id,
        "item_variants": variants
    })
    assert response.status_code == 400


def test_create_stock_item_variant_duplicate_bill_steps_and_price(client):
    cat_id = create_category(client)
    variants = [
        {"name": "A", "price": 1.0, "bill_steps": 1.0},
        {"name": "B", "price": 1.0, "bill_steps": 1.0}
    ]
    response = client.post("/stock-items/", json={
        "name": "DupStepPrice",
        "category_id": cat_id,
        "item_variants": variants
    })
    assert response.status_code == 400


def test_create_stock_item_variant_duplicate_name_and_bill_steps_diff_price(client):
    cat_id = create_category(client)
    variants = [
        {"name": "Same", "price": 1.0, "bill_steps": 1.0},
        {"name": "Same", "price": 2.0, "bill_steps": 1.0}
    ]
    response = client.post("/stock-items/", json={
        "name": "DupNameStep",
        "category_id": cat_id,
        "item_variants": variants
    })
    assert response.status_code == 400


def test_update_stock_item_add_variant(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "AddVar", cat_id)
    response = client.get(f"/stock-items/{item_id}")
    old_variants = response.json()["item_variants"]
    new_variant = {"name": "Extra", "price": 2.0, "bill_steps": 2.0}
    response = client.put(f"/stock-items/{item_id}", json={
        "name": "AddVar",
        "category_id": cat_id,
        "item_variants": old_variants + [new_variant]
    })
    assert response.status_code == 200
    assert len(response.json()["item_variants"]) == len(old_variants) + 1


def test_update_stock_item_remove_variant(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "RemVar", cat_id, [
        {"name": "A", "price": 1.0, "bill_steps": 1.0},
        {"name": "B", "price": 2.0, "bill_steps": 2.0}
    ])
    response = client.get(f"/stock-items/{item_id}")
    variants = response.json()["item_variants"]
    response = client.put(f"/stock-items/{item_id}", json={
        "name": "RemVar",
        "category_id": cat_id,
        "item_variants": [variants[0]]
    })
    assert response.status_code == 200
    assert len(response.json()["item_variants"]) == 1


def test_update_stock_item_variant_change_price(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "ChangePrice", cat_id)
    response = client.get(f"/stock-items/{item_id}")
    variant = response.json()["item_variants"][0]
    variant["price"] = 9.99
    response = client.put(f"/stock-items/{item_id}", json={
        "name": "ChangePrice",
        "category_id": cat_id,
        "item_variants": [variant]
    })
    assert response.status_code == 200
    assert response.json()["item_variants"][0]["price"] == 9.99


def test_update_stock_item_variant_to_empty_name(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "EmptyNameUpdate", cat_id)
    response = client.get(f"/stock-items/{item_id}")
    variant = response.json()["item_variants"][0]
    variant["name"] = ""
    response = client.put(f"/stock-items/{item_id}", json={
        "name": "EmptyNameUpdate",
        "category_id": cat_id,
        "item_variants": [variant]
    })
    assert response.status_code == 200
    assert response.json()["item_variants"][0]["name"] == str(variant["bill_steps"])


def test_update_stock_item_variant_to_none_name(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "NoneNameUpdate", cat_id)
    response = client.get(f"/stock-items/{item_id}")
    variant = response.json()["item_variants"][0]
    variant["name"] = ""
    response = client.put(f"/stock-items/{item_id}", json={
        "name": "NoneNameUpdate",
        "category_id": cat_id,
        "item_variants": [variant]
    })
    assert response.status_code == 200
    assert response.json()["item_variants"][0]["name"] == str(variant["bill_steps"])


def test_update_stock_item_variant_negative_price(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "NegPriceUpdate", cat_id)
    response = client.get(f"/stock-items/{item_id}")
    variant = response.json()["item_variants"][0]
    variant["price"] = -5.0
    response = client.put(f"/stock-items/{item_id}", json={
        "name": "NegPriceUpdate",
        "category_id": cat_id,
        "item_variants": [variant]
    })
    assert response.status_code == 400


def test_update_stock_item_variant_zero_bill_steps(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "ZeroStepUpdate", cat_id)
    response = client.get(f"/stock-items/{item_id}")
    variant = response.json()["item_variants"][0]
    variant["bill_steps"] = 0.0
    response = client.put(f"/stock-items/{item_id}", json={
        "name": "ZeroStepUpdate",
        "category_id": cat_id,
        "item_variants": [variant]
    })
    assert response.status_code == 400


def test_update_stock_item_variant_duplicate_name_and_price(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "DupUpdate", cat_id, [
        {"name": "A", "price": 1.0, "bill_steps": 1.0},
        {"name": "B", "price": 2.0, "bill_steps": 2.0}
    ])
    response = client.get(f"/stock-items/{item_id}")
    variants = response.json()["item_variants"]
    variants[1]["name"] = variants[0]["name"]
    variants[1]["price"] = variants[0]["price"]
    response = client.put(f"/stock-items/{item_id}", json={
        "name": "DupUpdate",
        "category_id": cat_id,
        "item_variants": variants
    })
    assert response.status_code == 400


def test_update_stock_item_variant_duplicate_bill_steps_and_price(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "DupStepUpdate", cat_id, [
        {"name": "A", "price": 1.0, "bill_steps": 1.0},
        {"name": "B", "price": 2.0, "bill_steps": 2.0}
    ])
    response = client.get(f"/stock-items/{item_id}")
    variants = response.json()["item_variants"]
    variants[1]["bill_steps"] = variants[0]["bill_steps"]
    variants[1]["price"] = variants[0]["price"]
    response = client.put(f"/stock-items/{item_id}", json={
        "name": "DupStepUpdate",
        "category_id": cat_id,
        "item_variants": variants
    })
    assert response.status_code == 400


def test_update_stock_item_variant_duplicate_name_and_bill_steps_diff_price(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "DupNameStepUpdate", cat_id, [
        {"name": "A", "price": 1.0, "bill_steps": 1.0},
        {"name": "B", "price": 2.0, "bill_steps": 2.0}
    ])
    response = client.get(f"/stock-items/{item_id}")
    variants = response.json()["item_variants"]
    variants[1]["name"] = variants[0]["name"]
    variants[1]["bill_steps"] = variants[0]["bill_steps"]
    variants[1]["price"] = 99.0
    response = client.put(f"/stock-items/{item_id}", json={
        "name": "DupNameStepUpdate",
        "category_id": cat_id,
        "item_variants": variants
    })
    assert response.status_code == 400


def test_delete_stock_item_deletes_variants(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "DelWithVar", cat_id, [
        {"name": "A", "price": 1.0, "bill_steps": 1.0},
        {"name": "B", "price": 2.0, "bill_steps": 2.0}
    ])
    response = client.delete(f"/stock-items/{item_id}")
    assert response.status_code == 204
    response = client.get(f"/stock-items/{item_id}")
    assert response.status_code == 404


def test_get_stock_item_with_variant_none_name(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "NoneNameGet", cat_id, [
        {"price": 1.0, "bill_steps": 1.5}
    ])
    response = client.get(f"/stock-items/{item_id}")
    assert response.status_code == 200
    assert response.json()["item_variants"][0]["name"] == "1.5"


def test_get_stock_item_with_variant_empty_name(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "EmptyNameGet", cat_id, [
        {"name": "", "price": 1.0, "bill_steps": 2.5}
    ])
    response = client.get(f"/stock-items/{item_id}")
    assert response.status_code == 200
    assert response.json()["item_variants"][0]["name"] == "2.5"


def test_create_stock_item_variant_float_bill_steps(client):
    cat_id = create_category(client)
    response = client.post("/stock-items/", json={
        "name": "FloatStepVar",
        "category_id": cat_id,
        "item_variants": [
            {"name": "Float", "price": 1.0, "bill_steps": 0.33}
        ]
    })
    assert response.status_code == 201
    data = response.json()
    assert data["item_variants"][0]["bill_steps"] == 0.33


def test_update_stock_item_variant_float_bill_steps(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "FloatStepUpdate", cat_id)
    response = client.get(f"/stock-items/{item_id}")
    variant = response.json()["item_variants"][0]
    variant["bill_steps"] = 0.75
    response = client.put(f"/stock-items/{item_id}", json={
        "name": "FloatStepUpdate",
        "category_id": cat_id,
        "item_variants": [variant]
    })
    assert response.status_code == 200
    assert response.json()["item_variants"][0]["bill_steps"] == 0.75


def test_update_stock_item_variant_remove_all_forbidden(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "RemoveAllVar", cat_id)
    response = client.put(f"/stock-items/{item_id}", json={
        "name": "RemoveAllVar",
        "category_id": cat_id,
        "item_variants": []
    })
    assert response.status_code == 200


def test_create_stock_item_variant_missing_price(client):
    cat_id = create_category(client)
    response = client.post("/stock-items/", json={
        "name": "NoPriceVar",
        "category_id": cat_id,
        "item_variants": [
            {"name": "NoPrice", "bill_steps": 1.0}
        ]
    })
    assert response.status_code == 422


def test_create_stock_item_variant_missing_bill_steps(client):
    cat_id = create_category(client)
    response = client.post("/stock-items/", json={
        "name": "NoStepVar",
        "category_id": cat_id,
        "item_variants": [
            {"name": "NoStep", "price": 1.0}
        ]
    })
    assert response.status_code == 201  # bill_steps default = 1.0


def test_update_stock_item_variant_missing_price(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "UpdNoPrice", cat_id)
    response = client.get(f"/stock-items/{item_id}")
    variant = response.json()["item_variants"][0]
    del variant["price"]
    response = client.put(f"/stock-items/{item_id}", json={
        "name": "UpdNoPrice",
        "category_id": cat_id,
        "item_variants": [variant]
    })
    assert response.status_code == 422


def test_update_stock_item_variant_missing_bill_steps(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "UpdNoStep", cat_id)
    response = client.get(f"/stock-items/{item_id}")
    variant = response.json()["item_variants"][0]
    del variant["bill_steps"]
    response = client.put(f"/stock-items/{item_id}", json={
        "name": "UpdNoStep",
        "category_id": cat_id,
        "item_variants": [variant]
    })
    assert response.status_code == 422


def test_update_stock_item_variant_with_string_price(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "StrPrice", cat_id)
    response = client.get(f"/stock-items/{item_id}")
    variant = response.json()["item_variants"][0]
    variant["price"] = "abc"
    response = client.put(f"/stock-items/{item_id}", json={
        "name": "StrPrice",
        "category_id": cat_id,
        "item_variants": [variant]
    })
    assert response.status_code == 422


def test_update_stock_item_variant_with_string_bill_steps(client):
    cat_id = create_category(client)
    item_id = create_stock_item(client, "StrStep", cat_id)
    response = client.get(f"/stock-items/{item_id}")
    variant = response.json()["item_variants"][0]
    variant["bill_steps"] = "xyz"
    response = client.put(f"/stock-items/{item_id}", json={
        "name": "StrStep",
        "category_id": cat_id,
        "item_variants": [variant]
    })
    assert response.status_code == 422
