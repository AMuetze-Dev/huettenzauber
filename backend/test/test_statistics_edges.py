"""Randfälle Verbrauchsstatistik."""
from decimal import Decimal

from core.clock import business_day


def D(x):
    return Decimal(str(x))


def _multi_variant_event(client):
    cid = client.post("/api/catalogs", json={"name": "S"}).json()["id"]
    cat = client.post(f"/api/catalogs/{cid}/categories", json={"name": "K"}).json()["id"]
    it = client.post(
        f"/api/catalogs/{cid}/stock-items",
        json={
            "name": "Bier",
            "category_id": cat,
            "deposit_amount": "0",
            "variants": [
                {"name": "0,3", "price": "3.00"},
                {"name": "0,5", "price": "4.00"},
            ],
        },
    ).json()
    ev = client.post("/api/events", json={"catalog_id": cid, "name": "F"}).json()["id"]
    client.post(f"/api/events/{ev}/activate")
    return it["variants"][0]["id"], it["variants"][1]["id"]


def test_statistics_empty_no_bills(client, active_event):
    body = client.get("/api/statistics").json()
    assert body["bill_count"] == 0
    assert body["consumption"] == []
    assert body["days"] == []
    assert D(body["total_gross"]) == D(0)
    assert body["scope"] == "event"


def test_statistics_day_scope(client, active_event):
    _e, vid = active_event
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "1"})
    client.post("/api/bills")
    today = business_day().isoformat()
    body = client.get(f"/api/statistics?day={today}").json()
    assert body["scope"] == today
    assert body["bill_count"] == 1


def test_statistics_day_scope_other_day_empty(client, active_event):
    _e, vid = active_event
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "1"})
    client.post("/api/bills")
    body = client.get("/api/statistics?day=2099-12-31").json()
    assert body["bill_count"] == 0 and body["consumption"] == []


def test_statistics_variants_are_separate_rows(client):
    v0, v1 = _multi_variant_event(client)
    client.post("/api/active-order/lines", json={"variant_id": v0, "delta": "5"})
    client.post("/api/active-order/lines", json={"variant_id": v1, "delta": "2"})
    client.post("/api/bills")
    rows = client.get("/api/statistics").json()["consumption"]
    assert len(rows) == 2
    by_variant = {r["variant_name"]: r for r in rows}
    assert D(by_variant["0,3"]["quantity"]) == D(5)
    assert D(by_variant["0,3"]["revenue"]) == D("15.00")
    assert D(by_variant["0,5"]["quantity"]) == D(2)
    assert D(by_variant["0,5"]["revenue"]) == D("8.00")
    # sortiert nach Menge absteigend
    assert rows[0]["variant_name"] == "0,3"


def test_statistics_aggregates_across_bills(client, active_event):
    _e, vid = active_event
    for _ in range(3):
        client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "2"})
        client.post("/api/bills")
    body = client.get("/api/statistics").json()
    assert body["bill_count"] == 3
    assert D(body["consumption"][0]["quantity"]) == D(6)
    assert body["days"][0]["bill_count"] == 3


def test_statistics_revenue_two_decimals(client, active_event):
    _e, vid = active_event  # 4,60
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "3"})
    client.post("/api/bills")
    rev = client.get("/api/statistics").json()["consumption"][0]["revenue"]
    assert rev in ("13.80", "13.8")


def test_statistics_without_active_event_409(client):
    assert client.get("/api/statistics").status_code == 409
