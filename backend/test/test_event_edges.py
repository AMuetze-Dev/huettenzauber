"""Randfälle Veranstaltung."""
import pytest


def _cat(client):
    return client.post("/api/catalogs", json={"name": "K"}).json()["id"]


def _ev(client, cid, name="F"):
    return client.post("/api/events", json={"catalog_id": cid, "name": name}).json()


@pytest.mark.parametrize("length,expected", [(1, 201), (80, 201), (81, 400)])
def test_event_name_length_boundary(client, length, expected):
    cid = _cat(client)
    r = client.post("/api/events", json={"catalog_id": cid, "name": "E" * length})
    assert r.status_code == expected


@pytest.mark.parametrize("name", ["", " ", "\t\n"])
def test_event_blank_name(client, name):
    cid = _cat(client)
    assert (
        client.post("/api/events", json={"catalog_id": cid, "name": name}).status_code
        == 400
    )


def test_event_catalog_not_found(client):
    assert (
        client.post("/api/events", json={"catalog_id": 999999, "name": "X"}).status_code
        == 404
    )


def test_event_get_not_found(client):
    assert client.get("/api/events/999999").status_code == 404


def test_event_get_string_id(client):
    assert client.get("/api/events/abc").status_code == 422


def test_activate_same_event_twice_idempotent(client):
    cid = _cat(client)
    e = _ev(client, cid)
    assert client.post(f"/api/events/{e['id']}/activate").status_code == 200
    r = client.post(f"/api/events/{e['id']}/activate")
    assert r.status_code == 200 and r.json()["is_active"] is True


def test_activate_not_found(client):
    assert client.post("/api/events/999999/activate").status_code == 404


def test_activate_third_deactivates_previous_two(client):
    cid = _cat(client)
    e1, e2, e3 = _ev(client, cid, "1"), _ev(client, cid, "2"), _ev(client, cid, "3")
    client.post(f"/api/events/{e1['id']}/activate")
    client.post(f"/api/events/{e2['id']}/activate")
    client.post(f"/api/events/{e3['id']}/activate")
    states = {x["id"]: x["is_active"] for x in client.get("/api/events").json()}
    assert states[e1["id"]] is False
    assert states[e2["id"]] is False
    assert states[e3["id"]] is True


def test_archive_inactive_event_sets_ended_at(client):
    cid = _cat(client)
    e = _ev(client, cid)  # nie aktiviert
    r = client.post(f"/api/events/{e['id']}/archive")
    assert r.status_code == 200
    assert r.json()["is_active"] is False and r.json()["ended_at"] is not None


def test_archive_is_idempotent_and_keeps_first_ended_at(client):
    cid = _cat(client)
    e = _ev(client, cid)
    first = client.post(f"/api/events/{e['id']}/archive").json()["ended_at"]
    second = client.post(f"/api/events/{e['id']}/archive").json()["ended_at"]
    assert first == second


def test_activate_archived_event_conflict(client):
    cid = _cat(client)
    e = _ev(client, cid)
    client.post(f"/api/events/{e['id']}/archive")
    assert client.post(f"/api/events/{e['id']}/activate").status_code == 409


def test_rename_archived_event_allowed(client):
    cid = _cat(client)
    e = _ev(client, cid)
    client.post(f"/api/events/{e['id']}/archive")
    assert (
        client.put(f"/api/events/{e['id']}", json={"name": "Archiv-Neu"}).status_code
        == 200
    )


def test_rename_event_blank(client):
    cid = _cat(client)
    e = _ev(client, cid)
    assert client.put(f"/api/events/{e['id']}", json={"name": "  "}).status_code == 400


def test_rename_event_not_found(client):
    assert client.put("/api/events/999999", json={"name": "X"}).status_code == 404


def test_delete_active_event_without_bills(client):
    cid = _cat(client)
    e = _ev(client, cid)
    client.post(f"/api/events/{e['id']}/activate")
    assert client.delete(f"/api/events/{e['id']}").status_code == 204
    assert client.get("/api/events/active").status_code == 204


def test_delete_event_not_found(client):
    assert client.delete("/api/events/999999").status_code == 404


def test_delete_catalog_with_event_blocked(client):
    cid = _cat(client)
    _ev(client, cid)
    assert client.delete(f"/api/catalogs/{cid}").status_code == 409


def test_events_active_204_when_none(client):
    assert client.get("/api/events/active").status_code == 204


def test_activating_new_event_gives_empty_active_order(client, active_event):
    _old_event_id, variant_id = active_event
    client.post("/api/active-order/lines", json={"variant_id": variant_id, "delta": "3"})
    # neue Veranstaltung im selben Katalog aktivieren
    cat = client.get("/api/events/active").json()["catalog_id"]
    e2 = client.post("/api/events", json={"catalog_id": cat, "name": "Neu"}).json()
    client.post(f"/api/events/{e2['id']}/activate")
    assert client.get("/api/active-order").json()["lines"] == []
