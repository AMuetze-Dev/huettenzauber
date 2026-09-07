from datetime import datetime


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
    return response.json()["id"], response.json()["item_variants"][0]["id"]


def create_bill_payload(client, n_items=1):
    cat_id = create_category(client, name=f"Cat_{n_items}_{datetime.now().timestamp()}")
    items = []
    for i in range(n_items):
        _, variant_id = create_stock_item(client, f"Item{i}_{datetime.now().timestamp()}", cat_id)
        items.append({
            "item_variant_id": variant_id,
            "item_quantity": i + 1,
        })
    return {"items": items}


# 1. Bill anlegen (ein Item)
def test_create_bill(client):
    payload = create_bill_payload(client)
    response = client.post("/bills/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert "date" in data
    assert len(data["items"]) == 1


# 2. Bill mit mehreren Items anlegen
def test_create_bill_multiple_items(client):
    payload = create_bill_payload(client, n_items=3)
    response = client.post("/bills/", json=payload)
    assert response.status_code == 201
    assert len(response.json()["items"]) == 3


# 3. Bill ohne Items (sollte fehlschlagen)
def test_create_bill_without_items(client):
    payload = {"items": []}
    response = client.post("/bills/", json=payload)
    assert response.status_code in (400, 422)


# 4. Bill mit ungültigem Variant (sollte fehlschlagen)
def test_create_bill_with_invalid_variant(client):
    payload = {"items": [{"item_variant_id": 999999, "item_quantity": 1}]}
    response = client.post("/bills/", json=payload)
    assert response.status_code == 400


# 5. Bill abrufen
def test_get_bill(client):
    payload = create_bill_payload(client)
    post = client.post("/bills/", json=payload)
    bill_id = post.json()["id"]
    response = client.get(f"/bills/{bill_id}")
    assert response.status_code == 200
    assert response.json()["id"] == bill_id


# 6. Nicht existierende Bill abrufen
def test_get_nonexistent_bill(client):
    response = client.get("/bills/999999")
    assert response.status_code == 404


# 7. Alle Bills abrufen (ohne gelöschte)
def test_list_bills(client):
    for _ in range(3):
        payload = create_bill_payload(client, n_items=1)
        client.post("/bills/", json=payload)
    response = client.get("/bills/")
    assert response.status_code == 200
    assert len(response.json()) >= 3


# 8. Bill löschen (soft-delete)
def test_delete_bill(client):
    payload = create_bill_payload(client)
    post = client.post("/bills/", json=payload)
    bill_id = post.json()["id"]
    response = client.delete(f"/bills/{bill_id}")
    assert response.status_code == 204
    response = client.get("/bills/")
    assert all(b["id"] != bill_id for b in response.json())


# 9. Gelöschte Bill ist in /bills/all enthalten
def test_deleted_bill_in_all(client):
    payload = create_bill_payload(client)
    post = client.post("/bills/", json=payload)
    bill_id = post.json()["id"]
    client.delete(f"/bills/{int(bill_id)}")
    response = client.get("/bills/all")
    assert any(b["id"] == bill_id and b.get("is_deleted", False) for b in response.json())


# 10. Mehrere Bills löschen und prüfen
def test_multiple_delete_and_all(client):
    ids = []
    for _ in range(3):
        payload = create_bill_payload(client, n_items=1)
        post = client.post("/bills/", json=payload)
        ids.append(post.json()["id"])
    for bill_id in ids:
        client.delete(f"/bills/{bill_id}")
    response = client.get("/bills/all")
    assert all(b.get("is_deleted", False) for b in response.json() if b["id"] in ids)


# 11. Löschen einer nicht existierenden Bill
def test_delete_nonexistent_bill(client):
    response = client.delete("/bills/999999")
    assert response.status_code == 404


# 12. Bill mit Menge 0 (sollte erlaubt oder abgelehnt werden)
def test_create_bill_with_zero_quantity(client):
    payload = create_bill_payload(client)
    payload["items"][0]["item_quantity"] = 0
    response = client.post("/bills/", json=payload)
    assert response.status_code in (201, 400, 422)


# 13. Bill mit negativem quantity (sollte abgelehnt werden)
def test_create_bill_with_negative_quantity(client):
    payload = create_bill_payload(client)
    payload["items"][0]["item_quantity"] = -1
    response = client.post("/bills/", json=payload)
    assert response.status_code in (400, 422)


# 14. Bill mit float quantity
def test_create_bill_with_float_quantity(client):
    payload = create_bill_payload(client)
    payload["items"][0]["item_quantity"] = 2.5
    response = client.post("/bills/", json=payload)
    assert response.status_code == 201


# 15. Bill mit gleichem Variant mehrfach (sollte erlaubt sein)
def test_create_bill_with_duplicate_variants(client):
    payload = create_bill_payload(client)
    variant_id = payload["items"][0]["item_variant_id"]
    payload["items"].append({"item_variant_id": variant_id, "item_quantity": 2})
    response = client.post("/bills/", json=payload)
    assert response.status_code == 201


# 16. Bill mit leerem Payload
def test_create_bill_empty_payload(client):
    response = client.post("/bills/", json={})
    assert response.status_code in (400, 422)


# 17. Bill mit vielen Items
def test_create_bill_many_items(client):
    payload = create_bill_payload(client, n_items=10)
    response = client.post("/bills/", json=payload)
    assert response.status_code == 201
    assert len(response.json()["items"]) == 10


# 18. Bill mit sehr großem quantity
def test_create_bill_large_quantity(client):
    payload = create_bill_payload(client)
    payload["items"][0]["item_quantity"] = 1e6
    response = client.post("/bills/", json=payload)
    assert response.status_code == 201


# 19. Bill mit sehr kleinem quantity
def test_create_bill_small_quantity(client):
    payload = create_bill_payload(client)
    payload["items"][0]["item_quantity"] = 0.0001
    response = client.post("/bills/", json=payload)
    assert response.status_code == 201


# 20. Bill nach Soft-Delete nicht mehr abrufbar
def test_get_deleted_bill(client):
    payload = create_bill_payload(client)
    post = client.post("/bills/", json=payload)
    bill_id = post.json()["id"]
    client.delete(f"/bills/{bill_id}")
    response = client.get(f"/bills/{bill_id}")
    assert response.status_code == 404


# 21. /bills/all gibt auch nicht-gelöschte zurück
def test_all_bills_with_deleted(client):
    payload = create_bill_payload(client)
    post = client.post("/bills/", json=payload)
    bill_id = post.json()["id"]
    response = client.get("/bills/all")
    assert any(b["id"] == bill_id for b in response.json())


# 22. /bills/all gibt alle Bills zurück (gelöscht und nicht gelöscht)
def test_all_bills_deleted_and_not_deleted(client):
    payload1 = create_bill_payload(client)
    payload2 = create_bill_payload(client)
    post1 = client.post("/bills/", json=payload1)
    post2 = client.post("/bills/", json=payload2)
    bill_id1 = post1.json()["id"]
    bill_id2 = post2.json()["id"]
    client.delete(f"/bills/{bill_id1}")
    response = client.get("/bills/all")
    ids = [b["id"] for b in response.json()]
    assert bill_id1 in ids and bill_id2 in ids


# 23. Bill mit string quantity (sollte abgelehnt werden)
def test_create_bill_with_string_quantity(client):
    payload = create_bill_payload(client)
    payload["items"][0]["item_quantity"] = "abc"
    response = client.post("/bills/", json=payload)
    assert response.status_code in (400, 422)


# 24. Bill mit negativem Variant-ID (sollte abgelehnt werden)
def test_create_bill_with_negative_variant_id(client):
    payload = create_bill_payload(client)
    payload["items"][0]["item_variant_id"] = -1
    response = client.post("/bills/", json=payload)
    assert response.status_code in (400, 404, 422)


# 25. Bill mit mehreren Bills und Soft-Delete nur eine
def test_soft_delete_one_of_many(client):
    payload1 = create_bill_payload(client)
    payload2 = create_bill_payload(client)
    post1 = client.post("/bills/", json=payload1)
    post2 = client.post("/bills/", json=payload2)
    bill_id1 = post1.json()["id"]
    bill_id2 = post2.json()["id"]
    client.delete(f"/bills/{bill_id1}")
    response = client.get(f"/bills/{bill_id2}")
    assert response.status_code == 200
    response = client.get(f"/bills/{bill_id1}")
    assert response.status_code == 404
