"""Stufe 5 - Bon-Liste, Storno (weich/umkehrbar), Tagesabschluss."""
from decimal import Decimal


def _D(x):
    return Decimal(str(x))


def _bill(client, variant_id, qty="2"):
    client.post("/api/active-order/lines", json={"variant_id": variant_id, "delta": qty})
    r = client.post("/api/bills")
    assert r.status_code == 201
    return r.json()


def test_list_bills_today(client, active_event):
    _event_id, variant_id = active_event
    assert client.get("/api/bills").json() == []
    b = _bill(client, variant_id)
    rows = client.get("/api/bills").json()
    assert len(rows) == 1
    assert rows[0]["id"] == b["id"]
    assert rows[0]["position_count"] == 1
    assert _D(rows[0]["total_gross"]) == _D("9.20")


def test_get_bill_detail(client, active_event):
    _event_id, variant_id = active_event
    b = _bill(client, variant_id)
    got = client.get(f"/api/bills/{b['id']}")
    assert got.status_code == 200
    assert len(got.json()["items"]) == 1
    assert got.json()["items"][0]["item_name"] == "Helles"


def test_get_bill_404(client):
    assert client.get("/api/bills/9999").status_code == 404


def test_void_and_restore_bill(client, active_event):
    _event_id, variant_id = active_event
    b = _bill(client, variant_id)

    r = client.post(f"/api/bills/{b['id']}/void")
    assert r.status_code == 200 and r.json()["is_deleted"] is True
    assert client.get("/api/bills").json() == []                       # aus Liste raus
    assert len(client.get("/api/bills?include_deleted=true").json()) == 1
    assert client.post(f"/api/bills/{b['id']}/void").status_code == 409  # schon storniert

    r = client.post(f"/api/bills/{b['id']}/restore")
    assert r.status_code == 200 and r.json()["is_deleted"] is False
    assert len(client.get("/api/bills").json()) == 1
    assert client.post(f"/api/bills/{b['id']}/restore").status_code == 409


def test_day_summary_excludes_voided(client, active_event):
    _event_id, variant_id = active_event
    b1 = _bill(client, variant_id)          # 9,20
    _bill(client, variant_id)               # 9,20
    client.post(f"/api/bills/{b1['id']}/void")

    s = client.get("/api/day-summary").json()
    assert s["bill_count"] == 1
    assert _D(s["total_gross"]) == _D("9.20")
    assert _D(s["net_total"]) == _D("9.20")
    assert s["closed"] is False


def test_day_close_marker(client, active_event):
    _event_id, variant_id = active_event
    _bill(client, variant_id)

    assert client.get("/api/day-close").status_code == 404
    r = client.post("/api/day-close")
    assert r.status_code == 200
    assert _D(r.json()["total_gross"]) == _D("9.20")
    assert client.get("/api/day-close").status_code == 200
    assert client.get("/api/day-summary").json()["closed"] is True

    # weich: nach dem Abschluss ist weiter kassierbar
    _bill(client, variant_id)
    assert client.get("/api/day-summary").json()["bill_count"] == 2
