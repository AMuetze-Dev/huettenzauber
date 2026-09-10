import { describe, expect, it } from "vitest";
import { fitRows, FALLBACK_LINE_HEIGHT, MORE_HEIGHT } from "./guestRows";

const LINE_HEIGHT = FALLBACK_LINE_HEIGHT;

const positionen = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

/** Höhe, in die genau n Zeilen passen. */
const platzFuer = (n: number) => n * LINE_HEIGHT;

describe("fitRows", () => {
  it("leere Bestellung bleibt leer", () => {
    expect(fitRows([], platzFuer(7))).toEqual({ shown: [], hidden: 0 });
  });

  it("zeigt alles, solange es passt", () => {
    const r = fitRows(positionen(5), platzFuer(7));
    expect(r.shown).toHaveLength(5);
    expect(r.hidden).toBe(0);
  });

  it("genau ausgefüllt wird nicht gekürzt", () => {
    // Der alte Fehler: bei fester Obergrenze stand hier "+ n weitere",
    // obwohl noch Platz war.
    const r = fitRows(positionen(9), platzFuer(9));
    expect(r.shown).toHaveLength(9);
    expect(r.hidden).toBe(0);
  });

  it("nutzt mehr Platz auch aus", () => {
    expect(fitRows(positionen(12), platzFuer(12)).hidden).toBe(0);
  });

  it("kürzt erst, wenn es wirklich nicht mehr passt", () => {
    const r = fitRows(positionen(10), platzFuer(9));
    expect(r.hidden).toBeGreaterThan(0);
    expect(r.shown.length + r.hidden).toBe(10);
  });

  it("rechnet den Hinweis als eigene Zeile mit ein", () => {
    // 9 Zeilen Platz, 10 Positionen -> Hinweis frisst Platz, also 8 sichtbar
    const hoehe = platzFuer(9);
    const passtMitHinweis = Math.floor((hoehe - MORE_HEIGHT) / LINE_HEIGHT);
    const r = fitRows(positionen(10), hoehe);
    expect(r.shown).toHaveLength(passtMitHinweis);
    expect(r.hidden).toBe(10 - passtMitHinweis);
  });

  it("zeigt die zuletzt getippten Positionen, nicht die ersten", () => {
    // Der Gast will sehen, was gerade dazukam.
    const r = fitRows(positionen(20), platzFuer(5));
    expect(r.shown.at(-1)).toBe("p20");
    expect(r.shown).not.toContain("p1");
  });

  it("Summe aus sichtbar und versteckt bleibt vollständig", () => {
    for (const anzahl of [1, 3, 8, 15, 40])
      for (const zeilen of [1, 3, 7, 12]) {
        const r = fitRows(positionen(anzahl), platzFuer(zeilen));
        expect(r.shown.length + r.hidden).toBe(anzahl);
      }
  });

  it("winziger Platz zeigt trotzdem eine Zeile", () => {
    const r = fitRows(positionen(5), 10);
    expect(r.shown).toHaveLength(1);
    expect(r.hidden).toBe(4);
  });

  it("Höhe 0 kippt nicht (Messung vor dem Layout)", () => {
    const r = fitRows(positionen(3), 0);
    expect(r.shown).toHaveLength(1);
    expect(r.hidden).toBe(2);
  });

  it("negative Höhe kippt auch nicht", () => {
    expect(() => fitRows(positionen(3), -50)).not.toThrow();
    expect(fitRows(positionen(3), -50).shown).toHaveLength(1);
  });

  it("eine einzelne Position passt immer", () => {
    expect(fitRows(positionen(1), platzFuer(1))).toEqual({
      shown: ["p1"],
      hidden: 0,
    });
  });

  it("nimmt die Zeilenhöhe aus der CSS, nicht aus einer Kopie", () => {
    // Doppelt gepflegte Werte laufen auseinander - deshalb reicht die
    // Komponente die gemessene Höhe durch.
    // 600 px Platz: bei 60 px Zeilen passen zehn, bei 30 px zwanzig.
    expect(fitRows(positionen(10), 600, 60).hidden).toBe(0);
    expect(fitRows(positionen(11), 600, 60).shown).toHaveLength(9);
    expect(fitRows(positionen(15), 600, 30).hidden).toBe(0);
  });

  it("unsinnige Zeilenhöhe fällt auf den Standard zurück", () => {
    const standard = fitRows(positionen(20), 480);
    expect(fitRows(positionen(20), 480, 0)).toEqual(standard);
    expect(fitRows(positionen(20), 480, -12)).toEqual(standard);
    expect(fitRows(positionen(20), 480, Number.NaN)).toEqual(standard);
  });
});
