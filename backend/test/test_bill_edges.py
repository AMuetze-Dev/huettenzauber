"""Randfälle Bon-Liste, Storno, Tagesabschluss."""
from decimal import Decimal

from core.clock import business_day


def D(x):
    return Decimal(str(x))


def _bill(client, vid, qty="1"):
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": qty})
    r = client.post("/api/bills")
    assert r.status_code == 201
    return r.json()


# --- Anlegen -------------------------------------------------
def test_bill_empty_active_order_400(client, active_event):
    assert client.post("/api/bills").status_code == 400


def test_bill_clears_active_order_lines_and_deposit(client, active_event):
    _e, vid = active_event
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "2"})
    client.put(
        "/api/active-order/deposit-return", json={"unit_amount": "2", "quantity": 1}
    )
    client.post("/api/bills")
    ao = client.get("/api/active-order").json()
    assert ao["lines"] == []
    assert ao["deposit_returns"] == []


def test_bill_business_day_is_today(client, active_event):
    _e, vid = active_event
    b = _bill(client, vid)
    assert b["business_day"] == business_day().isoformat()


def test_bill_deposit_totals(client):
    cid = client.post("/api/catalogs", json={"name": "P"}).json()["id"]
    cat = client.post(f"/api/catalogs/{cid}/categories", json={"name": "W"}).json()["id"]
    it = client.post(
        f"/api/catalogs/{cid}/stock-items",
        json={
            "name": "Glühwein",
            "category_id": cat,
            "deposit_amount": "2.00",
            "variants": [{"name": "Tasse", "price": "4.50"}],
        },
    ).json()
    ev = client.post("/api/events", json={"catalog_id": cid, "name": "F"}).json()["id"]
    client.post(f"/api/events/{ev}/activate")
    vid = it["variants"][0]["id"]
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "3"})
    b = client.post("/api/bills").json()
    assert D(b["total_gross"]) == D("13.50")
    assert D(b["total_deposit"]) == D("6.00")


# --- Liste --------------------------------------------------
def test_list_bills_empty(client, active_event):
    assert client.get("/api/bills").json() == []


def test_list_bills_future_day_empty(client, active_event):
    _e, vid = active_event
    _bill(client, vid)
    assert client.get("/api/bills?day=2099-01-01").json() == []


def test_list_bills_order_newest_first(client, active_event):
    _e, vid = active_event
    a = _bill(client, vid)["id"]
    b = _bill(client, vid)["id"]
    ids = [x["id"] for x in client.get("/api/bills").json()]
    assert ids[0] == b and ids[1] == a


def test_get_bill_not_found(client):
    assert client.get("/api/bills/999999").status_code == 404


def test_get_bill_string_id(client):
    assert client.get("/api/bills/abc").status_code == 422


# --- Storno / Restore -----------------------------------
def test_void_removes_from_default_list_keeps_in_include_deleted(client, active_event):
    _e, vid = active_event
    b = _bill(client, vid)
    client.post(f"/api/bills/{b['id']}/void")
    assert client.get("/api/bills").json() == []
    assert len(client.get("/api/bills?include_deleted=true").json()) == 1


def test_void_twice_conflict(client, active_event):
    _e, vid = active_event
    b = _bill(client, vid)
    client.post(f"/api/bills/{b['id']}/void")
    assert client.post(f"/api/bills/{b['id']}/void").status_code == 409


def test_restore_not_voided_conflict(client, active_event):
    _e, vid = active_event
    b = _bill(client, vid)
    assert client.post(f"/api/bills/{b['id']}/restore").status_code == 409


def test_void_then_restore_roundtrip(client, active_event):
    _e, vid = active_event
    b = _bill(client, vid)
    client.post(f"/api/bills/{b['id']}/void")
    r = client.post(f"/api/bills/{b['id']}/restore")
    assert r.status_code == 200 and r.json()["is_deleted"] is False
    assert len(client.get("/api/bills").json()) == 1


def test_voided_bill_still_readable(client, active_event):
    _e, vid = active_event
    b = _bill(client, vid)
    client.post(f"/api/bills/{b['id']}/void")
    got = client.get(f"/api/bills/{b['id']}")
    assert got.status_code == 200 and got.json()["is_deleted"] is True


def test_void_not_found(client):
    assert client.post("/api/bills/999999/void").status_code == 404


def test_void_affects_day_summary_and_statistics(client, active_event):
    _e, vid = active_event
    b1 = _bill(client, vid)
    _bill(client, vid)
    client.post(f"/api/bills/{b1['id']}/void")
    s = client.get("/api/day-summary").json()
    assert s["bill_count"] == 1
    assert client.get("/api/statistics").json()["bill_count"] == 1
    # restore -> zurück
    client.post(f"/api/bills/{b1['id']}/restore")
    assert client.get("/api/day-summary").json()["bill_count"] == 2


# --- Tagesabschluss --------------------------------------
def test_day_close_before_get_404(client, active_event):
    assert client.get("/api/day-close").status_code == 404


def test_day_close_creates_marker_and_flips_closed(client, active_event):
    _e, vid = active_event
    _bill(client, vid)
    assert client.get("/api/day-summary").json()["closed"] is False
    r = client.post("/api/day-close")
    assert r.status_code == 200
    assert client.get("/api/day-close").status_code == 200
    assert client.get("/api/day-summary").json()["closed"] is True


def test_day_close_idempotent_updates_marker(client, active_event):
    _e, vid = active_event
    _bill(client, vid)
    first = client.post("/api/day-close").json()
    _bill(client, vid)
    second = client.post("/api/day-close").json()
    assert D(second["total_gross"]) > D(first["total_gross"])


def test_day_close_still_billable_after(client, active_event):
    _e, vid = active_event
    _bill(client, vid)
    client.post("/api/day-close")
    _bill(client, vid)
    assert client.get("/api/day-summary").json()["bill_count"] == 2


def test_day_close_with_no_bills_zero_marker(client, active_event):
    r = client.post("/api/day-close")
    assert r.status_code == 200
    assert D(r.json()["total_gross"]) == D(0)
