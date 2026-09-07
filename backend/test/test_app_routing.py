"""App-Ebene: Routing, CORS, Fehlermodell-Mapping, OpenAPI."""
import pytest


def test_openapi_reachable(client):
    assert client.get("/openapi.json").status_code == 200


def test_unknown_route_404(client):
    assert client.get("/api/gibtsnicht").status_code == 404


def test_openapi_contains_all_prefixes(client):
    paths = client.get("/openapi.json").json()["paths"]
    joined = " ".join(paths)
    for p in ["/api/catalogs", "/api/events", "/api/active-order", "/api/bills", "/api/statistics"]:
        assert p in joined


def test_cors_allows_configured_origin(client):
    r = client.get(
        "/api/catalogs", headers={"Origin": "http://localhost:3000"}
    )
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_cors_disallows_unknown_origin(client):
    r = client.get("/api/catalogs", headers={"Origin": "http://evil.example"})
    assert r.headers.get("access-control-allow-origin") is None


def test_cors_preflight(client):
    r = client.options(
        "/api/catalogs",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert r.status_code in (200, 204)
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_domain_error_shape_404(client):
    r = client.get("/api/catalogs/999999")
    assert r.status_code == 404
    body = r.json()
    assert set(body.keys()) == {"detail"}
    assert isinstance(body["detail"], str)


def test_domain_error_shape_409(client, catalog_id):
    client.post("/api/catalogs", json={"name": "Dup"})
    r = client.post("/api/catalogs", json={"name": "Dup"})
    assert r.status_code == 409 and "detail" in r.json()


@pytest.mark.parametrize(
    "path,body",
    [
        ("/api/catalogs", {"name": 123}),
        ("/api/catalogs", {}),
        ("/api/events", {"catalog_id": "nope", "name": "x"}),
        ("/api/active-order/lines", {"variant_id": "x", "delta": "1"}),
    ],
)
def test_malformed_body_422(client, path, body):
    assert client.post(path, json=body).status_code == 422
