"""Optionaler Zugangscode fuer schreibende Endpunkte."""
import pytest

from core.config import settings


@pytest.fixture
def with_code(monkeypatch):
    monkeypatch.setattr(settings, "access_code", "geheim123")
    return "geheim123"


def test_reads_stay_open_with_code(client, with_code):
    assert client.get("/api/catalogs").status_code == 200
    assert client.get("/api/health").status_code == 200


def test_write_without_code_is_401(client, with_code):
    r = client.post("/api/catalogs", json={"name": "X"})
    assert r.status_code == 401
    assert "Zugangscode" in r.json()["detail"]


def test_write_with_wrong_code_is_401(client, with_code):
    r = client.post(
        "/api/catalogs", json={"name": "X"}, headers={"X-Access-Code": "falsch"}
    )
    assert r.status_code == 401


def test_write_with_correct_code_succeeds(client, with_code):
    r = client.post(
        "/api/catalogs", json={"name": "X"}, headers={"X-Access-Code": with_code}
    )
    assert r.status_code == 201


@pytest.mark.parametrize("method", ["put", "delete", "post"])
def test_all_write_methods_guarded(client, with_code, method):
    cat = client.post(
        "/api/catalogs", json={"name": "Guard"}, headers={"X-Access-Code": with_code}
    ).json()
    fn = getattr(client, method)
    path = f"/api/catalogs/{cat['id']}"
    r = fn(path, json={"name": "Neu"}) if method != "delete" else fn(path)
    assert r.status_code == 401


def test_access_check_reports_required_and_validity(client, with_code):
    r = client.get("/api/access-check")
    assert r.json() == {"required": True, "valid": False}
    r = client.get("/api/access-check", headers={"X-Access-Code": with_code})
    assert r.json() == {"required": True, "valid": True}


def test_health_announces_requirement(client, with_code):
    assert client.get("/api/health").json()["access_code_required"] is True


def test_no_code_configured_means_open(client):
    assert client.post("/api/catalogs", json={"name": "Offen"}).status_code == 201
    assert client.get("/api/health").json()["access_code_required"] is False
