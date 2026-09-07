"""Stufe 5 - Pfandrueckgabe auf der aktiven Bestellung."""


def _D(x):
    from decimal import Decimal

    return Decimal(str(x))


def test_set_deposit_return_affects_total_due(client, active_event):
    event_id, variant_id = active_event  # Helles 4,60, kein Pfand
    client.post("/api/active-order/lines", json={"variant_id": variant_id, "delta": "3"})
    r = client.put(
        "/api/active-order/deposit-return", json={"unit_amount": "2.00", "quantity": 4}
    )
    assert r.status_code == 200
    body = r.json()
    assert _D(body["deposit_return_total"]) == _D("8.00")
    # 13,80 Artikel + 0 Pfand - 8,00 Rueckgabe
    assert _D(body["total_due"]) == _D("5.80")


def test_deposit_return_zero_quantity_clears(client, active_event):
    client.put(
        "/api/active-order/deposit-return", json={"unit_amount": "2.00", "quantity": 3}
    )
    r = client.put(
        "/api/active-order/deposit-return", json={"unit_amount": "2.00", "quantity": 0}
    )
    assert r.json()["deposit_return_unit_amount"] is None
    assert _D(r.json()["deposit_return_total"]) == _D("0")


def test_deposit_return_negative_rejected(client, active_event):
    assert (
        client.put(
            "/api/active-order/deposit-return",
            json={"unit_amount": "-1.00", "quantity": 2},
        ).status_code
        == 400
    )
    assert (
        client.put(
            "/api/active-order/deposit-return",
            json={"unit_amount": "2.00", "quantity": -1},
        ).status_code
        == 400
    )


def test_deposit_return_cleared_after_bill(client, active_event):
    _event_id, variant_id = active_event
    client.post("/api/active-order/lines", json={"variant_id": variant_id, "delta": "1"})
    client.put(
        "/api/active-order/deposit-return", json={"unit_amount": "2.00", "quantity": 2}
    )
    client.post("/api/bills")
    after = client.get("/api/active-order").json()
    assert after["deposit_return_unit_amount"] is None
    assert after["lines"] == []
