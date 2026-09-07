"""Bargeld, das nicht aus Verkaeufen kommt.

Morgens Wechselgeld in die Lade, mittags Kleingeld nachgelegt, abends die
Losung in den Tresor. Ohne diese Zeilen stimmt der Soll-Bestand nie.
"""
from decimal import Decimal


def D(x):
    return Decimal(str(x))


def move(client, amount, reason=""):
    return client.post(
        "/api/cash-movements", json={"amount": str(amount), "reason": reason}
    )


def count(client):
    return client.get("/api/cash-count").json()


def _sell(client, vid, qty="1"):
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": qty})
    return client.post("/api/bills").json()


# --- Anlegen ----------------------------------------------------
def test_deposit_increases_the_expected_cash(client, active_event):
    before = D(count(client)["expected_cash"])
    move(client, "50.00", "Wechselgeld nachgelegt")
    assert D(count(client)["expected_cash"]) == before + D("50.00")


def test_withdrawal_decreases_the_expected_cash(client, active_event):
    move(client, "100.00")
    before = D(count(client)["expected_cash"])
    move(client, "-40.00", "in den Tresor")
    assert D(count(client)["expected_cash"]) == before - D("40.00")


def test_movements_are_reported_as_their_own_sum(client, active_event):
    move(client, "50.00")
    move(client, "-20.00")
    assert D(count(client)["movement_total"]) == D("30.00")


def test_movements_do_not_touch_the_takings(client, active_event):
    _e, vid = active_event
    _sell(client, vid)
    before = D(count(client)["cash_income"])
    move(client, "500.00")
    assert D(count(client)["cash_income"]) == before


def test_movement_and_takings_add_up(client, active_event):
    _e, vid = active_event  # Helles 4,60
    client.put("/api/cash-float", json={"amount": "100.00"})
    _sell(client, vid, "2")  # 9,20
    move(client, "-50.00", "Tresor")

    c = count(client)
    assert D(c["opening_float"]) == D("100.00")
    assert D(c["cash_income"]) == D("9.20")
    assert D(c["movement_total"]) == D("-50.00")
    assert D(c["expected_cash"]) == D("59.20")


def test_the_reason_is_kept(client, active_event):
    move(client, "20.00", "Kleingeld von der Bank")
    rows = client.get("/api/cash-movements").json()
    assert rows[0]["reason"] == "Kleingeld von der Bank"


def test_reason_is_optional(client, active_event):
    assert move(client, "20.00").status_code == 201
    assert client.get("/api/cash-movements").json()[0]["reason"] == ""


def test_movements_come_back_in_the_order_they_happened(client, active_event):
    move(client, "10.00", "eins")
    move(client, "20.00", "zwei")
    move(client, "-5.00", "drei")
    assert [r["reason"] for r in client.get("/api/cash-movements").json()] == [
        "eins",
        "zwei",
        "drei",
    ]


# --- Loeschen ---------------------------------------------------
def test_a_movement_can_be_deleted_after_a_typo(client, active_event):
    mid = move(client, "500.00", "vertippt").json()["id"]
    assert client.delete(f"/api/cash-movements/{mid}").status_code == 204
    assert client.get("/api/cash-movements").json() == []
    assert D(count(client)["movement_total"]) == D(0)


def test_deleting_an_unknown_movement_is_404(client, active_event):
    assert client.delete("/api/cash-movements/999999").status_code == 404


# --- Grenzen ----------------------------------------------------
def test_zero_is_rejected(client, active_event):
    assert move(client, "0").status_code == 400


def test_absurd_amount_is_rejected(client, active_event):
    assert move(client, "123456789.00").status_code == 400


def test_absurd_negative_amount_is_rejected(client, active_event):
    assert move(client, "-123456789.00").status_code == 400


def test_amount_is_rounded_to_cents(client, active_event):
    move(client, "10.006")
    assert D(client.get("/api/cash-movements").json()[0]["amount"]) == D("10.01")


def test_half_cents_round_like_everywhere_else_in_der_kasse(client, active_event):
    """Kaufmaennisch nach ROUND_HALF_EVEN - dieselbe Regel wie bei Preisen."""
    move(client, "10.005")
    assert D(client.get("/api/cash-movements").json()[0]["amount"]) == D("10.00")


def test_nul_byte_in_reason_does_not_reach_the_database(client, active_event):
    move(client, "10.00", "Tre\x00sor")
    assert "\x00" not in client.get("/api/cash-movements").json()[0]["reason"]


def test_overlong_reason_is_cut_instead_of_500(client, active_event):
    assert move(client, "10.00", "x" * 500).status_code == 201
    assert len(client.get("/api/cash-movements").json()[0]["reason"]) <= 120


def test_without_active_event_it_is_409(client):
    assert move(client, "10.00").status_code == 409
    assert client.get("/api/cash-movements").status_code == 409


# --- Tagesabgrenzung -------------------------------------------
def test_movements_of_another_day_are_not_counted(client, active_event):
    client.post("/api/cash-movements?day=2020-01-01", json={"amount": "999.00"})
    assert D(count(client)["movement_total"]) == D(0)


def test_a_day_can_be_read_explicitly(client, active_event):
    client.post("/api/cash-movements?day=2020-01-01", json={"amount": "999.00"})
    rows = client.get("/api/cash-movements?day=2020-01-01").json()
    assert len(rows) == 1
    assert rows[0]["business_day"] == "2020-01-01"
