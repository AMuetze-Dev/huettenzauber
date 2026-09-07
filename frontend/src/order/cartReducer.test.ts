import { describe, expect, it } from "vitest";
import {
  cartReducer,
  cartTotals,
  emptyCart,
  type CartLine,
  type CartState,
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

function reduce(state: CartState, ...actions: Parameters<typeof cartReducer>[1][]) {
  return actions.reduce(cartReducer, state);
}

describe("cartReducer", () => {
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

  it("setQty 0 entfernt, negativ wird auf 0 geklemmt", () => {
    let s = reduce(emptyCart, { type: "bump", line: gluehwein, step: 2 });
    s = cartReducer(s, { type: "setQty", variantId: 1, qty: -5 });
    expect(s.lines).toHaveLength(0);
  });

  it("Summen: Artikel + Pfand − Pfandrückgabe, geklemmt bei 0", () => {
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
    expect(s.depositReturn).not.toBeNull();
    s = cartReducer(s, { type: "setDepositReturn", unitAmount: 2, quantity: 0 });
    expect(s.depositReturn).toBeNull();
  });

  it("clear leert alles inkl. Pfandrückgabe", () => {
    let s = reduce(
      emptyCart,
      { type: "bump", line: gluehwein, step: 2 },
      { type: "setDepositReturn", unitAmount: 2, quantity: 1 },
    );
    s = cartReducer(s, { type: "clear" });
    expect(s.lines).toHaveLength(0);
    expect(s.depositReturn).toBeNull();
  });

  it("syncLines gleicht Mengen an den Server an, behält bekannte Zeilen-Metadaten", () => {
    let s = reduce(
      emptyCart,
      { type: "bump", line: gluehwein, step: 5 },
      { type: "bump", line: bier, step: 5 },
    );
    s = cartReducer(s, {
      type: "syncLines",
      lines: [{ variantId: 1, qty: 3 }], // Server kennt nur Variante 1 mit 3
    });
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]).toMatchObject({ variantId: 1, qty: 3, itemName: "Glühwein rot" });
  });
});
