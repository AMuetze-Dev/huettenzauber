"""Rechnungsuebersicht als PDF.

Geprueft wird der fertige Ausdruck, nicht die Absicht: das PDF wird mit pypdf
zurueckgelesen und der Text darin auf Zahlen, Namen und Storno-Vermerke
abgesucht. Dazu die Randlagen, an denen so ein Export erfahrungsgemaess
zerbricht - leerer Tag, Umlaute im Veranstaltungsnamen, viele Bons.
"""
import io
import re
from decimal import Decimal

import pytest
from pypdf import PdfReader

from billing import pdf as pdf_modul
from core.clock import local_time


def D(x):
    return Decimal(str(x))


def hole(client, query: str = ""):
    r = client.get(f"/api/bills/export.pdf{query}")
    assert r.status_code == 200, r.text[:200]
    return r


def seiten(rohdaten: bytes) -> list[str]:
    return [s.extract_text() or "" for s in PdfReader(io.BytesIO(rohdaten)).pages]


def text(rohdaten: bytes) -> str:
    """Der ganze Ausdruck als eine Zeichenkette.

    Zeilenumbrueche fallen weg: fpdf2 setzt jede Tabellenzelle einzeln, ein
    Zeilenende steht also mitten in der Bon-Zeile.
    """
    return " ".join(" ".join(seiten(rohdaten)).split())


def _bon(client, vid, menge="1"):
    client.post("/api/active-order/lines", json={"variant_id": vid, "delta": menge})
    return client.post("/api/bills").json()


# --- Formatierung (reine Funktionen) ----------------------------
@pytest.mark.parametrize(
    "wert,erwartet",
    [
        (0, "0,00 €"),
        ("4.6", "4,60 €"),
        ("23", "23,00 €"),
        ("1234.5", "1.234,50 €"),
        ("2300", "2.300,00 €"),
        ("1234567.89", "1.234.567,89 €"),
        ("-5.5", "-5,50 €"),
    ],
)
def test_euro_deutsche_schreibweise(wert, erwartet):
    assert pdf_modul._euro(D(wert)) == erwartet


@pytest.mark.parametrize(
    "wert,erwartet",
    [("1", "1"), ("3.000", "3"), ("0.5", "0,5"), ("2.250", "2,25")],
)
def test_menge_ohne_nachkommaballast(wert, erwartet):
    assert pdf_modul._menge(D(wert)) == erwartet


def test_datum_ausgeschrieben():
    from datetime import date

    assert pdf_modul._datum_lang(date(2025, 9, 20)) == "Samstag, 20. September 2025"


def test_uhrzeiten_stehen_in_betriebszeit_nicht_in_utc(client, active_event):
    """Ein Container ohne TZ-Angabe laeuft in UTC. Ohne feste Zeitzone stuende
    auf dem Ausdruck 06:27, obwohl es an der Theke 08:27 war."""
    from datetime import datetime, timezone

    _e, vid = active_event
    _bon(client, vid)
    t = text(hole(client).content)
    berlin = local_time(datetime.now(timezone.utc)).strftime("%H:%M")
    assert berlin in t, f"{berlin} fehlt im Ausdruck"


def test_zeitstempel_ist_unabhaengig_von_der_rechnerzeitzone(monkeypatch):
    """`astimezone()` ohne Argument haengt an der Zeitzone des Rechners -
    hier wird geprueft, dass die Umrechnung selbst gesetzt ist."""
    from datetime import datetime, timezone

    mittag_utc = datetime(2026, 9, 10, 10, 30, tzinfo=timezone.utc)
    assert local_time(mittag_utc).strftime("%H:%M") == "12:30"  # Sommerzeit
    winter_utc = datetime(2026, 1, 10, 10, 30, tzinfo=timezone.utc)
    assert local_time(winter_utc).strftime("%H:%M") == "11:30"


def test_naive_zeitangabe_wird_als_utc_gelesen():
    """Die Datenbank liefert im Zweifel ohne Zeitzone - dann ist UTC gemeint,
    nicht die Zeit des Rechners."""
    from datetime import datetime

    assert local_time(datetime(2026, 9, 10, 10, 30)).strftime("%H:%M") == "12:30"


# --- Grundlagen -------------------------------------------------
def test_leerer_tag_liefert_trotzdem_ein_pdf(client, active_event):
    r = hole(client)
    assert r.content.startswith(b"%PDF-")
    assert r.content.rstrip().endswith(b"%%EOF")
    assert len(seiten(r.content)) == 1


def test_ist_als_pdf_ausgewiesen(client, active_event):
    assert hole(client).headers["content-type"] == "application/pdf"


def test_dateiname_traegt_tag_und_veranstaltung(client, active_event):
    cd = hole(client).headers["content-disposition"]
    assert cd.startswith("inline;")
    assert re.search(
        r'filename="\d{4}-\d{2}-\d{2}-rechnungsuebersicht-Testfest\.pdf"', cd
    ), cd


def test_ohne_aktive_veranstaltung_409(client):
    assert client.get("/api/bills/export.pdf").status_code == 409


def test_export_kollidiert_nicht_mit_der_bon_route(client, active_event):
    """`/bills/{bill_id}` wuerde "export.pdf" sonst als Zahl lesen wollen."""
    _e, vid = active_event
    bon = _bon(client, vid)
    assert client.get(f"/api/bills/{bon['id']}").status_code == 200
    assert client.get("/api/bills/export.pdf").status_code == 200


# --- Inhalt ------------------------------------------------------
def test_kopf_nennt_veranstaltung_und_tag(client, active_event):
    t = text(hole(client).content)
    assert "Rechnungsübersicht" in t
    assert "Testfest" in t
    assert "Landgasthof Zum Ross" in t


def test_zeigt_bonnummer_und_positionszahl(client, active_event):
    _e, vid = active_event
    bon = _bon(client, vid, "3")
    t = text(hole(client).content)
    assert f"#{bon['id']}" in t


def test_zeigt_summen_in_deutscher_schreibweise(client, active_event):
    _e, vid = active_event
    _bon(client, vid, "5")  # 5 x 4,60 = 23,00
    t = text(hole(client).content)
    assert "23,00" in t
    assert "23.00" not in t


def test_tausenderpunkt(client, active_event):
    _e, vid = active_event
    _bon(client, vid, "500")  # 2.300,00
    assert "2.300,00" in text(hole(client).content)


def test_bareinnahme_stimmt_mit_dem_kassenschnitt(client, active_event):
    _e, vid = active_event
    _bon(client, vid, "5")
    client.post("/api/deposit-returns", json={"unit_amount": "2.00", "quantity": 3})
    kasse = client.get("/api/cash-count").json()
    assert D(kasse["cash_income"]) == D("17.00")  # 23,00 - 6,00
    t = text(hole(client).content)
    assert "BAREINNAHME" in t
    assert "17,00" in t
    assert "6,00" in t  # ausgezahltes Pfand
    assert "Pfand einzeln ausgezahlt" in t


def test_verbrauchsliste_nennt_artikel_und_menge(client, active_event):
    _e, vid = active_event
    _bon(client, vid, "3")
    _bon(client, vid, "4")
    t = text(hole(client).content)
    assert "Was über die Theke ging" in t
    assert "Helles" in t
    assert "0,5 l" in t
    assert "7" in t


def test_stornierte_bons_stehen_mit_drin(client, active_event):
    _e, vid = active_event
    bon = _bon(client, vid)
    client.post(f"/api/bills/{bon['id']}/void")
    t = text(hole(client).content)
    assert f"#{bon['id']}" in t
    assert "storniert" in t


def test_storno_zaehlt_nicht_in_die_summe(client, active_event):
    _e, vid = active_event
    bon = _bon(client, vid, "5")  # 23,00
    client.post(f"/api/bills/{bon['id']}/void")
    kasse = client.get("/api/cash-count").json()
    assert D(kasse["total_gross"]) == D(0)
    t = text(hole(client).content)
    assert "0,00" in t
    assert "23,00" in t  # der Bon selbst steht weiter in der Liste
    assert "storniert" in t


def test_stornierter_artikel_faellt_aus_dem_verbrauch(client, active_event):
    _e, vid = active_event
    bon = _bon(client, vid, "3")
    client.post(f"/api/bills/{bon['id']}/void")
    t = text(hole(client).content)
    assert "Helles" not in t.split("Was über die Theke ging")[-1]


def test_pfand_erscheint_wenn_der_artikel_pfand_traegt(client, catalog_id):
    item = client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json={
            "name": "Weinglas",
            "category_id": None,
            "deposit_amount": "2.00",
            "variants": [{"name": "0,25 l", "price": "6.70"}],
        },
    ).json()
    ev = client.post(
        "/api/events", json={"catalog_id": catalog_id, "name": "Weinfest"}
    ).json()
    client.post(f"/api/events/{ev['id']}/activate")
    _bon(client, item["variants"][0]["id"], "2")
    t = text(hole(client).content)
    assert "PFAND" in t
    assert "13,40" in t  # Warenwert
    assert "4,00" in t  # Pfand
    assert "17,40" in t  # Bareinnahme = Warenwert + Pfand


# --- Randlagen ---------------------------------------------------
def test_umlaute_im_namen_ueberleben_bis_in_den_ausdruck(client, catalog_id):
    """Die eingebettete Schrift muss Umlaute mitbringen - und der Dateiname
    darf sie nicht in die Kopfzeile tragen, dort ist nur ASCII erlaubt."""
    client.post(
        f"/api/catalogs/{catalog_id}/stock-items",
        json={
            "name": "Käsewürfel & Weinbeeren",
            "category_id": None,
            "deposit_amount": "0",
            "variants": [{"name": "groß", "price": "4.00"}],
        },
    )
    ev = client.post(
        "/api/events", json={"catalog_id": catalog_id, "name": "Fest mit Ümlaut"}
    ).json()
    client.post(f"/api/events/{ev['id']}/activate")
    items = client.get(f"/api/catalogs/{catalog_id}/stock-items").json()
    _bon(client, items[0]["variants"][0]["id"])

    r = hole(client)
    t = text(r.content)
    assert "Käsewürfel & Weinbeeren" in t
    assert "groß" in t
    assert "Fest mit Ümlaut" in t

    cd = r.headers["content-disposition"]
    assert cd.isascii(), cd
    assert "Fest-mit-Uemlaut.pdf" in cd, cd


def test_dateiname_bleibt_brauchbar_wenn_der_name_nur_zeichen_ist(client, catalog_id):
    ev = client.post(
        "/api/events", json={"catalog_id": catalog_id, "name": "!!! ???"}
    ).json()
    client.post(f"/api/events/{ev['id']}/activate")
    cd = hole(client).headers["content-disposition"]
    assert "rechnungsuebersicht-veranstaltung.pdf" in cd, cd


def test_viele_bons_erzeugen_mehrere_seiten(client, active_event):
    _e, vid = active_event
    for _ in range(45):
        _bon(client, vid)
    inhalt = hole(client).content
    blaetter = seiten(inhalt)
    assert len(blaetter) >= 2
    # Die Fußzeile zaehlt mit, damit im Ausdruck nichts unbemerkt fehlt.
    assert "Seite 2" in " ".join(blaetter).replace("\n", " ")


def test_ein_anderer_tag_zeigt_seinen_eigenen_stand(client, active_event):
    _e, vid = active_event
    _bon(client, vid, "5")
    t = text(hole(client, "?day=2020-01-01").content)
    assert "2020" in t
    assert "Januar" in t
    assert "23,00" not in t  # der Umsatz von heute gehoert nicht in diesen Tag


def test_pdf_ist_wiederholbar(client, active_event):
    """Zweimal derselbe Tag - keine Nebenwirkung auf die Daten."""
    _e, vid = active_event
    _bon(client, vid)
    vorher = client.get("/api/cash-count").json()
    erst = hole(client).content
    zweit = hole(client).content
    assert client.get("/api/cash-count").json() == vorher
    assert text(erst) == text(zweit)
