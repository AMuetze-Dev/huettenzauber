/**
 * Bewusst fehlschlagende Tests (vitest `it.fails`): dokumentieren gewollte
 * Grenzen des lokalen Reducers. `it.fails` ist gruen, solange der Body
 * scheitert - wird die Luecke geschlossen, wird der Test ROT und muss hier
 * raus.
 *
 * Frueher hier, inzwischen geschlossen (siehe cartReducer.test.ts):
 * "Serverzeile ohne lokale Metadaten verschwindet" - sie erscheint jetzt als
 * Platzhalter, damit ein zweites Geraet sichtbar mittippen kann.
 */
import { describe, expect, it } from "vitest";
import {
  cartReducer,
  emptyCart,
  type CartAction,
  type CartLine,
} from "./cartReducer";

const line: Omit<CartLine, "qty"> = {
  variantId: 1,
  stockItemId: 10,
  itemName: "Glühwein",
  variantLabel: "Tasse",
  unitPrice: 4.5,
  deposit: 2,
};

const lookup = (id: number) => (id === line.variantId ? line : null);

function snapshot(revision: number, lines: [number, number][]): CartAction {
  return {
    type: "serverSnapshot",
    revision,
    lines: lines.map(([variantId, qty]) => ({ variantId, qty })),
    depositReturns: [],
    lookup,
  };
}

describe("cartReducer – dokumentierte Luecken", () => {
  it.fails("uebernimmt KEINE aktualisierten Metadaten beim erneuten bump", () => {
    let s = cartReducer(emptyCart, { type: "bump", line, step: 1 });
    s = cartReducer(s, {
      type: "bump",
      line: { ...line, unitPrice: 9.99, itemName: "Glühwein NEU" },
      step: 1,
    });
    // wuenschenswert: der Reducer uebernimmt den neuen Preis/Namen
    expect(s.lines[0].unitPrice).toBe(9.99);
    expect(s.lines[0].itemName).toBe("Glühwein NEU");
  });

  it.fails("kein Schutz gegen negative Endmengen via mehrfaches bump(-1)", () => {
    let s = cartReducer(emptyCart, { type: "bump", line, step: 1 });
    s = cartReducer(s, { type: "bump", line, step: -1 });
    s = cartReducer(s, { type: "bump", line, step: -1 });
    // wuenschenswert: eine dauerhaft leere Historie / kein "Geist"-lastVariantId
    expect(s.lastVariantId).toBeNull();
  });

  it.fails("ein noch nicht bestaetigter Tipp ueberlebt einen fremden Snapshot NICHT", () => {
    // Terminal tippt +1 (Antwort noch unterwegs), zeitgleich aendert das Handy
    // etwas anderes -> dessen neuerer Stand kennt unseren Tipp noch nicht.
    let s = cartReducer(emptyCart, snapshot(4, []));
    s = cartReducer(s, { type: "bump", line, step: 1 });
    s = cartReducer(s, snapshot(5, [])); // Aenderung vom zweiten Geraet
    // wuenschenswert: der eigene, noch unbestaetigte Tipp bleibt sichtbar
    expect(s.lines).toHaveLength(1);
  });

  it.fails("Reducer kennt keine Mengen-Obergrenze je Position", () => {
    let s = cartReducer(emptyCart, { type: "bump", line, step: 1 });
    s = cartReducer(s, { type: "setQty", variantId: 1, qty: 1_000_000 });
    // wuenschenswert: eine Plausibilitaetsgrenze am Ausschank
    expect(s.lines[0].qty).toBeLessThan(1000);
  });

  it.fails("Platzhalter-Position laesst sich nicht sinnvoll bepreisen", () => {
    const s = cartReducer(emptyCart, snapshot(1, [[99, 2]]));
    // wuenschenswert: das Terminal laedt fehlende Artikel nach
    expect(s.lines[0].unitPrice).toBeGreaterThan(0);
  });
});
