"""Rechnungsübersicht als PDF.

Optik folgt der Oberfläche (styles/tokens.css): dunkler warmer Grund, Gold als
Akzent, Inter als Schrift - dieselbe Schrift, die auch das Frontend ausliefert.
Ein weißes Blatt wäre neben den Bildschirmen ein Fremdkörper.

Gedruckt wird das selten; gelesen wird es am Handy oder am Rechner. Deshalb
Bildschirm-Optik statt Bürodokument.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from fpdf import FPDF
from fpdf.enums import Align, XPos, YPos

from core.clock import local_time
from schemas import BillListItem, CashCountOut, ConsumptionRow

# --- Farben (aus frontend/src/styles/tokens.css) ---------------------
GRUND = (26, 25, 23)          # --bg
KARTE = (34, 32, 29)          # --chrome
ZEILE = (42, 39, 36)          # --tile
AKZENT = (200, 168, 117)      # --accent
AKZENT_HELL = (224, 203, 164) # --accent-bright
TEXT = (236, 233, 228)        # --text
TEXT_LEISE = (156, 152, 146)  # --text-muted, auf dunklem Grund ausgerechnet
LINIE = (61, 58, 53)          # --border
STORNO = (227, 156, 138)      # --danger

FONT_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"

RAND = 14.0
ZEILENHOEHE = 6.0

WOCHENTAG = [
    "Montag", "Dienstag", "Mittwoch", "Donnerstag",
    "Freitag", "Samstag", "Sonntag",
]
MONAT = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
]


def _datum_lang(tag: date) -> str:
    """Ohne `locale` - die ist im Container nicht gesetzt."""
    return f"{WOCHENTAG[tag.weekday()]}, {tag.day}. {MONAT[tag.month - 1]} {tag.year}"


def _euro(value: Decimal | float) -> str:
    """1234.5 -> 1.234,50 EUR in deutscher Schreibweise, ohne `locale`."""
    s = f"{Decimal(value):,.2f}"
    return s.replace(",", "\x00").replace(".", ",").replace("\x00", ".") + " €"


def _menge(value: Decimal) -> str:
    d = Decimal(value)
    if d == d.to_integral_value():
        return str(int(d))
    return f"{d:.3f}".rstrip("0").rstrip(".").replace(".", ",")


class Uebersicht(FPDF):
    """Seitenrahmen: dunkler Grund und Fußzeile auf jeder Seite."""

    def __init__(self) -> None:
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_auto_page_break(auto=True, margin=18)
        self.set_margins(RAND, RAND, RAND)
        self.add_font("Inter", "", FONT_DIR / "Inter-Regular.ttf")
        self.add_font("Inter", "B", FONT_DIR / "Inter-SemiBold.ttf")
        self.set_font("Inter", "", 9)

    def header(self) -> None:
        # Der Grund muss vor allem anderen liegen.
        self.set_fill_color(*GRUND)
        self.rect(0, 0, self.w, self.h, style="F")

    def footer(self) -> None:
        self.set_y(-14)
        self.set_font("Inter", "", 7.5)
        self.set_text_color(*TEXT_LEISE)
        self.cell(0, 5, "Landgasthof Zum Ross · Diesbar", align=Align.L)
        self.cell(
            0, 5, f"Seite {self.page_no()} von {{nb}}",
            align=Align.R, new_x=XPos.LMARGIN, new_y=YPos.NEXT,
        )


def _kopf(pdf: Uebersicht, kasse: CashCountOut) -> None:
    breite = pdf.w - 2 * RAND
    pdf.set_fill_color(*KARTE)
    pdf.rect(RAND, RAND, breite, 26, style="F")
    # Goldener Streifen links - dasselbe Motiv wie auf den Artikelkacheln.
    pdf.set_fill_color(*AKZENT)
    pdf.rect(RAND, RAND, 1.6, 26, style="F")

    pdf.set_xy(RAND + 7, RAND + 4)
    pdf.set_font("Inter", "B", 15)
    pdf.set_text_color(*TEXT)
    pdf.cell(breite - 14, 8, "Rechnungsübersicht", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_x(RAND + 7)
    pdf.set_font("Inter", "", 9.5)
    pdf.set_text_color(*AKZENT_HELL)
    pdf.cell(
        breite - 40, 6,
        f"{kasse.event_name} · {_datum_lang(kasse.business_day)}",
    )
    pdf.set_font("Inter", "", 8)
    pdf.set_text_color(*TEXT_LEISE)
    pdf.cell(
        0, 6, "Tag abgeschlossen" if kasse.closed else "Tag läuft",
        align=Align.R, new_x=XPos.LMARGIN, new_y=YPos.NEXT,
    )
    pdf.set_y(RAND + 26 + 8)


def _summenblock(pdf: Uebersicht, kasse: CashCountOut) -> None:
    """Die vier Zahlen, die den Tag beschreiben - nebeneinander wie Kacheln."""
    felder = [
        ("Bons", str(kasse.bill_count), False),
        ("Warenwert", _euro(kasse.total_gross), False),
        ("Pfand", _euro(kasse.total_deposit), False),
        ("Bareinnahme", _euro(kasse.cash_income), True),
    ]
    breite = (pdf.w - 2 * RAND - 3 * 3) / 4
    y = pdf.get_y()
    for i, (titel, wert, hervor) in enumerate(felder):
        x = RAND + i * (breite + 3)
        pdf.set_fill_color(*KARTE)
        pdf.rect(x, y, breite, 17, style="F")
        if hervor:
            pdf.set_fill_color(*AKZENT)
            pdf.rect(x, y, breite, 0.8, style="F")
        pdf.set_xy(x + 4, y + 3)
        pdf.set_font("Inter", "", 7)
        pdf.set_text_color(*TEXT_LEISE)
        pdf.cell(breite - 8, 4, titel.upper(), new_x=XPos.LEFT, new_y=YPos.NEXT)
        pdf.set_x(x + 4)
        pdf.set_font("Inter", "B", 11.5)
        pdf.set_text_color(*(AKZENT_HELL if hervor else TEXT))
        pdf.cell(breite - 8, 7, wert)
    pdf.set_y(y + 17 + 6)


def _abzuege(pdf: Uebersicht, kasse: CashCountOut) -> None:
    """Was von den Bons wieder herausging - nur wenn es etwas gab."""
    posten = []
    if kasse.deposit_return_in_bills > 0:
        posten.append(("Pfand über Bons zurück", kasse.deposit_return_in_bills))
    if kasse.standalone_deposit_return > 0:
        posten.append(("Pfand einzeln ausgezahlt", kasse.standalone_deposit_return))
    if not posten:
        return
    pdf.set_font("Inter", "", 8.5)
    for titel, betrag in posten:
        pdf.set_text_color(*TEXT_LEISE)
        pdf.cell(62, 5, titel)
        pdf.set_text_color(*STORNO)
        pdf.cell(32, 5, "− " + _euro(betrag), align=Align.R,
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(5)


def _abschnitt(pdf: Uebersicht, titel: str) -> None:
    pdf.set_font("Inter", "B", 11)
    pdf.set_text_color(*TEXT)
    pdf.cell(0, 7, titel, new_x=XPos.LMARGIN, new_y=YPos.NEXT)


def _tabellenkopf(pdf: Uebersicht, spalten: list[tuple[str, float, Align]]) -> None:
    pdf.set_font("Inter", "", 7)
    pdf.set_text_color(*AKZENT)
    for titel, breite, ausricht in spalten:
        pdf.cell(breite, 5, titel.upper(), align=ausricht)
    pdf.ln(5)
    pdf.set_draw_color(*LINIE)
    pdf.line(RAND, pdf.get_y(), pdf.w - RAND, pdf.get_y())
    pdf.ln(1.5)


def _zebra(pdf: Uebersicht, index: int) -> None:
    """Hilft, eine Zeile über die volle Breite zu verfolgen."""
    if index % 2 == 0:
        pdf.set_fill_color(*ZEILE)
        pdf.rect(RAND, pdf.get_y() - 0.6, pdf.w - 2 * RAND, ZEILENHOEHE, style="F")


BON_SPALTEN: list[tuple[str, float, Align]] = [
    ("Nr.", 15, Align.L),
    ("Zeit", 16, Align.L),
    ("Pos.", 14, Align.R),
    ("Warenwert", 27, Align.R),
    ("Pfand", 23, Align.R),
    ("Rückgabe", 25, Align.R),
    ("Summe", 29, Align.R),
    ("", 33, Align.R),
]


def _bonliste(pdf: Uebersicht, bons: list[BillListItem]) -> None:
    _abschnitt(pdf, "Bons")
    if not bons:
        pdf.set_font("Inter", "", 9)
        pdf.set_text_color(*TEXT_LEISE)
        pdf.cell(0, 6, "An diesem Tag wurde nichts kassiert.",
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(4)
        return

    _tabellenkopf(pdf, BON_SPALTEN)
    for i, b in enumerate(bons):
        if pdf.will_page_break(ZEILENHOEHE):
            pdf.add_page()
            _tabellenkopf(pdf, BON_SPALTEN)
        _zebra(pdf, i)

        summe = b.total_gross + b.total_deposit - b.deposit_return_total
        haupt = STORNO if b.is_deleted else TEXT
        leise = STORNO if b.is_deleted else TEXT_LEISE

        pdf.set_font("Inter", "", 8.5)
        pdf.set_text_color(*haupt)
        pdf.cell(15, 5.5, f"#{b.id}")
        pdf.cell(16, 5.5, local_time(b.created_at).strftime("%H:%M"))
        pdf.set_text_color(*leise)
        pdf.cell(14, 5.5, str(b.position_count), align=Align.R)
        pdf.cell(27, 5.5, _euro(b.total_gross), align=Align.R)
        pdf.cell(
            23, 5.5,
            _euro(b.total_deposit) if b.total_deposit else "–", align=Align.R,
        )
        pdf.cell(
            25, 5.5,
            "− " + _euro(b.deposit_return_total) if b.deposit_return_total
            else "–",
            align=Align.R,
        )
        pdf.set_font("Inter", "B", 8.5)
        pdf.set_text_color(*haupt)
        pdf.cell(29, 5.5, _euro(summe), align=Align.R)
        pdf.set_font("Inter", "", 7)
        pdf.set_text_color(*STORNO)
        pdf.cell(33, 5.5, "storniert" if b.is_deleted else "", align=Align.R)
        pdf.ln(ZEILENHOEHE)
    pdf.ln(5)


VERBRAUCH_SPALTEN: list[tuple[str, float, Align]] = [
    ("Artikel", 120, Align.L),
    ("Menge", 24, Align.R),
    ("Umsatz", 38, Align.R),
]


def _verbrauch(pdf: Uebersicht, zeilen: list[ConsumptionRow]) -> None:
    _abschnitt(pdf, "Was über die Theke ging")
    if not zeilen:
        pdf.set_font("Inter", "", 9)
        pdf.set_text_color(*TEXT_LEISE)
        pdf.cell(0, 6, "Keine Positionen.", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        return

    _tabellenkopf(pdf, VERBRAUCH_SPALTEN)
    for i, z in enumerate(zeilen):
        if pdf.will_page_break(ZEILENHOEHE):
            pdf.add_page()
            _tabellenkopf(pdf, VERBRAUCH_SPALTEN)
        _zebra(pdf, i)

        name = z.item_name
        if z.variant_name and z.variant_name != z.item_name:
            name += f" · {z.variant_name}"
        pdf.set_font("Inter", "", 8.5)
        pdf.set_text_color(*TEXT)
        pdf.cell(120, 5.5, name)
        pdf.set_font("Inter", "B", 8.5)
        pdf.set_text_color(*AKZENT_HELL)
        pdf.cell(24, 5.5, _menge(z.quantity), align=Align.R)
        pdf.set_font("Inter", "", 8.5)
        pdf.set_text_color(*TEXT_LEISE)
        pdf.cell(38, 5.5, _euro(z.revenue), align=Align.R)
        pdf.ln(ZEILENHOEHE)


def build_overview(
    *,
    kasse: CashCountOut,
    bons: list[BillListItem],
    verbrauch: list[ConsumptionRow],
    erstellt: datetime | None = None,
) -> bytes:
    pdf = Uebersicht()
    pdf.set_title(f"Rechnungsuebersicht {kasse.business_day.isoformat()}")
    pdf.set_author("Landgasthof Zum Ross")
    pdf.set_creator("Huettenzauber")
    pdf.alias_nb_pages()
    pdf.add_page()

    _kopf(pdf, kasse)
    _summenblock(pdf, kasse)
    _abzuege(pdf, kasse)
    _bonliste(pdf, bons)
    _verbrauch(pdf, verbrauch)

    pdf.ln(7)
    pdf.set_font("Inter", "", 7)
    pdf.set_text_color(*TEXT_LEISE)
    stempel = local_time(erstellt).strftime("%d.%m.%Y %H:%M")
    pdf.cell(0, 4, f"Erstellt am {stempel}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    return bytes(pdf.output())


# Fuer den Dateinamen: HTTP-Kopfzeilen tragen nur ASCII. `isalnum()` sagt
# bei "Ü" ja, die Kopfzeile zerbricht daran trotzdem - also erst umschreiben.
_UMSCHRIFT = str.maketrans(
    {
        "ä": "ae", "ö": "oe", "ü": "ue", "Ä": "Ae", "Ö": "Oe", "Ü": "Ue",
        "ß": "ss", "é": "e", "è": "e", "ê": "e", "á": "a", "à": "a",
        "â": "a", "í": "i", "ó": "o", "ô": "o", "ú": "u", "ç": "c",
        "ñ": "n",
    }
)


def dateiname(kasse: CashCountOut) -> str:
    """Sprechender Name für den Download - der Tag steht vorn, damit sich
    mehrere Dateien im Ordner von selbst sortieren.

    Reines ASCII: der Name geht als `Content-Disposition` über die Leitung,
    und dort ist alles jenseits von Latin-1 ein Fehler, kein Sonderfall.
    """
    roh = kasse.event_name.translate(_UMSCHRIFT)
    sauber = "".join(
        c if (c.isascii() and c.isalnum()) or c in "-_" else "-" for c in roh
    )
    while "--" in sauber:
        sauber = sauber.replace("--", "-")
    sauber = sauber.strip("-") or "veranstaltung"
    return f"{kasse.business_day.isoformat()}-rechnungsuebersicht-{sauber}.pdf"
