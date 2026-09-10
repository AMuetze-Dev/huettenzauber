import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../api/client";
import { ToastProvider } from "../components/Toast";
import type { ActiveOrder, Category, EventDto, StockItem } from "../api/types";
import OrderTerminal from "./OrderTerminal";

// --- Testkatalog ------------------------------------------------
const EVENT: EventDto = {
  id: 1,
  catalog_id: 7,
  name: "Testfest",
  started_at: "2026-09-07T10:00:00Z",
  ended_at: null,
  is_active: true,
};

const CATEGORIES: Category[] = [
  { id: 100, catalog_id: 7, name: "Bier", icon: "MdCategory", sort_order: 0 },
  { id: 200, catalog_id: 7, name: "Kueche", icon: "MdCategory", sort_order: 1 },
];

function item(
  id: number,
  name: string,
  categoryId: number,
  variants: [number, string | null, string][],
  extra: Partial<StockItem> = {},
): StockItem {
  return {
    id,
    catalog_id: 7,
    category_id: categoryId,
    name,
    deposit_amount: "0",
    is_active: true,
    sort_order: id,
    is_favorite: false,
    color: null,
    variants: variants.map(([vid, vname, price]) => ({
      id: vid,
      stock_item_id: id,
      name: vname,
      price,
      bill_steps: "1.000",
      is_active: true,
    })),
    ...extra,
  };
}

const HELLES = item(1, "Helles", 100, [[11, "0,5 l", "4.00"]], {
  is_favorite: true,
  color: "#c8a875",
});
const WEIZEN = item(
  2,
  "Weizen",
  100,
  [
    [21, "0,3 l", "3.00"],
    [22, "0,5 l", "5.00"],
  ],
  { deposit_amount: "1.50" }, // Bierglas
);
const WURST = item(3, "Bratwurst", 200, [[31, null, "5.50"]], {
  is_favorite: true,
  deposit_amount: "2.00", // Teller
});

const ITEMS = [HELLES, WEIZEN, WURST];

function order(revision: number, lines: [number, number][] = []): ActiveOrder {
  const gross = lines.reduce((a, [vid, qty]) => {
    const v = ITEMS.flatMap((i) => i.variants).find((x) => x.id === vid);
    return a + Number(v?.price ?? 0) * qty;
  }, 0);
  return {
    event_id: 1,
    updated_at: "2026-09-07T10:00:00Z",
    revision,
    lines: lines.map(([vid, qty]) => ({
      item_variant_id: vid,
      quantity: qty.toFixed(3),
    })),
    deposit_returns: [],
    total_gross: gross.toFixed(2),
    total_deposit: "0.00",
    deposit_return_total: "0.00",
    total_due: gross.toFixed(2),
  };
}

// --- SSE-Attrappe -----------------------------------------------
let sse: FakeEventSource | null = null;
class FakeEventSource {
  onopen: (() => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    sse = this;
  }
  close() {}
}

/** Serverstand pushen, als käme er vom SSE-Strom. */
function push(o: ActiveOrder) {
  act(() => {
    sse!.onmessage!({ data: JSON.stringify(o) } as MessageEvent);
  });
}

function renderTerminal() {
  render(
    <MemoryRouter>
      <ToastProvider>
        <OrderTerminal />
      </ToastProvider>
    </MemoryRouter>,
  );
}

async function mount() {
  renderTerminal();
  await screen.findByRole("heading", { name: "Bier" });
}

const tile = (name: string) => screen.getByText(name).closest("button")!;
const cartBtn = () => screen.getByRole("button", { name: /Warenkorb öffnen/ });
const cartDialog = () => screen.getByRole("dialog", { name: "Warenkorb" });
const payDialog = () => screen.getByRole("dialog", { name: "Bar kassieren" });
const pfandDialog = () => screen.getByRole("dialog", { name: "Pfandrückgabe" });
const qtyDialog = () => screen.getByRole("dialog", { name: "Menge ändern" });

/** Ein Tipp auf eine Kachel: Pointer runter und gleich wieder hoch. */
function tap(el: Element) {
  fireEvent.pointerDown(el);
  fireEvent.pointerUp(el);
}

const wartAufKorb = (menge: RegExp) =>
  waitFor(() => expect(cartBtn()).toHaveAccessibleName(menge));

describe("OrderTerminal", () => {
  beforeEach(() => {
    sse = null;
    vi.stubGlobal("EventSource", FakeEventSource as unknown as typeof EventSource);
    vi.spyOn(api, "activeEvent").mockResolvedValue(EVENT);
    vi.spyOn(api, "categories").mockResolvedValue(CATEGORIES);
    vi.spyOn(api, "stockItems").mockResolvedValue(ITEMS);
    vi.spyOn(api, "favorites").mockResolvedValue([HELLES, WURST]);
    vi.spyOn(api, "lineDelta").mockResolvedValue(order(1, [[11, 1]]));
    vi.spyOn(api, "setDepositReturn").mockResolvedValue(order(1));
    vi.spyOn(api, "clearOrder").mockResolvedValue(order(2));
    vi.spyOn(api, "clearDepositReturns").mockResolvedValue(order(2));
    vi.spyOn(api, "createDepositReturn");
    vi.spyOn(api, "createBill");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  // --- Grundzustand ---------------------------------------------
  it("zeigt die erste Kategorie und ihre Artikel", async () => {
    await mount();
    expect(screen.getByRole("heading", { name: "Bier" })).toBeInTheDocument();
    expect(tile("Weizen")).toBeInTheDocument();
  });

  it("meldet, wenn keine Veranstaltung läuft", async () => {
    vi.mocked(api.activeEvent).mockResolvedValue(null);
    renderTerminal();
    expect(await screen.findByText("Keine aktive Veranstaltung")).toBeInTheDocument();
  });

  it("meldet einen Ladefehler, statt einen leeren Katalog vorzutäuschen", async () => {
    vi.mocked(api.activeEvent).mockRejectedValue(new ApiError(0, "weg"));
    renderTerminal();
    expect(await screen.findByText("Kasse antwortet nicht")).toBeInTheDocument();
  });

  it("wechselt die Kategorie", async () => {
    await mount();
    fireEvent.click(screen.getByText("Kueche").closest("button")!);
    expect(
      await screen.findByRole("heading", { name: "Kueche" }),
    ).toBeInTheDocument();
  });

  // --- Schnellzugriff -------------------------------------------
  it("legt für jede Variante eines Favoriten eine eigene Kachel an", async () => {
    await mount();
    const bar = screen.getByText("Schnellzugriff").parentElement!;
    expect(within(bar).getByText("Bratwurst")).toBeInTheDocument();
    expect(within(bar).getByText(/Helles/)).toBeInTheDocument();
  });

  it("zeigt keine Schnellzugriffsleiste ohne Favoriten", async () => {
    vi.mocked(api.favorites).mockResolvedValue([]);
    await mount();
    expect(screen.queryByText("Schnellzugriff")).toBeNull();
  });

  it("ein Favorit aus einer anderen Kategorie ist ohne Umschalten erreichbar", async () => {
    await mount();
    const bar = screen.getByText("Schnellzugriff").parentElement!;
    tap(within(bar).getByText("Bratwurst").closest("button")!);
    await waitFor(() => expect(api.lineDelta).toHaveBeenCalledWith(31, 1));
  });

  // --- Tippen ----------------------------------------------------
  it("Karte mit mehreren Größen klappt auf statt blind zu buchen", async () => {
    await mount();
    fireEvent.click(tile("Weizen"));
    expect(await screen.findByText("0,3 l")).toBeInTheDocument();
    expect(api.lineDelta).not.toHaveBeenCalled();
  });

  it("Einzelvariante bucht direkt", async () => {
    await mount();
    tap(screen.getAllByText("Helles").at(-1)!.closest("button")!);
    await waitFor(() => expect(api.lineDelta).toHaveBeenCalledWith(11, 1));
  });

  it("scheitert die Buchung, wird die Menge zurückgenommen und gemeldet", async () => {
    vi.mocked(api.lineDelta).mockRejectedValue(
      new ApiError(409, "Artikel ist nicht mehr aktiv"),
    );
    await mount();
    tap(screen.getAllByText("Helles").at(-1)!.closest("button")!);
    expect(await screen.findByText("Artikel ist nicht mehr aktiv")).toBeInTheDocument();
    expect(cartBtn()).toHaveAccessibleName(/0 Artikel/);
  });

  it("Netzwerkausfall beim Tippen wird in Klartext gemeldet", async () => {
    vi.mocked(api.lineDelta).mockRejectedValue(new ApiError(0, "weg"));
    await mount();
    tap(screen.getAllByText("Helles").at(-1)!.closest("button")!);
    expect(await screen.findByText(/Kasse nicht erreichbar/)).toBeInTheDocument();
  });

  // --- Zweiter Eingabepunkt (Handy im Hotspot) ------------------
  it("übernimmt eine Position, die nur ein zweites Gerät getippt hat", async () => {
    await mount();
    push(order(5, [[22, 3]]));
    await wartAufKorb(/3 Artikel/);
    // 3 × 5,00 € Weizen + 3 × 1,50 € Pfand
    expect(screen.getByRole("button", { name: /Bar kassieren – 19,50/ })).toBeInTheDocument();
  });

  it("verwirft einen überholten Serverstand", async () => {
    await mount();
    push(order(9, [[22, 3]]));
    await wartAufKorb(/3 Artikel/);
    push(order(8, [[22, 1]])); // veraltet
    expect(cartBtn()).toHaveAccessibleName(/3 Artikel/);
  });

  it("leert den Korb, wenn der Server ihn leer meldet", async () => {
    await mount();
    push(order(5, [[22, 2]]));
    await wartAufKorb(/2 Artikel/);
    push(order(6, []));
    await wartAufKorb(/0 Artikel/);
  });

  // --- Warenkorb -------------------------------------------------
  async function openCart() {
    await mount();
    push(order(5, [[11, 2]])); // 2 × 4,00 €
    await wartAufKorb(/2 Artikel/);
    fireEvent.click(cartBtn());
    return cartDialog();
  }

  it("öffnet den Warenkorb mit den Positionen", async () => {
    await openCart();
    expect(screen.getByLabelText("Menge für Helles ändern")).toHaveTextContent("2");
  });

  it("Plus im Warenkorb bucht +1", async () => {
    await openCart();
    tap(screen.getByLabelText("mehr"));
    await waitFor(() => expect(api.lineDelta).toHaveBeenCalledWith(11, 1));
  });

  it("Minus im Warenkorb bucht −1", async () => {
    await openCart();
    tap(screen.getByLabelText("weniger"));
    await waitFor(() => expect(api.lineDelta).toHaveBeenCalledWith(11, -1));
  });

  it("Halten auf Plus bucht +5 (Runden statt Dauertippen)", async () => {
    await openCart();
    vi.useFakeTimers();
    try {
      const plus = screen.getByLabelText("mehr");
      fireEvent.pointerDown(plus);
      act(() => void vi.advanceTimersByTime(600));
      fireEvent.pointerUp(plus);
      expect(api.lineDelta).toHaveBeenCalledWith(11, 5);
    } finally {
      vi.useRealTimers();
    }
  });

  it("Menge antippen öffnet die Zehnertastatur und setzt exakt", async () => {
    await openCart();
    fireEvent.click(screen.getByLabelText("Menge für Helles ändern"));
    fireEvent.click(within(qtyDialog()).getByRole("button", { name: "10" }));
    fireEvent.click(screen.getByRole("button", { name: /Menge auf 10 setzen/ }));
    await waitFor(() => expect(api.lineDelta).toHaveBeenCalledWith(11, 8));
  });

  it("Menge auf 0 setzen entfernt die Position", async () => {
    await openCart();
    fireEvent.click(screen.getByLabelText("Menge für Helles ändern"));
    fireEvent.click(
      within(qtyDialog()).getByRole("button", { name: "Eingabe löschen" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Position entfernen/ }));
    await waitFor(() => expect(api.lineDelta).toHaveBeenCalledWith(11, -2));
  });

  it("gleiche Menge eintippen schickt nichts", async () => {
    await openCart();
    fireEvent.click(screen.getByLabelText("Menge für Helles ändern"));
    fireEvent.click(screen.getByRole("button", { name: /Menge auf 2 setzen/ }));
    expect(api.lineDelta).not.toHaveBeenCalled();
  });

  it("Abbrechen im Mengen-Dialog ändert nichts", async () => {
    await openCart();
    fireEvent.click(screen.getByLabelText("Menge für Helles ändern"));
    fireEvent.click(within(qtyDialog()).getByRole("button", { name: "20" }));
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(api.lineDelta).not.toHaveBeenCalled();
  });

  // --- Pfand -----------------------------------------------------
  const openPfand = async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Pfandrückgabe" }));
    return pfandDialog();
  };
  /** Stückzahl einer Pfandsorte erhöhen (Sorte über ihren Artikelnamen). */
  const mehr = (sorte: string, mal = 1) => {
    const btn = screen.getByRole("button", { name: `${sorte}: mehr` });
    for (let i = 0; i < mal; i++) tap(btn);
  };

  it("bietet die Pfandsorten aus dem Katalog an, nicht einen freien Betrag", async () => {
    const dlg = await openPfand();
    expect(within(dlg).getByText("Weizen")).toBeInTheDocument();
    expect(within(dlg).getByText("Bratwurst")).toBeInTheDocument();
    expect(within(dlg).getByText("1,50 € je Stück")).toBeInTheDocument();
  });

  it("ohne Pfand im Katalog steht ein Hinweis statt einer leeren Liste", async () => {
    vi.mocked(api.stockItems).mockResolvedValue([HELLES]);
    await openPfand();
    expect(screen.getByText(/Pfandbeträge werden am Artikel gepflegt/)).toBeInTheDocument();
  });

  it("rechnet gemischtes Leergut zusammen", async () => {
    const dlg = await openPfand();
    mehr("Bratwurst", 3); // 3 × 2,00
    mehr("Weizen", 2); // 2 × 1,50
    expect(within(dlg).getByText("5 Stück")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /9,00.*bar auszahlen/ }),
    ).toBeInTheDocument();
  });

  it("bucht jede Pfandsorte einzeln auf die laufende Bestellung", async () => {
    await openCart();
    fireEvent.click(screen.getByRole("button", { name: /Pfand zurück/ }));
    mehr("Bratwurst", 3);
    mehr("Weizen", 2);
    fireEvent.click(
      screen.getByRole("button", { name: /Von dieser Bestellung abziehen/ }),
    );
    await waitFor(() => expect(api.setDepositReturn).toHaveBeenCalledWith("1.50", 2));
    expect(api.setDepositReturn).toHaveBeenCalledWith("2.00", 3);
  });

  it("ohne Warenkorb ist nur die Barauszahlung möglich", async () => {
    await openPfand();
    mehr("Bratwurst");
    expect(
      screen.getByRole("button", { name: /Von dieser Bestellung abziehen/ }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /bar auszahlen/ })).toBeEnabled();
  });

  it("Barauszahlung ohne Bon legt je Sorte einen Eintrag an", async () => {
    vi.mocked(api.createDepositReturn).mockResolvedValue({
      id: 1,
      event_id: 1,
      bill_id: null,
      created_at: "2026-09-07T12:00:00Z",
      business_day: "2026-09-07",
      unit_amount: "2.00",
      quantity: 3,
      total_amount: "6.00",
    });
    await openPfand();
    mehr("Bratwurst", 3);
    mehr("Weizen", 2);
    fireEvent.click(screen.getByRole("button", { name: /bar auszahlen/ }));
    await waitFor(() =>
      expect(api.createDepositReturn).toHaveBeenCalledWith("1.50", 2),
    );
    expect(api.createDepositReturn).toHaveBeenCalledWith("2.00", 3);
    expect(await screen.findByText(/5× Pfand ausgezahlt/)).toBeInTheDocument();
  });

  it("ohne gezähltes Leergut ist die Auszahlung gesperrt", async () => {
    await openPfand();
    expect(screen.getByRole("button", { name: /bar auszahlen/ })).toBeDisabled();
  });

  it("Menge lässt sich nicht unter 0 drücken", async () => {
    const dlg = await openPfand();
    tap(screen.getByRole("button", { name: "Weizen: weniger" }));
    expect(within(dlg).getByText("0 Stück")).toBeInTheDocument();
  });

  it("Halten auf Plus zählt in Fünferschritten", async () => {
    const dlg = await openPfand();
    vi.useFakeTimers();
    try {
      const plus = screen.getByRole("button", { name: "Bratwurst: mehr" });
      fireEvent.pointerDown(plus);
      act(() => void vi.advanceTimersByTime(600));
      fireEvent.pointerUp(plus);
    } finally {
      vi.useRealTimers();
    }
    expect(within(dlg).getByText("5 Stück")).toBeInTheDocument();
  });

  // --- Kassieren + Rückgeld -------------------------------------
  async function openPay() {
    await mount();
    push(order(5, [[11, 2]])); // 8,00 €
    await wartAufKorb(/2 Artikel/);
    fireEvent.click(screen.getByRole("button", { name: /Bar kassieren – 8,00/ }));
  }

  /** Stückelung antippen, wie der Gast sie auf den Tresen legt. */
  const legeHin = (...scheine: string[]) => {
    // Betrag ohne Waehrungszeichen - euro() setzt ein geschuetztes Leerzeichen.
    for (const v of scheine)
      fireEvent.click(
        within(payDialog()).getByRole("button", {
        name: new RegExp(`^${v}.*dazulegen$`),
      }),
      );
  };

  it("zeigt den fälligen Betrag", async () => {
    await openPay();
    expect(within(payDialog()).getAllByText("8,00 €").length).toBeGreaterThan(0);
  });

  it("ohne Angabe steht der Abschluss auf „passend erhalten“", async () => {
    await openPay();
    expect(
      screen.getByRole("button", { name: /Passend erhalten · abschließen/ }),
    ).toBeInTheDocument();
  });

  it("„passend“ setzt genau den fälligen Betrag", async () => {
    await openPay();
    fireEvent.click(within(payDialog()).getByText("passend").closest("button")!);
    expect(within(payDialog()).getByText("Rückgeld")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Abschließen · 0,00.*zurück/ }),
    ).toBeInTheDocument();
  });

  it("schlägt die Beträge vor, die Gäste typischerweise hinlegen", async () => {
    // 8,00 € fällig -> 10 und 15
    await openPay();
    const pay = payDialog();
    expect(within(pay).getByText("10 €")).toBeInTheDocument();
    expect(within(pay).getByText("15 €")).toBeInTheDocument();
  });

  it("ein Vorschlag rechnet das Rückgeld aus", async () => {
    await openPay();
    const pay = payDialog();
    fireEvent.click(within(pay).getByText("15 €").closest("button")!);
    expect(within(pay).getByText("Rückgeld")).toBeInTheDocument();
    expect(within(pay).getByText("7,00 €")).toBeInTheDocument();
  });

  it("Stückelung addiert sich – 20 + 20 + 5 = 45", async () => {
    await openPay();
    legeHin("20 €", "20 €", "5 €");
    const pay = payDialog();
    expect(within(pay).getByText("45,00 €")).toBeInTheDocument(); // erhalten
    expect(within(pay).getByText("37,00 €")).toBeInTheDocument(); // zurück
  });

  it("krumme Beträge gehen auch – 40 + 2 bei 8,00 €", async () => {
    await openPay();
    legeHin("20 €", "20 €", "2 €");
    expect(within(payDialog()).getByText("42,00 €")).toBeInTheDocument();
  });

  it("Münzen zählen mit", async () => {
    await openPay();
    legeHin("5 €", "2 €", "1 €", "50 ct");
    expect(within(payDialog()).getByText("8,50 €")).toBeInTheDocument();
    expect(within(payDialog()).getByText("0,50 €")).toBeInTheDocument();
  });

  it("zu wenig hingelegt meldet den Fehlbetrag", async () => {
    await openPay();
    legeHin("5 €");
    const pay = payDialog();
    expect(within(pay).getByText("Es fehlen noch")).toBeInTheDocument();
    expect(within(pay).getByText("3,00 €")).toBeInTheDocument();
  });

  it("Zurücksetzen räumt den erhaltenen Betrag weg", async () => {
    await openPay();
    legeHin("20 €");
    fireEvent.click(
      within(payDialog()).getByRole("button", {
        name: "Erhaltenen Betrag zurücksetzen",
      }),
    );
    expect(
      screen.getByRole("button", { name: /Passend erhalten · abschließen/ }),
    ).toBeInTheDocument();
  });

  it("Zurücksetzen ist ohne Eingabe gesperrt", async () => {
    await openPay();
    expect(
      within(payDialog()).getByRole("button", {
        name: "Erhaltenen Betrag zurücksetzen",
      }),
    ).toBeDisabled();
  });

  it("freie Eingabe für alles Krumme", async () => {
    await openPay();
    const pay = payDialog();
    fireEvent.click(within(pay).getByText("Betrag").closest("button")!);
    fireEvent.click(within(pay).getByRole("button", { name: "5" }));
    fireEvent.click(within(pay).getByRole("button", { name: "0" }));
    fireEvent.click(within(pay).getByRole("button", { name: /übernehmen/ }));
    expect(within(payDialog()).getByText("50,00 €")).toBeInTheDocument();
    expect(within(payDialog()).getByText("42,00 €")).toBeInTheDocument();
  });

  it("freie Eingabe lässt sich abbrechen", async () => {
    await openPay();
    fireEvent.click(within(payDialog()).getByText("Betrag").closest("button")!);
    fireEvent.click(within(payDialog()).getByRole("button", { name: "Abbrechen" }));
    expect(within(payDialog()).getByText("passend")).toBeInTheDocument();
  });

  it("Abschließen legt den Bon an und leert den Korb", async () => {
    vi.mocked(api.createBill).mockResolvedValue({
      id: 42,
      event_id: 1,
      created_at: "2026-09-07T12:00:00Z",
      business_day: "2026-09-07",
      is_deleted: false,
      total_gross: "8.00",
      total_deposit: "0.00",
      deposit_return_total: "0.00",
      items: [],
    });
    await openPay();
    fireEvent.click(screen.getByRole("button", { name: /Passend erhalten/ }));
    expect(await screen.findByText(/Bon #42/)).toBeInTheDocument();
    expect(cartBtn()).toHaveAccessibleName(/0 Artikel/);
  });

  const bonMock = () =>
    vi.mocked(api.createBill).mockResolvedValue({
      id: 42,
      event_id: 1,
      created_at: "2026-09-07T12:00:00Z",
      business_day: "2026-09-07",
      is_deleted: false,
      total_gross: "8.00",
      total_deposit: "0.00",
      deposit_return_total: "0.00",
      items: [],
    });

  // --- Kein Trinkgeld mehr im Rechner (D41) ----------------------
  it("bleibt ein Rest, wird trotzdem nur der Bon gebucht", async () => {
    bonMock();
    await openPay();
    legeHin("10 €"); // 8,00 fällig -> 2,00 Rest
    fireEvent.click(screen.getByRole("button", { name: /Abschließen · 2,00.*zurück/ }));
    await waitFor(() => expect(api.createBill).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Bon #42/)).toBeInTheDocument();
  });

  it("es gibt keinen Trinkgeld-Knopf mehr", async () => {
    await openPay();
    legeHin("10 €");
    expect(screen.queryByRole("button", { name: /Stimmt so/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Trinkgeld/ })).toBeNull();
  });

  it("der Rest steht als Rückgeld da, damit er in der Hand landet", async () => {
    await openPay();
    legeHin("10 €");
    const box = payDialog();
    expect(within(box).getByText("Rückgeld")).toBeInTheDocument();
    expect(within(box).getByText("2,00 €")).toBeInTheDocument();
  });

  it("scheitert der Bon, bleibt der Korb stehen", async () => {
    vi.mocked(api.createBill).mockRejectedValue(
      new ApiError(409, "Keine aktive Veranstaltung"),
    );
    await openPay();
    fireEvent.click(screen.getByRole("button", { name: /Passend erhalten/ }));
    expect(await screen.findByText("Keine aktive Veranstaltung")).toBeInTheDocument();
    expect(cartBtn()).toHaveAccessibleName(/2 Artikel/);
  });

  it("„Zurück zur Bestellung“ schließt ohne zu buchen", async () => {
    await openPay();
    fireEvent.click(screen.getByRole("button", { name: "Zurück zur Bestellung" }));
    expect(api.createBill).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Bar kassieren" })).toBeNull();
  });

  // --- Kleinkram, das am Tresen zählt ----------------------------
  it("Rücknahme-Taste ist ohne letzte Position gesperrt", async () => {
    await mount();
    expect(
      screen.getByRole("button", { name: "Letzte Position zurücknehmen" }),
    ).toBeDisabled();
  });

  it("Kassieren ist bei leerem Korb gesperrt", async () => {
    await mount();
    expect(screen.getByRole("button", { name: /Bar kassieren – 0,00/ })).toBeDisabled();
  });

  it("Warenkorb-Taste ist bei leerem Korb gesperrt", async () => {
    await mount();
    expect(cartBtn()).toBeDisabled();
  });

  // --- Leeren ----------------------------------------------------
  it("„Leeren“ verwirft die Bestellung auch beim Server", async () => {
    // Vorher wurde nur lokal geleert - das Kundendisplay zeigte weiter die
    // alte Bestellung, und der naechste Bon nahm sie mit.
    await openCart();
    fireEvent.click(screen.getByRole("button", { name: /Leeren/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Ja, leeren" }));
    await waitFor(() => expect(api.clearOrder).toHaveBeenCalled());
    expect(cartBtn()).toHaveAccessibleName(/0 Artikel/);
  });

  it("„Leeren“ fragt vorher nach", async () => {
    await openCart();
    fireEvent.click(screen.getByRole("button", { name: /Leeren/ }));
    expect(
      await screen.findByRole("dialog", { name: "Bestellung verwerfen?" }),
    ).toBeInTheDocument();
    expect(api.clearOrder).not.toHaveBeenCalled();
  });

  it("Rückfrage abbrechen lässt den Warenkorb stehen", async () => {
    await openCart();
    fireEvent.click(screen.getByRole("button", { name: /Leeren/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Abbrechen" }));
    expect(api.clearOrder).not.toHaveBeenCalled();
    expect(cartBtn()).toHaveAccessibleName(/2 Artikel/);
  });

  it("die Rückfrage nennt Anzahl und Betrag", async () => {
    await openCart();
    fireEvent.click(screen.getByRole("button", { name: /Leeren/ }));
    const dlg = await screen.findByRole("dialog", { name: "Bestellung verwerfen?" });
    expect(dlg).toHaveTextContent(/2 Artikel/);
    expect(dlg).toHaveTextContent(/8,00/);
  });

  it("scheitert das Leeren, wird gewarnt statt still zu tun", async () => {
    vi.mocked(api.clearOrder).mockRejectedValue(new ApiError(0, "weg"));
    await openCart();
    fireEvent.click(screen.getByRole("button", { name: /Leeren/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Ja, leeren" }));
    expect(
      await screen.findByText(/Bestellung eventuell noch offen/),
    ).toBeInTheDocument();
  });

  // --- Katalog kommt spaeter als der Serverstand -----------------
  it("holt Namen und Preise nach, wenn der Stand vor dem Katalog da ist", async () => {
    let liefereKatalog: (i: StockItem[]) => void = () => undefined;
    vi.mocked(api.stockItems).mockReturnValue(
      new Promise<StockItem[]>((resolve) => {
        liefereKatalog = resolve;
      }),
    );
    renderTerminal();
    // Serverstand trifft ein, bevor der Katalog geladen ist.
    await waitFor(() => expect(sse).not.toBeNull());
    push(order(4, [[11, 2]]));

    liefereKatalog(ITEMS);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Bar kassieren – 8,00/ })).toBeInTheDocument(),
    );
  });

  // --- Pfandhinweis auf der Kachel ------------------------------
  it("Einzelvariante mit Pfand zeigt den Aufschlag", async () => {
    await mount();
    fireEvent.click(screen.getByText("Kueche").closest("button")!);
    await screen.findByRole("heading", { name: "Kueche" });
    expect(screen.getByText(/\+ 2,00.*Pfand/)).toBeInTheDocument();
  });

  it("auch eine Karte mit mehreren Größen nennt das Pfand", async () => {
    // Weizen hat zwei Größen und 1,50 € Pfand - stand vorher nirgends.
    await mount();
    expect(screen.getByText(/\+ 1,50.*Pfand/)).toBeInTheDocument();
  });

  it("ohne Pfand steht auch kein Hinweis", async () => {
    await mount();
    expect(screen.queryByText(/Pfand/)).not.toBeNull(); // Weizen hat welches
    fireEvent.click(screen.getByText("Kueche").closest("button")!);
    await screen.findByRole("heading", { name: "Kueche" });
    // Helles (0 € Pfand) ist in "Bier"; hier steht nur die Bratwurst mit 2 €
    expect(screen.getAllByText(/Pfand/)).toHaveLength(1);
  });
});
