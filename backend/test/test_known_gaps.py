"""Bewusst fehlschlagende Tests (xfail strict).

Jeder Test hier beschreibt eine bekannte, akzeptierte Luecke. `strict=True`
heisst: schlaegt der Test wie erwartet fehl -> gruen (XFAIL). Wird die Luecke
geschlossen und der Test besteht ploetzlich -> ROT (XPASS), damit man ihn
streicht und das neue Verhalten bewusst absegnet.

Frueher hier, inzwischen behoben (siehe test_hardening.py):
Preis-Overflow, NUL-Byte, inaktive/fremde Variante, negativer sort_order,
Eindeutigkeit beim Teil-Reorder.
"""
import unicodedata
from decimal import Decimal

import pytest


def D(x):
    return Decimal(str(x))


@pytest.mark.xfail(
    strict=True,
    reason="Zeilen-Delta ist bewusst additiv und ohne Request-ID: zweimal "
    "dasselbe Delta erhoeht zweimal. Idempotenz braeuchte eine Client-Request-ID.",
)
def test_line_delta_is_idempotent_per_request(client, active_event):
    _e, vid = active_event
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "1"})
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "1"})
    qty = D(client.get("/api/active-order").json()["lines"][0]["quantity"])
    assert qty == D(1), f"nicht idempotent (qty={qty})"


@pytest.mark.xfail(
    strict=True,
    reason="NFC- und NFD-Schreibweise desselben Namens gelten als verschieden "
    "- keine Unicode-Normalisierung vor dem Vergleich",
)
def test_unicode_normalization_treats_equal_names_as_duplicate(client):
    base = "café"
    nfd = unicodedata.normalize("NFD", base)
    nfc = unicodedata.normalize("NFC", base)
    assert nfc != nfd

    client.post("/api/catalogs", json={"name": nfc})
    r = client.post("/api/catalogs", json={"name": nfd})
    assert r.status_code == 409, f"NFC/NFD nicht normalisiert ({r.status_code})"


@pytest.mark.xfail(
    strict=True,
    reason="Zwei Geraete koennen gleichzeitig aus derselben aktiven Bestellung "
    "einen Bon erzeugen - kein Row-Lock. Der zweite bekommt 400 (leer), "
    "gewuenscht waere ein sauberer Konflikt-Hinweis.",
)
def test_second_bill_from_same_order_gives_conflict_not_validation_error(
    client, active_event
):
    _e, vid = active_event
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": "1"})
    client.post("/api/bills")
    r = client.post("/api/bills")
    assert r.status_code == 409, f"war {r.status_code}"
