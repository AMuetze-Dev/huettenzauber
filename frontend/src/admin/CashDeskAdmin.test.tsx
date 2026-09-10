import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../api/client";
import { ToastProvider } from "../components/Toast";
import type { CashCount, DayClose, DepositReturnRow } from "../api/types";
import { saveFile } from "../lib/download";
import CashDeskAdmin from "./CashDeskAdmin";

// Der Blob-Link wird hier nicht geprueft, nur dass er mit dem richtigen
// Dateinamen bedient wird - jsdom laedt nichts herunter.
vi.mock("../lib/download", () => ({ saveFile: vi.fn() }));

function count(over: Partial<CashCount> = {}): CashCount {
  return {
    event_id: 1,
    event_name: "Testfest",
    business_day: "2026-09-07",
    bill_count: 3,
    total_gross: "74.00",
    total_deposit: "12.00",
    deposit_return_in_bills: "2.00",
    standalone_deposit_return: "0.00",
    cash_income: "84.00",
    closed: false,
    closed_at: null,
    ...over,
  };
}

const ABSCHLUSS: DayClose = {
  event_id: 1,
  business_day: "2026-09-07",
  closed_at: "2026-09-07T22:00:00Z",
  total_gross: "74.00",
  total_deposit: "12.00",
};

const RUECKGABE: DepositReturnRow = {
  id: 5,
  event_id: 1,
  bill_id: null,
  created_at: "2026-09-07T14:30:00Z",
  business_day: "2026-09-07",
  unit_amount: "2.00",
  quantity: 3,
  total_amount: "6.00",
};

function mount() {
  render(
    <ToastProvider>
      <CashDeskAdmin />
    </ToastProvider>,
  );
}

/** Der geöffnete Dialog samt Zehnertastatur und Aktionsknöpfen. */
const padOf = (title: string) => screen.getByRole("dialog", { name: title });

describe("CashDeskAdmin", () => {
  beforeEach(() => {
    vi.spyOn(api, "cashCount").mockResolvedValue(count());
    vi.spyOn(api, "depositReturns").mockResolvedValue([]);
    vi.spyOn(api, "closeDay").mockResolvedValue(ABSCHLUSS);
    vi.spyOn(api, "createDepositReturn");
    vi.spyOn(api, "deleteDepositReturn").mockResolvedValue(undefined);
    vi.spyOn(api, "billsPdf").mockResolvedValue({
      blob: new Blob(["%PDF-"], { type: "application/pdf" }),
      filename: "2026-09-07-rechnungsuebersicht-Testfest.pdf",
    });
    vi.mocked(saveFile).mockClear();
  });
  afterEach(() => vi.restoreAllMocks());

  // --- Anzeige ---------------------------------------------------
  it("führt die Bareinnahme als Ergebnis des Tages", async () => {
    mount();
    expect(await screen.findByText("Bareinnahme")).toBeInTheDocument();
    expect(screen.getAllByText("84,00 €").length).toBeGreaterThan(0);
  });

  it("zeigt die Bonanzahl", async () => {
    mount();
    expect(await screen.findByText("Bons (3)")).toBeInTheDocument();
  });

  it("Pfandposten stehen als Abzug da", async () => {
    mount();
    await screen.findByText("Pfand in Bons zurück");
    expect(screen.getAllByText("− 2,00 €").length).toBeGreaterThan(0);
  });

  it("meldet, wenn keine Veranstaltung läuft", async () => {
    vi.mocked(api.cashCount).mockRejectedValue(new ApiError(409, "keine"));
    mount();
    expect(await screen.findByText(/Keine aktive Veranstaltung/)).toBeInTheDocument();
  });

  it("zeigt einen Ladehinweis statt eines leeren Bildschirms", () => {
    mount();
    expect(screen.getByText("Wird geladen …")).toBeInTheDocument();
  });

  it("heißt Tagesabschluss, nicht mehr Kassenschnitt", async () => {
    mount();
    expect(
      await screen.findByRole("heading", { level: 1, name: "Tagesabschluss" }),
    ).toBeInTheDocument();
  });

  // --- Kein Kassenbestand mehr (D41) ----------------------------
  it("fragt keinen gezählten Bestand ab", async () => {
    mount();
    await screen.findByText("Bareinnahme");
    expect(screen.queryByText(/Soll-Bestand/)).toBeNull();
    expect(screen.queryByText(/Noch nicht gezählt/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Zählen/ })).toBeNull();
  });

  it("kennt kein Wechselgeld und keine Bargeldbewegungen", async () => {
    mount();
    await screen.findByText("Bareinnahme");
    expect(screen.queryByRole("button", { name: /Wechselgeld setzen/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Geld einlegen/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Geld entnehmen/ })).toBeNull();
  });

  it("sagt, warum kein Bestand geführt wird", async () => {
    mount();
    expect(await screen.findByText(/Trinkgeld/)).toBeInTheDocument();
  });

  // --- Abschluss -------------------------------------------------
  it("Tag abschließen fragt nach und schickt keinen Betrag", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Tag abschließen" }));
    fireEvent.click(await screen.findByRole("button", { name: "Abschließen" }));
    await waitFor(() => expect(api.closeDay).toHaveBeenCalledWith());
    expect(await screen.findByText("Tag abgeschlossen")).toBeInTheDocument();
  });

  it("Rückfrage abbrechen schließt den Tag nicht", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Tag abschließen" }));
    fireEvent.click(await screen.findByRole("button", { name: "Abbrechen" }));
    expect(api.closeDay).not.toHaveBeenCalled();
  });

  it("die Rückfrage nennt die Sicherung", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Tag abschließen" }));
    const frage = await screen.findByRole("dialog", { name: "Tag abschließen?" });
    expect(within(frage).getByText(/Sicherung/)).toBeInTheDocument();
  });

  it("ein abgeschlossener Tag nennt die Uhrzeit und lässt sich erneut abschließen", async () => {
    vi.mocked(api.cashCount).mockResolvedValue(
      count({ closed: true, closed_at: "2026-09-07T22:00:00Z" }),
    );
    mount();
    expect(
      await screen.findByRole("button", { name: "Erneut abschließen" }),
    ).toBeInTheDocument();
    // Die Uhrzeit kommt aus der Zeitzone des Geräts - geprüft wird die Form.
    expect(screen.getByText(/Abgeschlossen um/)).toHaveTextContent(
      /Abgeschlossen um \d{2}:\d{2} Uhr/,
    );
  });

  it("markiert einen abgeschlossenen Tag sichtbar", async () => {
    vi.mocked(api.cashCount).mockResolvedValue(
      count({ closed: true, closed_at: "2026-09-07T22:00:00Z" }),
    );
    mount();
    expect(await screen.findByText("abgeschlossen")).toBeInTheDocument();
  });

  it("ein Fehler beim Abschluss wird gemeldet", async () => {
    vi.mocked(api.closeDay).mockRejectedValue(new ApiError(409, "keine"));
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Tag abschließen" }));
    fireEvent.click(await screen.findByRole("button", { name: "Abschließen" }));
    expect(await screen.findByText("keine")).toBeInTheDocument();
  });

  // --- PDF -------------------------------------------------------
  it("die Übersicht lässt sich als PDF ziehen", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: /Übersicht als PDF/ }));
    await waitFor(() => expect(api.billsPdf).toHaveBeenCalled());
    expect(saveFile).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "2026-09-07-rechnungsuebersicht-Testfest.pdf",
      }),
    );
  });

  it("scheitert der Ausdruck, bleibt es nicht still", async () => {
    vi.mocked(api.billsPdf).mockRejectedValue(new ApiError(0, "weg"));
    mount();
    fireEvent.click(await screen.findByRole("button", { name: /Übersicht als PDF/ }));
    expect(await screen.findByText(/fehlgeschlagen/)).toBeInTheDocument();
    expect(saveFile).not.toHaveBeenCalled();
  });

  // --- Eigenständige Pfandrückgabe ------------------------------
  it("listet ausgezahlte Pfandrückgaben", async () => {
    vi.mocked(api.depositReturns).mockResolvedValue([RUECKGABE]);
    mount();
    expect(await screen.findByText("3×")).toBeInTheDocument();
    expect(screen.getByText("− 6,00 €")).toBeInTheDocument();
  });

  it("ohne Einträge steht ein klarer Leerzustand", async () => {
    mount();
    expect(await screen.findByText("Heute noch keine.")).toBeInTheDocument();
  });

  it("Pfand auszahlen legt einen Eintrag mit Anzahl an", async () => {
    vi.mocked(api.createDepositReturn).mockResolvedValue(RUECKGABE);
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Pfand auszahlen" }));
    fireEvent.click(screen.getByRole("button", { name: "6 Stück" }));
    fireEvent.click(screen.getByRole("button", { name: /6× auszahlen/ }));
    await waitFor(() =>
      expect(api.createDepositReturn).toHaveBeenCalledWith("2.00", 6),
    );
  });

  it("die Schaltfläche nennt den Auszahlbetrag", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Pfand auszahlen" }));
    fireEvent.click(screen.getByRole("button", { name: "5 Stück" }));
    expect(
      screen.getByRole("button", { name: /5× auszahlen · 10,00/ }),
    ).toBeInTheDocument();
  });

  it("Auszahlung mit Betrag 0 ist gesperrt", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Pfand auszahlen" }));
    const pad = padOf("Pfand auszahlen");
    for (let i = 0; i < 4; i++)
      fireEvent.click(within(pad).getByRole("button", { name: "Zeichen löschen" }));
    expect(screen.getByRole("button", { name: /1× auszahlen/ })).toBeDisabled();
  });

  it("Löschen fragt nach und entfernt dann", async () => {
    vi.mocked(api.depositReturns).mockResolvedValue([RUECKGABE]);
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: /Pfandrückgabe über 6,00/ }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Löschen" }));
    await waitFor(() => expect(api.deleteDepositReturn).toHaveBeenCalledWith(5));
  });

  it("eine bonpflichtige Rückgabe lehnt der Server ab – das wird gemeldet", async () => {
    vi.mocked(api.depositReturns).mockResolvedValue([RUECKGABE]);
    vi.mocked(api.deleteDepositReturn).mockRejectedValue(
      new ApiError(409, "Gehört zu einem Bon"),
    );
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: /Pfandrückgabe über 6,00/ }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Löschen" }));
    expect(await screen.findByText("Gehört zu einem Bon")).toBeInTheDocument();
  });
});
