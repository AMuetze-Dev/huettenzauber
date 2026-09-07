"""Revisionszaehler der aktiven Bestellung.

Zwei Eingabepunkte tippen auf denselben Warenkorb; Antworten und SSE-
Nachrichten koennen sich ueberholen. Der Zaehler ist das einzige Mittel, mit
dem ein Client einen alten Stand erkennt - deshalb wird er hier eng gefuehrt.
"""
from decimal import Decimal


def D(x):
    return Decimal(str(x))


def rev(client) -> int:
    return client.get("/api/active-order").json()["revision"]


def test_fresh_order_starts_at_zero(client, active_event):
    assert rev(client) == 0


def test_reading_does_not_advance_the_revision(client, active_event):
    before = rev(client)
    client.get("/api/active-order")
    client.get("/api/active-order")
    assert rev(client) == before


def test_each_line_delta_advances_by_one(client, active_event):
    _e, vid = active_event
    before = rev(client)
    for i in range(1, 4):
        r = client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "1"})
        assert r.json()["revision"] == before + i


def test_response_and_read_agree(client, active_event):
    _e, vid = active_event
    posted = client.post(
        "/api/active-order/lines", json={"variant_id": vid, "delta": "2"}
    ).json()["revision"]
    assert rev(client) == posted


def test_removing_a_line_also_advances(client, active_event):
    _e, vid = active_event
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "1"})
    before = rev(client)
    r = client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "-1"})
    assert r.json()["lines"] == []
    assert r.json()["revision"] == before + 1


def test_delta_zero_does_not_advance(client, active_event):
    """Nichts passiert - dann darf auch kein Client neu zeichnen muessen."""
    _e, vid = active_event
    before = rev(client)
    r = client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "0"})
    assert r.json()["revision"] == before


def test_rejected_delta_does_not_advance(client, active_event, catalog_id):
    """Eine Variante aus einem fremden Katalog wird abgewiesen - ohne den
    Zaehler zu verbrennen."""
    _e, vid = active_event
    other = client.post("/api/catalogs", json={"name": "Fremd"}).json()["id"]
    foreign = client.post(
        f"/api/catalogs/{other}/stock-items",
        json={
            "name": "Fremdartikel",
            "category_id": None,
            "deposit_amount": "0",
            "variants": [{"name": None, "price": "1.00"}],
        },
    ).json()["variants"][0]["id"]

    before = rev(client)
    assert (
        client.post(
            "/api/active-order/lines", json={"variant_id": foreign, "delta": "1"}
        ).status_code
        == 409
    )
    assert rev(client) == before


def test_deposit_return_advances(client, active_event):
    before = rev(client)
    r = client.put(
        "/api/active-order/deposit-return", json={"unit_amount": "2.00", "quantity": 3}
    )
    assert r.json()["revision"] == before + 1


def test_clearing_deposit_return_advances(client, active_event):
    client.put(
        "/api/active-order/deposit-return", json={"unit_amount": "2.00", "quantity": 3}
    )
    before = rev(client)
    r = client.put(
        "/api/active-order/deposit-return", json={"unit_amount": "2.00", "quantity": 0}
    )
    assert r.json()["deposit_returns"] == []
    assert r.json()["revision"] == before + 1


def test_creating_a_bill_advances(client, active_event):
    """Nach dem Kassieren muss das Kundendisplay den leeren Korb uebernehmen -
    das geht nur mit hoeherer Revision."""
    _e, vid = active_event
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "2"})
    before = rev(client)

    assert client.post("/api/bills").status_code == 201

    after = client.get("/api/active-order").json()
    assert after["lines"] == []
    assert after["revision"] > before


def test_revision_never_goes_backwards_over_a_long_session(client, active_event):
    _e, vid = active_event
    seen = [rev(client)]
    for delta in ["1", "1", "-1", "3", "-2", "1"]:
        seen.append(
            client.post(
                "/api/active-order/lines", json={"variant_id": vid, "delta": delta}
            ).json()["revision"]
        )
    assert seen == sorted(seen)
    assert len(set(seen)) == len(seen)


def test_failed_bill_does_not_advance(client, active_event):
    """Leerer Korb -> 400, und der Zaehler bleibt stehen."""
    before = rev(client)
    assert client.post("/api/bills").status_code == 400
    assert rev(client) == before
