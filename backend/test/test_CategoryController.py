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

def test_get_all_categories_empty():
    response = client.get("/categories/")
    assert response.status_code == 200
    assert response.json() == []

def test_get_all_categories_single():
    dao = [("TestCat1", "icon1")]
    for name, icon in dao:
        client.post("/categories/", json={"name": name, "icon": icon})
    response = client.get("/categories/")
    assert response.status_code == 200
    data = response.json()
    assert data[0]["name"] == dao[0][0]
    assert data[0]["icon"] == dao[0][1]

def test_get_all_categories_special_characters():
    dao = [("Küche & Bar", "MdKitchen"), ("🍕 Pizza", "MdPizza")]
    for name, icon in dao: client.post("/categories/", json={"name": name, "icon": icon})
    response = client.get("/categories/")
    assert response.status_code == 200
    data = response.json()
    assert any(cat["name"] == "Küche & Bar" for cat in data)
    assert any(cat["name"] == "🍕 Pizza" for cat in data)

def test_get_category_by_id_success():
    response = client.post("/categories/", json={"name": "TestCat", "icon": "MdTest"})
    assert response.status_code == 201
    cat_id = response.json()["id"]
    response = client.get(f"/categories/{cat_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == cat_id
    assert data["name"] == "TestCat"
    assert data["icon"] == "MdTest"

def test_get_category_by_id_not_found():
    response = client.get("/categories/9999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Kategorie nicht gefunden"

def test_get_category_by_id_invalid_id():
    response = client.get("/categories/abc")
    assert response.status_code == 422

def test_get_category_by_id_special_characters():
    response = client.post("/categories/", json={"name": "Küche & Bar2", "icon": "MdKitchen"})
    assert response.status_code == 201
    cat_id = response.json()["id"]
    response = client.get(f"/categories/{cat_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Küche & Bar2"

def test_get_category_by_id_deleted():
    response = client.post("/categories/", json={"name": "ToDelete", "icon": "MdDelete"})
    assert response.status_code == 201
    cat_id = response.json()["id"]
    del_response = client.delete(f"/categories/{cat_id}")
    assert del_response.status_code == 204
    response = client.get(f"/categories/{cat_id}")
    assert response.status_code == 404

def test_create_category_success():
    response = client.post("/categories/", json={"name": "NeueKategorie", "icon": "MdIcon"})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "NeueKategorie"
    assert data["icon"] == "MdIcon"

def test_create_category_duplicate_name():
    client.post("/categories/", json={"name": "Doppelt", "icon": "MdA"})
    response = client.post("/categories/", json={"name": "Doppelt", "icon": "MdB"})
    assert response.status_code == 400
    assert "existiert bereits" in response.json()["detail"]

def test_create_category_empty_name():
    response = client.post("/categories/", json={"name": "", "icon": "MdIcon"})
    assert response.status_code == 400
    assert "Name darf nicht leer sein" in response.json()["detail"]

def test_create_category_empty_icon():
    response = client.post("/categories/", json={"name": "Test", "icon": ""})
    assert response.status_code == 400
    assert "Icon darf nicht leer sein" in response.json()["detail"]

def test_create_category_missing_fields():
    response = client.post("/categories/", json={"name": "NurName"})
    assert response.status_code == 422

def test_update_category_success():
    resp = client.post("/categories/", json={"name": "Alt", "icon": "MdAlt"})
    cat_id = resp.json()["id"]
    response = client.put(f"/categories/{cat_id}", json={"name": "Neu", "icon": "MdNeu"})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Neu"
    assert data["icon"] == "MdNeu"

def test_update_category_not_found():
    response = client.put("/categories/9999", json={"name": "X", "icon": "MdX"})
    assert response.status_code == 404
    assert "nicht gefunden" in response.json()["detail"]

def test_update_category_duplicate_name():
    client.post("/categories/", json={"name": "A", "icon": "MdA"})
    resp = client.post("/categories/", json={"name": "B", "icon": "MdB"})
    cat_id = resp.json()["id"]
    response = client.put(f"/categories/{cat_id}", json={"name": "A", "icon": "MdB"})
    assert response.status_code == 400
    assert "existiert bereits" in response.json()["detail"]

def test_update_category_empty_name():
    resp = client.post("/categories/", json={"name": "C", "icon": "MdC"})
    cat_id = resp.json()["id"]
    response = client.put(f"/categories/{cat_id}", json={"name": "", "icon": "MdC"})
    assert response.status_code == 400
    assert "Name darf nicht leer sein" in response.json()["detail"]

def test_update_category_empty_icon():
    resp = client.post("/categories/", json={"name": "D", "icon": "MdD"})
    cat_id = resp.json()["id"]
    response = client.put(f"/categories/{cat_id}", json={"name": "D", "icon": ""})
    assert response.status_code == 400
    assert "Icon darf nicht leer sein" in response.json()["detail"]

def test_update_category_missing_fields():
    resp = client.post("/categories/", json={"name": "E", "icon": "MdE"})
    cat_id = resp.json()["id"]
    response = client.put(f"/categories/{cat_id}", json={"name": "E"})
    assert response.status_code == 422

def test_delete_category_success():
    resp = client.post("/categories/", json={"name": "DelCat", "icon": "MdDel"})
    cat_id = resp.json()["id"]
    response = client.delete(f"/categories/{cat_id}")
    assert response.status_code == 204
    response = client.get(f"/categories/{cat_id}")
    assert response.status_code == 404

def test_delete_category_not_found():
    response = client.delete("/categories/9999")
    assert response.status_code == 404
    assert "nicht gefunden" in response.json()["detail"]

def test_create_category_whitespace_name():
    response = client.post("/categories/", json={"name": "   ", "icon": "MdIcon"})
    assert response.status_code == 400
    assert "Name darf nicht leer sein" in response.json()["detail"]

def test_create_category_whitespace_icon():
    response = client.post("/categories/", json={"name": "Test", "icon": "   "})
    assert response.status_code == 400
    assert "Icon darf nicht leer sein" in response.json()["detail"]

def test_create_category_long_name():
    long_name = "A" * 100  # Über 50 Zeichen
    response = client.post("/categories/", json={"name": long_name, "icon": "MdIcon"})
    assert response.status_code in (400, 422)  # Je nach Validierung

def test_create_category_long_icon():
    long_icon = "I" * 100
    response = client.post("/categories/", json={"name": "Test", "icon": long_icon})
    assert response.status_code in (400, 422)

def test_create_category_case_sensitive():
    client.post("/categories/", json={"name": "TestCase", "icon": "MdA"})
    response = client.post("/categories/", json={"name": "testcase", "icon": "MdB"})
    assert response.status_code == 201

def test_update_category_no_change():
    resp = client.post("/categories/", json={"name": "NoChange", "icon": "MdNo"})
    cat_id = resp.json()["id"]
    response = client.put(f"/categories/{cat_id}", json={"name": "NoChange", "icon": "MdNo"})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "NoChange"
    assert data["icon"] == "MdNo"

def test_delete_category_twice():
    resp = client.post("/categories/", json={"name": "Twice", "icon": "MdTwice"})
    cat_id = resp.json()["id"]
    response = client.delete(f"/categories/{cat_id}")
    assert response.status_code == 204
    response = client.delete(f"/categories/{cat_id}")
    assert response.status_code == 404

def test_create_category_unicode():
    response = client.post("/categories/", json={"name": "测试", "icon": "MdUnicode"})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "测试"

def test_update_category_unicode():
    resp = client.post("/categories/", json={"name": "UpdateUnicode", "icon": "MdU"})
    cat_id = resp.json()["id"]
    response = client.put(f"/categories/{cat_id}", json={"name": "更新", "icon": "MdU"})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "更新"

def test_create_category_null_name():
    response = client.post("/categories/", json={"name": None, "icon": "MdIcon"})
    assert response.status_code == 422

def test_update_category_null_icon():
    resp = client.post("/categories/", json={"name": "NullIcon", "icon": "MdIcon"})
    cat_id = resp.json()["id"]
    response = client.put(f"/categories/{cat_id}", json={"name": "NullIcon", "icon": None})
    assert response.status_code == 422