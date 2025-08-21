import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app import app
from database import get_db
from entity.DAO import Base

TEST_DATABASE_HOST = os.getenv("DATABASE_HOST", "postgres_db")
SQLALCHEMY_TEST_DATABASE_URL = f"postgresql://root:root@{TEST_DATABASE_HOST}:5432/huettenzauber_test"
engine = create_engine(SQLALCHEMY_TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
@pytest.fixture(autouse=True)
def setup_and_teardown():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
client = TestClient(app)

def create_category(name, icon):
    response = client.post("/categories/", json={"name": name, "icon": icon})
    if(response.status_code != 201): print(response.status_code, response.json())
    assert response.status_code == 201
    return response.json()["id"]

def test_remove_category_from_sorting_success():
    cat_id = create_category("C", "MdC")
    response = client.delete(f"/category-sorting/{cat_id}")
    assert response.status_code == 204

def test_remove_category_from_sorting_not_found():
    response = client.delete("/category-sorting/9999")
    assert response.status_code == 404

def test_move_category_success():
    cat1 = create_category("D", "MdD")
    cat2 = create_category("E", "MdE")
    response = client.put(f"/category-sorting/move/{cat1}?sort_order=2")
    assert response.status_code == 200
    data = response.json()
    assert data["category_id"] == cat1
    assert data["sort_order"] == 2

def test_move_category_invalid_sort_order():
    cat_id = create_category("F", "MdF")
    response = client.put(f"/category-sorting/move/{cat_id}?sort_order=0")
    assert response.status_code == 400
    response = client.put(f"/category-sorting/move/{cat_id}?sort_order=99")
    assert response.status_code == 400

def test_move_category_not_found():
    response = client.put("/category-sorting/move/9999?sort_order=1")
    assert response.status_code == 400

def test_bulk_update_sorting_success():
    cat1 = create_category("G", "MdG")
    cat2 = create_category("H", "MdH")
    cat3 = create_category("I", "MdI")
    response = client.put("/category-sorting/bulk", json={"ordered_category_ids": [cat3, cat1, cat2]})
    assert response.status_code == 204
    response = client.get("/category-sorting/")
    assert response.status_code == 200
    data = response.json()
    assert data[0]["category_id"] == cat3
    assert data[1]["category_id"] == cat1
    assert data[2]["category_id"] == cat2

def test_bulk_update_sorting_empty_list():
    response = client.put("/category-sorting/bulk", json={"ordered_category_ids": []})
    assert response.status_code == 400

def test_bulk_update_sorting_duplicates():
    cat1 = create_category("J", "MdJ")
    cat2 = create_category("K", "MdK")
    response = client.put("/category-sorting/bulk", json={"ordered_category_ids": [cat1, cat1]})
    assert response.status_code == 400

def test_bulk_update_sorting_missing_category():
    cat1 = create_category("L", "MdL")
    response = client.put("/category-sorting/bulk", json={"ordered_category_ids": [cat1, 9999]})
    assert response.status_code == 400

def test_get_all_sortings():
    cat1 = create_category("M", "MdM")
    cat2 = create_category("N", "MdN")
    response = client.get("/category-sorting/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["sort_order"] == 1
    assert data[1]["sort_order"] == 2

def test_remove_category_from_sorting_twice():
    cat_id = create_category("Twice", "MdTwice")
    response = client.delete(f"/category-sorting/{cat_id}")
    assert response.status_code == 204
    response = client.delete(f"/category-sorting/{cat_id}")
    assert response.status_code == 404

def test_move_category_to_same_position():
    cat_id = create_category("Same", "MdSame")
    response = client.put(f"/category-sorting/move/{cat_id}?sort_order=1")
    assert response.status_code == 200
    data = response.json()
    assert data["sort_order"] == 1

def test_move_category_with_string_sort_order():
    cat_id = create_category("StrSort", "MdStrSort")
    response = client.put(f"/category-sorting/move/{cat_id}?sort_order=abc")
    assert response.status_code == 422

def test_move_category_with_missing_sort_order():
    cat_id = create_category("MissSort", "MdMissSort")
    response = client.put(f"/category-sorting/move/{cat_id}")
    assert response.status_code == 422

def test_bulk_update_sorting_with_non_int_id():
    cat1 = create_category("BulkA", "MdBulkA")
    response = client.put("/category-sorting/bulk", json={"ordered_category_ids": [cat1, "abc"]})
    assert response.status_code == 422

def test_bulk_update_sorting_with_only_one_category():
    cat1 = create_category("BulkOne", "MdBulkOne")
    response = client.put("/category-sorting/bulk", json={"ordered_category_ids": [cat1]})
    assert response.status_code == 204

def test_bulk_update_sorting_with_all_categories_reversed():
    cat1 = create_category("BulkRevA", "MdBulkRevA")
    cat2 = create_category("BulkRevB", "MdBulkRevB")
    cat3 = create_category("BulkRevC", "MdBulkRevC")
    response = client.put("/category-sorting/bulk", json={"ordered_category_ids": [cat3, cat2, cat1]})
    assert response.status_code == 204
    response = client.get("/category-sorting/")
    data = response.json()
    assert data[0]["category_id"] == cat3
    assert data[1]["category_id"] == cat2
    assert data[2]["category_id"] == cat1

def test_bulk_update_sorting_with_missing_json_field():
    response = client.put("/category-sorting/bulk", json={})
    assert response.status_code == 422

def test_bulk_update_sorting_with_null_in_list():
    cat1 = create_category("BulkNull", "MdBulkNull")
    response = client.put("/category-sorting/bulk", json={"ordered_category_ids": [cat1, None]})
    assert response.status_code == 422

def test_bulk_update_sorting_with_extra_category():
    cat1 = create_category("BulkExtra", "MdBulkExtra")
    response = client.put("/category-sorting/bulk", json={"ordered_category_ids": [cat1, 9999]})
    assert response.status_code == 400

def test_get_all_sortings_empty():
    response = client.get("/category-sorting/")
    assert response.status_code == 200
    assert response.json() == []

def test_remove_category_from_sorting_with_string_id():
    response = client.delete("/category-sorting/abc")
    assert response.status_code == 422

def test_move_category_with_string_id():
    response = client.put("/category-sorting/move/abc?sort_order=1")
    assert response.status_code == 422

def test_bulk_update_sorting_with_string_id():
    response = client.put("/category-sorting/bulk", json={"ordered_category_ids": ["abc"]})
    assert response.status_code == 422

def test_move_category_with_null_sort_order():
    cat_id = create_category("NullMove", "MdNullMove")
    response = client.put(f"/category-sorting/move/{cat_id}?sort_order=")
    assert response.status_code == 422

def test_category_sorting_entry_created_on_category_create():
    cat_id = create_category("AutoSort", "MdAuto")
    response = client.get("/category-sorting/")
    assert response.status_code == 200
    data = response.json()
    assert any(entry["category_id"] == cat_id for entry in data)

def test_category_sorting_sort_order_is_incremented():
    cat1 = create_category("SortA", "MdSortA")
    cat2 = create_category("SortB", "MdSortB")
    response = client.get("/category-sorting/")
    data = response.json()
    sort_orders = [entry["sort_order"] for entry in data if entry["category_id"] in (cat1, cat2)]
    assert sorted(sort_orders) == [1, 2]

def test_category_sorting_entry_deleted_on_category_delete():
    cat_id = create_category("DelSort", "MdDelSort")
    response = client.delete(f"/categories/{cat_id}")
    assert response.status_code == 204
    response = client.get("/category-sorting/")
    data = response.json()
    assert not any(entry["category_id"] == cat_id for entry in data)

def test_category_sorting_bulk_update_after_auto_creation():
    cat1 = create_category("BulkAutoA", "MdBulkAutoA")
    cat2 = create_category("BulkAutoB", "MdBulkAutoB")
    cat3 = create_category("BulkAutoC", "MdBulkAutoC")
    response = client.put("/category-sorting/bulk", json={"ordered_category_ids": [cat3, cat1, cat2]})
    assert response.status_code == 204
    response = client.get("/category-sorting/")
    data = response.json()
    assert data[0]["category_id"] == cat3
    assert data[1]["category_id"] == cat1
    assert data[2]["category_id"] == cat2

def test_category_sorting_entry_exists_after_update():
    cat_id = create_category("UpdateSort", "MdUpdateSort")
    response = client.put(f"/category-sorting/move/{cat_id}?sort_order=1")
    assert response.status_code == 200
    response = client.get("/category-sorting/")
    data = response.json()
    assert any(entry["category_id"] == cat_id for entry in data)

def test_category_sorting_entry_removed_then_readded():
    cat_id = create_category("RemoveReadd", "MdRemoveReadd")
    response = client.delete(f"/category-sorting/{cat_id}")
    assert response.status_code == 204
    response = client.get("/category-sorting/")
    data = response.json()
    assert not any(entry["category_id"] == cat_id for entry in data)
    response = client.put("/category-sorting/bulk", json={"ordered_category_ids": [cat_id]})
    assert response.status_code == 400

def test_category_sorting_entry_removed_on_category_delete_even_if_removed_from_sorting():
    cat_id = create_category("RemoveDel", "MdRemoveDel")
    response = client.delete(f"/category-sorting/{cat_id}")
    assert response.status_code == 204
    response = client.delete(f"/categories/{cat_id}")
    assert response.status_code == 204