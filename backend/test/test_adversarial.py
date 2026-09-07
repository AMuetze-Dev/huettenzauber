"""Adversariale / negative Tests: die API MUSS ablehnen oder sicher behandeln."""
from decimal import Decimal

import pytest


def D(x):
    return Decimal(str(x))


# --- Injection / Sonderzeichen: kein Effekt, DB bleibt heil ----
def test_sql_ish_name_is_stored_literally(client):
    payload = "'; DROP TABLE bill; --"
    cid = client.post("/api/catalogs", json={"name": payload}).json()["id"]
    assert client.get(f"/api/catalogs/{cid}").json()["name"] == payload
    # DB weiterhin funktionsfähig
    assert client.get("/api/catalogs").status_code == 200


def test_html_script_name_not_interpreted(client):
    cid = client.post(
        "/api/catalogs", json={"name": "<script>alert(1)</script>"}
    ).json()["id"]
    assert client.get(f"/api/catalogs/{cid}").json()["name"] == "<script>alert(1)</script>"


def test_control_chars_in_name_survive_roundtrip(client):
    cid = client.post("/api/catalogs", json={"name": "Tab\tHier"}).json()["id"]
    assert "Tab" in client.get(f"/api/catalogs/{cid}").json()["name"]


# --- ID-Missbrauch: sauberes 404/422, kein 500 -----------------
@pytest.mark.parametrize("bad_id", [0, -1, 99999999999, 2147483648])
def test_out_of_range_ids_are_404_not_500(client, bad_id):
    assert client.get(f"/api/catalogs/{bad_id}").status_code == 404


@pytest.mark.parametrize("bad_id", ["abc", "1.5", "null", "%20", "1;2"])
def test_non_int_ids_are_422(client, bad_id):
    assert client.get(f"/api/catalogs/{bad_id}").status_code == 422


# --- Nicht-endliche Zahlen -> 422 ------------------------------
@pytest.mark.parametrize("bad", ["NaN", "Infinity", "-Infinity"])
def test_non_finite_price_rejected(client, catalog_id, bad):
    r = client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json={
            "name": "X",
            "category_id": None,
            "deposit_amount": "0",
            "variants": [{"name": "v", "price": bad}],
        },
    )
    assert r.status_code == 422


@pytest.mark.parametrize("bad", ["NaN", "Infinity"])
def test_non_finite_deposit_rejected(client, catalog_id, bad):
    r = client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json={
            "name": "X",
            "category_id": None,
            "deposit_amount": bad,
            "variants": [{"name": "v", "price": "1.00"}],
        },
    )
    assert r.status_code == 422


# --- Sub-Cent-Preis: wird auf 2 NK gerundet, nicht abgelehnt ---
def test_subcent_price_is_rounded(client, catalog_id):
    r = client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json={
            "name": "Sub",
            "category_id": None,
            "deposit_amount": "0",
            "variants": [{"name": "v", "price": "0.005"}],
        },
    )
    assert r.status_code == 201
    assert D(r.json()["variants"][0]["price"]) == D("0.01")


def test_scientific_notation_price_accepted(client, catalog_id):
    r = client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json={
            "name": "Sci",
            "category_id": None,
            "deposit_amount": "0",
            "variants": [{"name": "v", "price": "1e2"}],
        },
    )
    assert r.status_code == 201
    assert D(r.json()["variants"][0]["price"]) == D("100")


def test_minus_zero_price_allowed(client, catalog_id):
    r = client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json={
            "name": "MZ",
            "category_id": None,
            "deposit_amount": "0",
            "variants": [{"name": "v", "price": "-0.00"}],
        },
    )
    assert r.status_code == 201


# --- Pflichtfelder fehlen -> 422 -----------------------------
@pytest.mark.parametrize(
    "path,body",
    [
        ("/api/catalogs", {}),
        ("/api/catalogs", {"name": []}),
        ("/api/catalogs", {"name": {"x": 1}}),
        ("/api/events", {"name": "x"}),
        ("/api/events", {"catalog_id": 1}),
        ("/api/active-order/lines", {"variant_id": 1}),
        ("/api/active-order/lines", {"delta": "1"}),
    ],
)
def test_missing_required_fields_422(client, path, body):
    assert client.post(path, json=body).status_code == 422


def test_put_category_missing_icon_422(client, catalog_id):
    cid = client.post(
        f"/api/catalogs/{catalog_id}/categories", json={"name": "K"}
    ).json()["id"]
    assert client.put(f"/api/categories/{cid}", json={"name": "K"}).status_code == 422


def test_deposit_return_missing_field_422(client, active_event):
    assert (
        client.put("/api/active-order/deposit-return", json={"unit_amount": "2"}).status_code
        == 422
    )
    assert (
        client.put("/api/active-order/deposit-return", json={"quantity": 2}).status_code
        == 422
    )


@pytest.mark.parametrize("val", ["nein", "2026-99-99", "2026-13-01", "07.09.2026"])
def test_invalid_date_query_422(client, active_event, val):
    assert client.get(f"/api/statistics?day={val}").status_code == 422
    assert client.get(f"/api/day-summary?day={val}").status_code == 422


def test_sort_order_string_422(client, catalog_id):
    r = client.post(
        f"/api/catalogs/{catalog_id}/categories",
        json={"name": "K", "sort_order": "hoch"},
    )
    assert r.status_code == 422


def test_extra_unknown_fields_ignored(client):
    r = client.post(
        "/api/catalogs", json={"name": "Extra", "secret": "x", "id": 999, "admin": True}
    )
    assert r.status_code == 201
    assert r.json()["id"] != 999
    assert "secret" not in r.json()


def test_variants_field_missing_defaults_to_empty(client, catalog_id):
    r = client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json={"name": "NoVar", "category_id": None, "deposit_amount": "0"},
    )
    assert r.status_code == 201
    assert r.json()["variants"] == []


# --- Verbotene Zustandsübergänge -----------------------------
def test_cannot_delete_catalog_with_archived_event(client):
    cid = client.post("/api/catalogs", json={"name": "K"}).json()["id"]
    e = client.post("/api/events", json={"catalog_id": cid, "name": "F"}).json()
    client.post(f"/api/events/{e['id']}/activate")
    client.post(f"/api/events/{e['id']}/archive")
    assert client.delete(f"/api/catalogs/{cid}").status_code == 409


def test_cannot_bill_twice_from_one_active_order(client, active_event):
    _e, vid = active_event
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "2"})
    assert client.post("/api/bills").status_code == 201
    # aktive Bestellung ist leer -> zweiter Bon scheitert
    assert client.post("/api/bills").status_code == 400


def test_cannot_activate_then_delete_catalog(client):
    cid = client.post("/api/catalogs", json={"name": "K"}).json()["id"]
    e = client.post("/api/events", json={"catalog_id": cid, "name": "F"}).json()
    client.post(f"/api/events/{e['id']}/activate")
    assert client.delete(f"/api/catalogs/{cid}").status_code == 409


def test_reorder_mixed_valid_invalid_is_atomic(client, catalog_id):
    a = client.post(
        f"/api/catalogs/{catalog_id}/categories",
        json={"name": "A", "sort_order": 0},
    ).json()["id"]
    b = client.post(
        f"/api/catalogs/{catalog_id}/categories",
        json={"name": "B", "sort_order": 1},
    ).json()["id"]
    # ein gültiger + ein ungültiger -> 404, KEINE Umsortierung
    r = client.put(
        f"/api/catalogs/{catalog_id}/categories/order",
        json={"ordered_ids": [b, 999999]},
    )
    assert r.status_code == 404
    ids = [c["id"] for c in client.get(f"/api/catalogs/{catalog_id}/categories").json()]
    assert ids == [a, b]  # unverändert


# --- Invarianten unter zufälligen Aktionen ------------------
def test_totals_match_after_random_line_ops(client, active_event):
    _e, vid = active_event  # Helles 0,5 l @ 4,60
    import random

    random.seed(1)
    net = 0
    for _ in range(30):
        step = random.choice([1, 1, 1, 2, -1, -1, 3, -5])
        client.post("/api/active-order/lines", json={"variant_id": vid, "delta": str(step)})
        net = max(0, net + step)
    body = client.get("/api/active-order").json()
    got_qty = sum(D(l["quantity"]) for l in body["lines"])
    assert got_qty == D(net)
    assert D(body["total_gross"]) == D(net) * D("4.60")


def test_voiding_all_bills_zeros_summary_and_stats(client, active_event):
    _e, vid = active_event
    ids = []
    for _ in range(3):
        client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "1"})
        ids.append(client.post("/api/bills").json()["id"])
    for bid in ids:
        client.post(f"/api/bills/{bid}/void")
    assert client.get("/api/day-summary").json()["bill_count"] == 0
    assert D(client.get("/api/day-summary").json()["net_total"]) == D(0)
    assert client.get("/api/statistics").json()["consumption"] == []
    # alle wiederherstellen -> zurück
    for bid in ids:
        client.post(f"/api/bills/{bid}/restore")
    assert client.get("/api/day-summary").json()["bill_count"] == 3


def test_deleting_category_never_deletes_its_items(client, catalog_id):
    cat = client.post(
        f"/api/catalogs/{catalog_id}/categories", json={"name": "K"}
    ).json()["id"]
    iid = client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json={
            "name": "Bleibt",
            "category_id": cat,
            "deposit_amount": "0",
            "variants": [{"name": "v", "price": "1.00"}],
        },
    ).json()["id"]
    client.delete(f"/api/categories/{cat}")
    got = client.get(f"/api/stock-items/{iid}")
    assert got.status_code == 200
    assert got.json()["category_id"] is None
    assert got.json()["is_active"] is True


# --- kein Auth (bewusste Entscheidung, dokumentiert) --------
def test_writes_succeed_without_any_auth_header(client):
    # LAN-Betrieb ohne Auth ist eine akzeptierte Design-Entscheidung.
    assert client.post("/api/catalogs", json={"name": "NoAuth"}).status_code == 201
