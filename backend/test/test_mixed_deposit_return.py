"""Gemischtes Leergut in einem Vorgang.

Der Gast bringt 3 Weinglaeser (2,00 €) und 2 Bierglaeser (1,50 €) zusammen
zurueck = 9,00 €. Vorher konnte die Kasse nur einen einzigen Pfandbetrag je
Vorgang - der Bediener musste rechnen oder zwei Bons schreiben.
"""
from decimal import Decimal


def D(x):
    return Decimal(str(x))


def put(client, unit, qty):
    return client.put(
        "/api/active-order/deposit-return",
        json={"unit_amount": str(unit), "quantity": qty},
    )


def ao(client):
    return client.get("/api/active-order").json()


def test_two_deposit_kinds_add_up(client, active_event):
    put(client, "2.00", 3)
    r = put(client, "1.50", 2)
    assert D(r.json()["deposit_return_total"]) == D("9.00")


def test_each_kind_is_listed_separately(client, active_event):
    put(client, "2.00", 3)
    put(client, "1.50", 2)
    entries = ao(client)["deposit_returns"]
    assert [(e["unit_amount"], e["quantity"], e["total_amount"]) for e in entries] == [
        ("1.50", 2, "3.00"),
        ("2.00", 3, "6.00"),
    ]


def test_setting_one_kind_does_not_touch_the_other(client, active_event):
    put(client, "2.00", 3)
    put(client, "1.50", 2)
    put(client, "2.00", 1)
    entries = {e["unit_amount"]: e["quantity"] for e in ao(client)["deposit_returns"]}
    assert entries == {"2.00": 1, "1.50": 2}


def test_zero_quantity_removes_only_that_kind(client, active_event):
    put(client, "2.00", 3)
    put(client, "1.50", 2)
    put(client, "2.00", 0)
    entries = {e["unit_amount"]: e["quantity"] for e in ao(client)["deposit_returns"]}
    assert entries == {"1.50": 2}


def test_clear_endpoint_removes_all_kinds(client, active_event):
    put(client, "2.00", 3)
    put(client, "1.50", 2)
    r = client.delete("/api/active-order/deposit-return")
    assert r.json()["deposit_returns"] == []
    assert D(r.json()["deposit_return_total"]) == D(0)


def test_same_amount_twice_updates_instead_of_duplicating(client, active_event):
    put(client, "2.00", 3)
    put(client, "2.00", 5)
    entries = ao(client)["deposit_returns"]
    assert len(entries) == 1
    assert entries[0]["quantity"] == 5


def test_amounts_that_round_to_the_same_cent_are_one_kind(client, active_event):
    put(client, "2.001", 3)
    put(client, "2.00", 4)
    entries = ao(client)["deposit_returns"]
    assert len(entries) == 1
    assert entries[0]["quantity"] == 4


def test_mixed_return_lands_on_the_bill(client, active_event):
    _e, vid = active_event
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "5"})
    put(client, "2.00", 3)
    put(client, "1.50", 2)

    bill = client.post("/api/bills").json()

    assert D(bill["deposit_return_total"]) == D("9.00")


def test_mixed_return_is_booked_as_two_rows(client, active_event):
    _e, vid = active_event
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "5"})
    put(client, "2.00", 3)
    put(client, "1.50", 2)
    bill = client.post("/api/bills").json()

    rows = client.get("/api/deposit-returns").json()
    mine = [r for r in rows if r["bill_id"] == bill["id"]]
    assert sorted((r["unit_amount"], r["quantity"]) for r in mine) == [
        ("1.50", 2),
        ("2.00", 3),
    ]


def test_bill_clears_every_deposit_kind(client, active_event):
    _e, vid = active_event
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "5"})
    put(client, "2.00", 3)
    put(client, "1.50", 2)
    client.post("/api/bills")
    assert ao(client)["deposit_returns"] == []


def test_mixed_return_reduces_the_amount_due(client, active_event):
    _e, vid = active_event  # Helles 4,60
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "5"})
    put(client, "2.00", 1)
    put(client, "1.50", 2)
    body = ao(client)
    assert D(body["total_gross"]) == D("23.00")
    assert D(body["total_due"]) == D("18.00")


def test_return_larger_than_the_order_never_goes_negative(client, active_event):
    _e, vid = active_event
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "1"})
    put(client, "2.00", 10)
    put(client, "1.50", 10)
    assert D(ao(client)["total_due"]) == D(0)


def test_clearing_the_cart_also_clears_the_deposit_kinds(client, active_event):
    _e, vid = active_event
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "2"})
    put(client, "2.00", 3)

    r = client.delete("/api/active-order")

    assert r.json()["lines"] == []
    assert r.json()["deposit_returns"] == []
    assert D(r.json()["total_due"]) == D(0)


def test_clearing_the_cart_advances_the_revision(client, active_event):
    _e, vid = active_event
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "2"})
    before = ao(client)["revision"]
    assert client.delete("/api/active-order").json()["revision"] > before


def test_clearing_an_empty_cart_is_harmless(client, active_event):
    r = client.delete("/api/active-order")
    assert r.status_code == 200
    assert r.json()["lines"] == []


def test_clearing_without_active_event_is_409(client):
    assert client.delete("/api/active-order").status_code == 409


def test_negative_deposit_amount_still_rejected(client, active_event):
    assert put(client, "-1.00", 2).status_code == 400


def test_absurd_deposit_quantity_still_rejected(client, active_event):
    assert put(client, "2.00", 100001).status_code == 400
