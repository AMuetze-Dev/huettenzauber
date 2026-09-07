"""Stufe 6/7 - Verbrauchsstatistik."""
from decimal import Decimal


def D(x):
    return Decimal(str(x))


def _bill(client, variant_id, qty):
    client.post("/api/active-order/lines", json={"variant_id": variant_id, "delta": qty})
    assert client.post("/api/bills").status_code == 201


def test_statistics_aggregates_consumption(client, active_event):
    _event_id, variant_id = active_event  # Helles 0,5 l @ 4,60, kein Pfand
    _bill(client, variant_id, "3")
    _bill(client, variant_id, "2")

    r = client.get("/api/statistics")
    assert r.status_code == 200
    body = r.json()
    assert body["scope"] == "event"
    assert body["bill_count"] == 2
    assert D(body["total_gross"]) == D("23.00")  # 5 * 4,60
    assert D(body["net_total"]) == D("23.00")

    assert len(body["consumption"]) == 1
    row = body["consumption"][0]
    assert row["item_name"] == "Helles"
    assert D(row["quantity"]) == D(5)
    assert D(row["revenue"]) == D("23.00")

    assert len(body["days"]) == 1
    assert body["days"][0]["bill_count"] == 2


def test_statistics_excludes_voided(client, active_event):
    _event_id, variant_id = active_event
    client.post("/api/active-order/lines", json={"variant_id": variant_id, "delta": "1"})
    bill_id = client.post("/api/bills").json()["id"]
    client.post(f"/api/bills/{bill_id}/void")

    body = client.get("/api/statistics").json()
    assert body["bill_count"] == 0
    assert body["consumption"] == []
    assert D(body["total_gross"]) == D("0")


def test_statistics_without_active_event(client):
    assert client.get("/api/statistics").status_code == 409
