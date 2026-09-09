import { describe, expect, it } from "vitest";
import { changeSuggestions, cents, COINS, DENOMINATIONS, NOTES } from "./change";

describe("cents", () => {
  it("rundet auf ganze Cent", () => {
    expect(cents(0.1 + 0.2)).toBe(0.3);
  });

  it("hält beim Aufaddieren stabil", () => {
    let n = 0;
    for (let i = 0; i < 10; i++) n = cents(n + 0.5);
    expect(n).toBe(5);
  });
});

describe("Stückelung", () => {
  it("Scheine und Münzen sind getrennt", () => {
    expect([...NOTES]).toEqual([50, 20, 10, 5]);
    expect([...COINS]).toEqual([2, 1, 0.5]);
  });

  it("keine Überschneidung zwischen Scheinen und Münzen", () => {
    expect(NOTES.some((n) => (COINS as readonly number[]).includes(n))).toBe(false);
  });

  it("jeder Schein ist mindestens 5 €, jede Münze höchstens 2 €", () => {
    expect(Math.min(...NOTES)).toBe(5);
    expect(Math.max(...COINS)).toBe(2);
  });

  it("enthält die Scheine und Münzen vom Tresen", () => {
    expect([...DENOMINATIONS]).toEqual([50, 20, 10, 5, 2, 1, 0.5]);
  });

  it("ist absteigend sortiert – der größte Schein zuerst", () => {
    const arr = [...DENOMINATIONS];
    expect(arr).toEqual([...arr].sort((a, b) => b - a));
  });

  it("jede Stückelung lässt sich zu jedem Cent-Betrag kombinieren", () => {
    // 0,50 als kleinste Einheit: ungerade Cent-Beträge kommen über die freie
    // Eingabe, nicht über die Knöpfe.
    expect(Math.min(...DENOMINATIONS)).toBe(0.5);
  });
});

describe("changeSuggestions", () => {
  it("krummer Betrag: nächste Fünfer- und Zehnerstufe", () => {
    // Genau der Fall aus dem Betrieb: 40,30 € -> Gast gibt 45 oder 50
    expect(changeSuggestions(40.3)).toEqual([45, 50]);
  });

  it("kleiner Betrag bekommt zwei Vorschläge statt einem", () => {
    // Fünfer- und Zehnerstufe fallen auf 10 zusammen -> zweiter kommt aus
    // "fünf Euro mehr", damit nicht nur ein einziger Knopf dasteht.
    expect(changeSuggestions(8)).toEqual([10, 15]);
  });

  it("runder Betrag schlägt nicht sich selbst vor", () => {
    const s = changeSuggestions(20);
    expect(s).not.toContain(20);
    expect(s[0]).toBeGreaterThan(20);
  });

  it("runder Betrag: 25 und 30", () => {
    expect(changeSuggestions(20)).toEqual([25, 30]);
  });

  it("kein 100-Euro-Schein für eine Bratwurst", () => {
    expect(changeSuggestions(5.5)).not.toContain(100);
  });

  it("kein 100-Euro-Schein bei knapp 47 € – 50 und 55 sind realistisch", () => {
    expect(changeSuggestions(46.7)).toEqual([50, 55]);
  });

  it("über 50 € wird nicht der 100er vorgeschlagen", () => {
    expect(changeSuggestions(52.8)).toEqual([55, 60]);
    expect(changeSuggestions(61)).toEqual([65, 70]);
  });

  it("nie mehr als rund 20 € Rückgeld im Vorschlag", () => {
    for (const due of [3, 8, 12.4, 22, 46.7, 52.8, 99])
      for (const v of changeSuggestions(due)) expect(v - due).toBeLessThanOrEqual(20);
  });

  it("genau zwei Vorschläge, damit die Zeile ruhig bleibt", () => {
    for (const due of [1, 7.35, 12.5, 33.99, 46.7, 88, 140.2])
      expect(changeSuggestions(due)).toHaveLength(2);
  });



  it("Vorschläge sind immer echt größer als der fällige Betrag", () => {
    for (const due of [0.5, 4.99, 5, 10, 19.99, 40.3, 61])
      for (const v of changeSuggestions(due)) expect(v).toBeGreaterThan(due);
  });

  it("Vorschläge sind aufsteigend und ohne Dubletten", () => {
    for (const due of [3.2, 8, 15.75, 49.9]) {
      const s = changeSuggestions(due);
      expect(s).toEqual([...s].sort((a, b) => a - b));
      expect(new Set(s).size).toBe(s.length);
    }
  });

  it("bei 0 gibt es nichts vorzuschlagen", () => {
    expect(changeSuggestions(0)).toEqual([]);
    expect(changeSuggestions(-5)).toEqual([]);
  });

  it("Cent-Reste kippen die Rundung nicht", () => {
    expect(changeSuggestions(9.99)).toEqual([10, 15]);
    expect(changeSuggestions(10.01)).toContain(15);
  });

  it("großer Betrag bleibt bedienbar", () => {
    expect(changeSuggestions(140.2)).toEqual([145, 150]);
  });
});
