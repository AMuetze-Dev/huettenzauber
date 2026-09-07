import { describe, expect, it } from "vitest";
import {
  cartReducer,
  cartTotals,
  emptyCart,
  type CartAction,
  type CartLine,
  type CartState,
  type LineLookup,
} from "./cartReducer";

const gluehwein: Omit<CartLine, "qty"> = {
  variantId: 1,
  stockItemId: 10,
  itemName: "Glühwein rot",
  variantLabel: "Tasse",
  unitPrice: 4.5,
  deposit: 2,
};

const bier: Omit<CartLine, "qty"> = {
  variantId: 2,
  stockItemId: 11,
  itemName: "Helles",
  variantLabel: "0,5 l",
  unitPrice: 4.6,
  deposit: 0,
};

const bratwurst: Omit<CartLine, "qty"> = {
  variantId: 3,
  stockItemId: 12,
  itemName: "Bratwurst",
  variantLabel: "Standard",
  unitPrice: 5.5,
  deposit: 0,
};

/** Katalog, wie ihn das Terminal geladen hat. */
const katalog: LineLookup = (id) =>
  [gluehwein, bier, bratwurst].find((l) => l.variantId === id) ?? null;

/** Terminal ohne geladenen Katalog. */
const leer: LineLookup = () => null;

function snapshot(
  revision: number,
  lines: [number, number][],
  opts: { lookup?: LineLookup; depositReturns?: CartState["depositReturns"] } = {},
): CartAction {
  return {
    type: "serverSnapshot",
    revision,
    lines: lines.map(([variantId, qty]) => ({ variantId, qty })),
    depositReturns: opts.depositReturns ?? [],
    lookup: opts.lookup ?? katalog,
  };
}

function reduce(state: CartState, ...actions: CartAction[]) {
  return actions.reduce(cartReducer, state);
}

describe("cartReducer – lokales Tippen", () => {
  it("fügt hinzu und zählt hoch (dedupe pro Variante)", () => {
    const s = reduce(
      emptyCart,
      { type: "bump", line: gluehwein, step: 1 },
      { type: "bump", line: gluehwein, step: 1 },
      { type: "bump", line: gluehwein, step: 1 },
    );
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0].qty).toBe(3);
    expect(s.lastVariantId).toBe(1);
  });

  it("bump mit -1 entfernt die Zeile bei 0", () => {
    const s = reduce(
      emptyCart,
      { type: "bump", line: gluehwein, step: 1 },
      { type: "bump", line: gluehwein, step: -1 },
    );
    expect(s.lines).toHaveLength(0);
  });

  it("bump mit -1 auf leerer Zeile ist no-op", () => {
    const s = cartReducer(emptyCart, { type: "bump", line: gluehwein, step: -1 });
    expect(s).toBe(emptyCart);
  });

  it("bump mit step 2 legt Zeile mit qty 2 an", () => {
    const s = cartReducer(emptyCart, { type: "bump", line: gluehwein, step: 2 });
    expect(s.lines[0].qty).toBe(2);
  });

  it("bump auf existierende Zeile ignoriert neue Metadaten (Preis bleibt)", () => {
    let s = cartReducer(emptyCart, { type: "bump", line: gluehwein, step: 1 });
    s = cartReducer(s, {
      type: "bump",
      line: { ...gluehwein, unitPrice: 99 },
      step: 1,
    });
    expect(s.lines[0].unitPrice).toBe(4.5);
    expect(s.lines[0].qty).toBe(2);
  });

  it("bumpFailed nimmt genau den fehlgeschlagenen Schritt zurück", () => {
    let s = reduce(
      emptyCart,
      { type: "bump", line: gluehwein, step: 2 },
      { type: "bump", line: gluehwein, step: 3 },
    );
    s = cartReducer(s, { type: "bumpFailed", variantId: 1, step: 3 });
    expect(s.lines[0].qty).toBe(2);
  });

  it("bumpFailed auf die letzte Einheit entfernt die Zeile", () => {
    let s = cartReducer(emptyCart, { type: "bump", line: gluehwein, step: 1 });
    s = cartReducer(s, { type: "bumpFailed", variantId: 1, step: 1 });
    expect(s.lines).toHaveLength(0);
  });

  it("bumpFailed eines Minus-Schritts stellt die Menge wieder her", () => {
    let s = reduce(
      emptyCart,
      { type: "bump", line: gluehwein, step: 4 },
      { type: "bump", line: gluehwein, step: -1 },
    );
    expect(s.lines[0].qty).toBe(3);
    s = cartReducer(s, { type: "bumpFailed", variantId: 1, step: -1 });
    expect(s.lines[0].qty).toBe(4);
  });

  it("bumpFailed auf unbekannte Variante ist no-op", () => {
    let s = cartReducer(emptyCart, { type: "bump", line: bier, step: 1 });
    s = cartReducer(s, { type: "bumpFailed", variantId: 999, step: 1 });
    expect(s.lines).toHaveLength(1);
  });

  it("setQty 0 entfernt, negativ wird auf 0 geklemmt", () => {
    let s = reduce(emptyCart, { type: "bump", line: gluehwein, step: 2 });
    s = cartReducer(s, { type: "setQty", variantId: 1, qty: -5 });
    expect(s.lines).toHaveLength(0);
  });

  it("setQty auf unbekannte Variante ist no-op", () => {
    const s = cartReducer(emptyCart, { type: "setQty", variantId: 42, qty: 3 });
    expect(s.lines).toHaveLength(0);
  });

  it("remove auf unbekannte Variante ist no-op", () => {
    let s = cartReducer(emptyCart, { type: "bump", line: bier, step: 1 });
    s = cartReducer(s, { type: "remove", variantId: 999 });
    expect(s.lines).toHaveLength(1);
  });

  it("clear leert alles inkl. Pfandrückgabe", () => {
    let s = reduce(
      emptyCart,
      { type: "bump", line: gluehwein, step: 2 },
      { type: "setDepositReturn", unitAmount: 2, quantity: 1 },
    );
    s = cartReducer(s, { type: "clear" });
    expect(s.lines).toHaveLength(0);
    expect(s.depositReturns).toEqual([]);
    expect(s.lastVariantId).toBeNull();
  });

  it("clear behält die Revision – ein alter Snapshot darf nicht zurückkommen", () => {
    let s = cartReducer(emptyCart, snapshot(7, [[1, 3]]));
    s = cartReducer(s, { type: "clear" });
    expect(s.revision).toBe(7);
    s = cartReducer(s, snapshot(7, [[1, 3]]));
    expect(s.lines).toHaveLength(0);
  });
});

describe("cartReducer – Serverstand", () => {
  it("übernimmt einen neueren Stand vollständig", () => {
    const s = cartReducer(emptyCart, snapshot(1, [[1, 3]]));
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]).toMatchObject({ variantId: 1, qty: 3, itemName: "Glühwein rot" });
    expect(s.revision).toBe(1);
  });

  it("verwirft einen überholten Stand (kleinere Revision)", () => {
    let s = cartReducer(emptyCart, snapshot(5, [[1, 3]]));
    s = cartReducer(s, snapshot(4, [[1, 1]]));
    expect(s.lines[0].qty).toBe(3);
    expect(s.revision).toBe(5);
  });

  it("verwirft einen doppelt zugestellten Stand (gleiche Revision)", () => {
    let s = cartReducer(emptyCart, snapshot(5, [[1, 3]]));
    const before = s;
    s = cartReducer(s, snapshot(5, [[1, 99]]));
    expect(s).toBe(before);
  });

  it("zwei sich überholende Antworten verlieren keine Position (der alte Bug)", () => {
    // Tipp A (Glühwein) und Tipp B (Bratwurst); Antwort A trifft NACH B ein.
    let s = reduce(
      emptyCart,
      { type: "bump", line: gluehwein, step: 1 },
      { type: "bump", line: bratwurst, step: 1 },
    );
    s = cartReducer(s, snapshot(9, [[1, 1], [3, 1]])); // Antwort B
    s = cartReducer(s, snapshot(8, [[1, 1]])); // veraltete Antwort A
    expect(s.lines.map((l) => l.variantId).sort()).toEqual([1, 3]);
  });

  it("zeigt eine Position, die nur ein zweites Gerät getippt hat", () => {
    const s = cartReducer(emptyCart, snapshot(1, [[2, 4]]));
    expect(s.lines[0]).toMatchObject({ variantId: 2, qty: 4, itemName: "Helles" });
  });

  it("unbekannte Variante ohne Katalog erscheint als Platzhalter statt zu verschwinden", () => {
    const s = cartReducer(emptyCart, snapshot(1, [[77, 2]], { lookup: leer }));
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0].itemName).toBe("Artikel #77");
    expect(s.lines[0].unitPrice).toBe(0);
  });

  it("greift auf lokal bekannte Metadaten zurück, wenn der Katalog sie nicht kennt", () => {
    let s = cartReducer(emptyCart, { type: "bump", line: gluehwein, step: 1 });
    s = cartReducer(s, snapshot(1, [[1, 6]], { lookup: leer }));
    expect(s.lines[0]).toMatchObject({ qty: 6, itemName: "Glühwein rot", unitPrice: 4.5 });
  });

  it("leerer Serverstand leert den Warenkorb (Bon wurde kassiert)", () => {
    let s = reduce(
      emptyCart,
      { type: "bump", line: gluehwein, step: 2 },
      { type: "bump", line: bier, step: 1 },
    );
    s = cartReducer(s, snapshot(3, []));
    expect(s.lines).toHaveLength(0);
  });

  it("Menge 0 im Serverstand fliegt raus", () => {
    const s = cartReducer(emptyCart, snapshot(1, [[1, 0], [2, 2]]));
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0].variantId).toBe(2);
  });

  it("übernimmt die Pfandrückgabe vom Server", () => {
    const s = cartReducer(
      emptyCart,
      snapshot(1, [[1, 1]], { depositReturns: [{ unitAmount: 2, quantity: 3 }] }),
    );
    expect(s.depositReturns).toEqual([{ unitAmount: 2, quantity: 3 }]);
    expect(cartTotals(s).depositReturn).toBe(6);
  });

  it("löscht die Pfandrückgabe, wenn der Server keine mehr meldet", () => {
    let s = cartReducer(
      emptyCart,
      snapshot(1, [[1, 1]], { depositReturns: [{ unitAmount: 2, quantity: 3 }] }),
    );
    s = cartReducer(s, snapshot(2, [[1, 1]]));
    expect(s.depositReturns).toEqual([]);
  });

  it("erster Snapshot mit Revision 0 wird übernommen (emptyCart startet bei -1)", () => {
    const s = cartReducer(emptyCart, snapshot(0, [[1, 1]]));
    expect(s.lines).toHaveLength(1);
  });
});

describe("cartTotals", () => {
  it("Artikel + Pfand − Pfandrückgabe, geklemmt bei 0", () => {
    let s = reduce(
      emptyCart,
      { type: "bump", line: gluehwein, step: 3 }, // 13,50 + 6,00 Pfand
      { type: "bump", line: bier, step: 1 }, // 4,60
    );
    let t = cartTotals(s);
    expect(t.gross).toBeCloseTo(18.1);
    expect(t.deposit).toBeCloseTo(6);
    expect(t.due).toBeCloseTo(24.1);
    expect(t.count).toBe(4);

    s = cartReducer(s, { type: "setDepositReturn", unitAmount: 2, quantity: 20 });
    t = cartTotals(s);
    expect(t.depositReturn).toBe(40);
    expect(t.due).toBe(0); // nicht negativ
  });

  it("setDepositReturn mit 0 löscht", () => {
    let s = cartReducer(emptyCart, {
      type: "setDepositReturn",
      unitAmount: 2,
      quantity: 3,
    });
    expect(s.depositReturns).toHaveLength(1);
    s = cartReducer(s, { type: "setDepositReturn", unitAmount: 2, quantity: 0 });
    expect(s.depositReturns).toEqual([]);
  });

  it("leerer Warenkorb ist überall 0", () => {
    const t = cartTotals(emptyCart);
    expect(t).toMatchObject({ gross: 0, deposit: 0, depositReturn: 0, due: 0, count: 0 });
  });

  it("nur Pfandartikel", () => {
    const s = cartReducer(emptyCart, { type: "bump", line: gluehwein, step: 2 });
    const t = cartTotals(s);
    expect(t.gross).toBeCloseTo(9);
    expect(t.deposit).toBeCloseTo(4);
    expect(t.due).toBeCloseTo(13);
  });

  it("Cent-Arithmetik: 0.1 + 0.2 bleibt brauchbar", () => {
    const cent: Omit<CartLine, "qty"> = { ...bier, unitPrice: 0.1, variantId: 9 };
    const cent2: Omit<CartLine, "qty"> = { ...bier, unitPrice: 0.2, variantId: 8 };
    const s = reduce(
      emptyCart,
      { type: "bump", line: cent, step: 1 },
      { type: "bump", line: cent2, step: 1 },
    );
    expect(cartTotals(s).gross).toBeCloseTo(0.3, 10);
  });

  it("Platzhalter-Position zählt mit, kostet aber nichts", () => {
    const s = cartReducer(emptyCart, snapshot(1, [[77, 3]], { lookup: leer }));
    const t = cartTotals(s);
    expect(t.count).toBe(3);
    expect(t.due).toBe(0);
  });

  it("Platzhalter bekommt Namen und Preis nach, sobald der Katalog da ist", () => {
    let s = cartReducer(emptyCart, snapshot(1, [[1, 2]], { lookup: leer }));
    expect(s.lines[0].unitPrice).toBe(0);
    s = cartReducer(s, { type: "relabel", lookup: katalog });
    expect(s.lines[0]).toMatchObject({ itemName: "Glühwein rot", unitPrice: 4.5, qty: 2 });
  });

  it("relabel ohne Treffer lässt den Zustand unangetastet", () => {
    const s = cartReducer(emptyCart, snapshot(1, [[1, 2]]));
    expect(cartReducer(s, { type: "relabel", lookup: leer })).toBe(s);
  });

  it("relabel behält die Mengen", () => {
    let s = cartReducer(emptyCart, snapshot(1, [[1, 7]], { lookup: leer }));
    s = cartReducer(s, { type: "relabel", lookup: katalog });
    expect(s.lines[0].qty).toBe(7);
  });
});

describe("cartReducer – mehrere Pfandsorten", () => {
  it("hält jede Sorte getrennt", () => {
    let s = cartReducer(emptyCart, {
      type: "setDepositReturn",
      unitAmount: 2,
      quantity: 3,
    });
    s = cartReducer(s, { type: "setDepositReturn", unitAmount: 1.5, quantity: 2 });
    expect(s.depositReturns).toEqual([
      { unitAmount: 1.5, quantity: 2 },
      { unitAmount: 2, quantity: 3 },
    ]);
    expect(cartTotals(s).depositReturn).toBeCloseTo(9);
  });

  it("dieselbe Sorte zweimal ersetzt die Menge", () => {
    let s = cartReducer(emptyCart, {
      type: "setDepositReturn",
      unitAmount: 2,
      quantity: 3,
    });
    s = cartReducer(s, { type: "setDepositReturn", unitAmount: 2, quantity: 5 });
    expect(s.depositReturns).toEqual([{ unitAmount: 2, quantity: 5 }]);
  });

  it("Menge 0 entfernt nur diese Sorte", () => {
    let s = cartReducer(emptyCart, {
      type: "setDepositReturn",
      unitAmount: 2,
      quantity: 3,
    });
    s = cartReducer(s, { type: "setDepositReturn", unitAmount: 1.5, quantity: 2 });
    s = cartReducer(s, { type: "setDepositReturn", unitAmount: 2, quantity: 0 });
    expect(s.depositReturns).toEqual([{ unitAmount: 1.5, quantity: 2 }]);
  });

  it("Rundungsreste landen auf derselben Sorte", () => {
    let s = cartReducer(emptyCart, {
      type: "setDepositReturn",
      unitAmount: 2.001,
      quantity: 3,
    });
    s = cartReducer(s, { type: "setDepositReturn", unitAmount: 2, quantity: 4 });
    expect(s.depositReturns).toEqual([{ unitAmount: 2, quantity: 4 }]);
  });

  it("clearDepositReturns räumt alle Sorten weg", () => {
    let s = cartReducer(emptyCart, {
      type: "setDepositReturn",
      unitAmount: 2,
      quantity: 3,
    });
    s = cartReducer(s, { type: "clearDepositReturns" });
    expect(s.depositReturns).toEqual([]);
  });

  it("Serverstand ersetzt die Sortenliste vollständig", () => {
    let s = cartReducer(emptyCart, {
      type: "setDepositReturn",
      unitAmount: 5,
      quantity: 1,
    });
    s = cartReducer(s, {
      ...(snapshot(3, [[1, 1]]) as Extract<CartAction, { type: "serverSnapshot" }>),
      depositReturns: [{ unitAmount: 2, quantity: 2 }],
    });
    expect(s.depositReturns).toEqual([{ unitAmount: 2, quantity: 2 }]);
  });

  it("Summe klemmt auch bei mehreren Sorten bei 0", () => {
    let s = cartReducer(emptyCart, { type: "bump", line: gluehwein, step: 1 });
    s = cartReducer(s, { type: "setDepositReturn", unitAmount: 2, quantity: 10 });
    s = cartReducer(s, { type: "setDepositReturn", unitAmount: 1.5, quantity: 10 });
    expect(cartTotals(s).due).toBe(0);
  });
});
