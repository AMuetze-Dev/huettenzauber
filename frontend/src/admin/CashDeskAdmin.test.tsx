import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../api/client";
import { ToastProvider } from "../components/Toast";
import type { CashCount, CashMovement, DepositReturnRow } from "../api/types";
import CashDeskAdmin from "./CashDeskAdmin";

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
    opening_float: "0.00",
    movement_total: "0.00",
    expected_cash: "84.00",
    counted_cash: null,
    difference: null,
    closed: false,
    closed_at: null,
    ...over,
  };
}

function movement(over: Partial<CashMovement> = {}): CashMovement {
  return {
    id: 9,
    event_id: 1,
    business_day: "2026-09-07",
    created_at: "2026-09-07T11:00:00Z",
    amount: "50.00",
    reason: "Wechselgeld nachgelegt",
    ...over,
  };
}

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
    vi.spyOn(api, "cashMovements").mockResolvedValue([]);
    vi.spyOn(api, "addCashMovement");
    vi.spyOn(api, "deleteCashMovement").mockResolvedValue(undefined);
    vi.spyOn(api, "setCashFloat").mockResolvedValue(count());
    vi.spyOn(api, "closeDay").mockResolvedValue(undefined);
    vi.spyOn(api, "createDepositReturn");
    vi.spyOn(api, "deleteDepositReturn").mockResolvedValue(undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  // --- Anzeige ---------------------------------------------------
  it("rechnet den Soll-Bestand vor", async () => {
    mount();
    expect(await screen.findByText("Soll-Bestand")).toBeInTheDocument();
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

  // --- Zählung ---------------------------------------------------
  it("ohne Zählung steht der Hinweis, was zu tun ist", async () => {
    mount();
    expect(await screen.findByText(/Noch nicht gezählt/)).toBeInTheDocument();
  });

  it("zeigt Überschuss und Fehlbetrag im Klartext", async () => {
    vi.mocked(api.cashCount).mockResolvedValue(
      count({ counted_cash: "80.00", difference: "-4.00" }),
    );
    mount();
    expect(await screen.findByText(/Fehlbetrag 4,00 €/)).toBeInTheDocument();
  });

  it("„stimmt genau“ bei Differenz 0", async () => {
    vi.mocked(api.cashCount).mockResolvedValue(
      count({ counted_cash: "84.00", difference: "0.00" }),
    );
    mount();
    expect(await screen.findByText("stimmt genau")).toBeInTheDocument();
  });

  it("der Zähl-Dialog ist mit dem Soll-Bestand vorbelegt", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: /Zählen & abschließen/ }));
    expect(within(padOf("Zählen & abschließen")).getByText("84")).toBeInTheDocument();
  });

  it("die Differenz erscheint schon beim Tippen", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: /Zählen & abschließen/ }));
    const pad = padOf("Zählen & abschließen");
    fireEvent.click(within(pad).getByRole("button", { name: "Zeichen löschen" }));
    fireEvent.click(within(pad).getByRole("button", { name: "0" }));
    expect(within(pad).getByText(/Fehlbetrag 4,00 €/)).toBeInTheDocument();
  });

  it("Tag abschließen übergibt den gezählten Betrag", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: /Zählen & abschließen/ }));
    fireEvent.click(screen.getByRole("button", { name: "Tag abschließen" }));
    await waitFor(() => expect(api.closeDay).toHaveBeenCalledWith("84"));
    expect(await screen.findByText("Tag abgeschlossen")).toBeInTheDocument();
  });

  it("„Ohne Zählung abschließen“ fragt nach und schickt null", async () => {
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "Ohne Zählung abschließen" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Trotzdem abschließen" }),
    );
    await waitFor(() => expect(api.closeDay).toHaveBeenCalledWith(null));
  });

  it("Rückfrage abbrechen schließt den Tag nicht", async () => {
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "Ohne Zählung abschließen" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Abbrechen" }));
    expect(api.closeDay).not.toHaveBeenCalled();
  });

  it("ein abgeschlossener Tag lässt sich noch korrigieren", async () => {
    vi.mocked(api.cashCount).mockResolvedValue(
      count({
        closed: true,
        closed_at: "2026-09-07T22:00:00Z",
        counted_cash: "84.00",
        difference: "0.00",
      }),
    );
    mount();
    expect(
      await screen.findByRole("button", { name: /Zählung korrigieren/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ohne Zählung abschließen" })).toBeNull();
  });

  it("markiert einen abgeschlossenen Tag sichtbar", async () => {
    vi.mocked(api.cashCount).mockResolvedValue(
      count({ closed: true, closed_at: "2026-09-07T22:00:00Z" }),
    );
    mount();
    expect(await screen.findByText("abgeschlossen")).toBeInTheDocument();
  });

  // --- Wechselgeld ----------------------------------------------
  it("Wechselgeld setzen schickt den Betrag", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Wechselgeld setzen" }));
    const pad = padOf("Wechselgeld zu Beginn");
    fireEvent.click(within(pad).getByRole("button", { name: "5" }));
    fireEvent.click(within(pad).getByRole("button", { name: "0" }));
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(api.setCashFloat).toHaveBeenCalledWith("50"));
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
    fireEvent.click(within(pad).getByRole("button", { name: "Zeichen löschen" }));
    fireEvent.click(within(pad).getByRole("button", { name: "Zeichen löschen" }));
    fireEvent.click(within(pad).getByRole("button", { name: "Zeichen löschen" }));
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

  // --- Bargeld rein & raus --------------------------------------
  it("ohne Bewegungen steht ein klarer Leerzustand", async () => {
    mount();
    expect(await screen.findByText("Heute noch nichts bewegt.")).toBeInTheDocument();
  });

  it("listet Einlagen mit Plus und Entnahmen mit Minus", async () => {
    vi.mocked(api.cashMovements).mockResolvedValue([
      movement(),
      movement({ id: 10, amount: "-30.00", reason: "In den Tresor" }),
    ]);
    mount();
    expect(await screen.findByText("Wechselgeld nachgelegt")).toBeInTheDocument();
    expect(screen.getByText(/\+ 50,00/)).toBeInTheDocument();
    expect(screen.getByText(/− 30,00/)).toBeInTheDocument();
  });

  it("zeigt die Bewegungssumme im Soll-Bestand", async () => {
    vi.mocked(api.cashCount).mockResolvedValue(
      count({ movement_total: "-30.00", expected_cash: "54.00" }),
    );
    mount();
    await screen.findByText("Ein-/Auszahlungen");
    expect(screen.getByText(/− 30,00/)).toBeInTheDocument();
  });

  it("Einlage wird positiv gebucht", async () => {
    vi.mocked(api.addCashMovement).mockResolvedValue(movement());
    mount();
    fireEvent.click(await screen.findByRole("button", { name: /Geld einlegen/ }));
    const pad = padOf("Geld einlegen");
    fireEvent.click(within(pad).getByRole("button", { name: "5" }));
    fireEvent.click(within(pad).getByRole("button", { name: "0" }));
    fireEvent.click(within(pad).getByRole("button", { name: /50,00.*einlegen/ }));
    await waitFor(() => expect(api.addCashMovement).toHaveBeenCalledWith("50", ""));
  });

  it("Entnahme wird negativ gebucht", async () => {
    vi.mocked(api.addCashMovement).mockResolvedValue(
      movement({ amount: "-50.00" }),
    );
    mount();
    fireEvent.click(await screen.findByRole("button", { name: /Geld entnehmen/ }));
    const pad = padOf("Geld entnehmen");
    fireEvent.click(within(pad).getByRole("button", { name: "5" }));
    fireEvent.click(within(pad).getByRole("button", { name: "0" }));
    fireEvent.click(within(pad).getByRole("button", { name: /50,00.*entnehmen/ }));
    await waitFor(() => expect(api.addCashMovement).toHaveBeenCalledWith("-50", ""));
  });

  it("ein Grund lässt sich ohne Tastatur wählen", async () => {
    vi.mocked(api.addCashMovement).mockResolvedValue(movement());
    mount();
    fireEvent.click(await screen.findByRole("button", { name: /Geld entnehmen/ }));
    const pad = padOf("Geld entnehmen");
    fireEvent.click(within(pad).getByRole("button", { name: "9" }));
    fireEvent.click(within(pad).getByRole("button", { name: "In den Tresor" }));
    fireEvent.click(within(pad).getByRole("button", { name: /entnehmen/ }));
    await waitFor(() =>
      expect(api.addCashMovement).toHaveBeenCalledWith("-9", "In den Tresor"),
    );
  });

  it("ohne Betrag ist das Buchen gesperrt", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: /Geld einlegen/ }));
    expect(
      within(padOf("Geld einlegen")).getByRole("button", { name: /einlegen/ }),
    ).toBeDisabled();
  });

  it("eine Bewegung lässt sich nach einem Vertipper löschen", async () => {
    vi.mocked(api.cashMovements).mockResolvedValue([movement()]);
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: /Bewegung über 50,00/ }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Löschen" }));
    await waitFor(() => expect(api.deleteCashMovement).toHaveBeenCalledWith(9));
  });
});
