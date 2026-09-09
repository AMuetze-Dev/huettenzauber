import { describe, expect, it } from "vitest";
import { euro, euroShort, qtyLabel, toNumber } from "./money";

describe("toNumber", () => {
  it.each([
    [null, 0],
    [undefined, 0],
    ["", 0],
    ["abc", 0],
    ["NaN", 0],
    ["4.50", 4.5],
    ["13.50000", 13.5],
    [4.5, 4.5],
    ["-2.5", -2.5],
    ["1e3", 1000],
    ["0", 0],
  ])("toNumber(%p) === %p", (input, expected) => {
    expect(toNumber(input as string)).toBe(expected);
  });
});

describe("euro", () => {
  it.each([
    ["0", "0,00 €"],
    ["4.5", "4,50 €"],
    ["13.50000", "13,50 €"],
    ["-3", "-3,00 €"],
    [1234.5, "1.234,50 €"],
    [null, "0,00 €"],
    ["kaputt", "0,00 €"],
  ])("euro(%p) === %p", (input, expected) => {
    // de-DE nutzt ein schmales geschütztes Leerzeichen vor dem Euro
    expect(euro(input as string).replace(/\s/g, " ")).toBe(
      expected.replace(/ /g, " "),
    );
  });
});

describe("toNumber – adversariale Eingaben", () => {
  it.each([
    ["  4.5  ", 4.5], // Whitespace wird von parseFloat getrimmt
    ["4,50", 4], // Komma ist kein Dezimaltrenner in parseFloat
    ["0x10", 0], // Hex-String -> parseFloat -> NaN -> 0
    ["1_000", 1], // Unterstriche -> parseFloat stoppt bei "_"
    ["  ", 0],
    ["-", 0],
    ["+5", 5],
    ["9999999999999.99", 9999999999999.99],
    ["  -2.5e1  ", -25],
  ])("toNumber(%p) === %p", (input, expected) => {
    expect(toNumber(input)).toBe(expected);
  });
});

describe("qtyLabel", () => {
  it.each([
    ["3.000", "3"],
    ["3", "3"],
    ["0.5", "0,5"],
    ["2.5", "2,5"],
    ["10", "10"],
    ["0.001", "0,001"],
  ])("qtyLabel(%p) === %p", (input, expected) => {
    expect(qtyLabel(input)).toBe(expected);
  });
});

describe("euroShort", () => {
  it("glatte Beträge ohne Nachkommastellen", () => {
    expect(euroShort(50)).toBe("50 €");
    expect(euroShort(1)).toBe("1 €");
  });

  it("Münzen unter einem Euro als Cent", () => {
    expect(euroShort(0.5)).toBe("50 ct");
    expect(euroShort(0.2)).toBe("20 ct");
  });

  it("krumme Beträge behalten ihre Cents", () => {
    expect(euroShort(46.7)).toBe(euro(46.7));
    expect(euroShort(2.5)).toBe(euro(2.5));
  });

  it("Null bleibt ein Euro-Betrag, keine 0 ct", () => {
    expect(euroShort(0)).toBe("0 €");
  });

  it("benutzt ein normales Leerzeichen – anders als euro()", () => {
    // euro() setzt ein geschütztes Leerzeichen; für aria-label und Tests
    // wäre das eine Stolperfalle.
    expect(euroShort(20)).not.toContain(" ");
  });
});
