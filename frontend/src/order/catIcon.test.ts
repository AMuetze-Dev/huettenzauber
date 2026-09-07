import { describe, expect, it } from "vitest";
import { CATEGORY_ICONS, catIcon, iconKeyFor } from "./catIcon";

describe("Kategorie-Symbole", () => {
  it("die Auswahl hat eindeutige Schlüssel", () => {
    const keys = CATEGORY_ICONS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("jede Auswahl hat eine deutsche Beschriftung", () => {
    for (const c of CATEGORY_ICONS) expect(c.label.trim()).not.toBe("");
  });

  it("ein gewähltes Symbol gewinnt gegen den Namen", () => {
    // "Bier" wuerde sonst zum Bierkrug geraten.
    expect(iconKeyFor({ name: "Bier", icon: "pizza" })).toBe("pizza");
  });

  it("ohne Auswahl wird aus dem Namen geraten (Alt-Bestand)", () => {
    expect(iconKeyFor({ name: "Warme Getränke" })).toBe("coffee");
    expect(iconKeyFor({ name: "Federweißer" })).toBe("wine");
    expect(iconKeyFor({ name: "Alkoholfrei" })).toBe("water");
  });

  it("Umschreibungen ohne Umlaut werden auch erkannt", () => {
    expect(iconKeyFor({ name: "Kueche" })).toBe("food");
    expect(iconKeyFor({ name: "Suesses" })).toBe("sweets");
    expect(iconKeyFor({ name: "Kaesespaetzle" })).toBe("food");
  });

  it("unbekanntes Symbol fällt auf die Namensregel zurück", () => {
    expect(iconKeyFor({ name: "Küche", icon: "MdCategory" })).toBe("food");
  });

  it("völlig unbekannt endet bei 'Sonstiges' statt undefined", () => {
    expect(iconKeyFor({ name: "Zwirbelkram" })).toBe("other");
  });

  it("catIcon liefert immer eine Komponente", () => {
    expect(typeof catIcon({ name: "Zwirbelkram" })).toBe("object");
    expect(catIcon({ name: "Bier" })).toBe(
      CATEGORY_ICONS.find((c) => c.key === "beer")!.Icon,
    );
  });

  it("Groß-/Kleinschreibung ist egal", () => {
    expect(iconKeyFor({ name: "PILS" })).toBe("beer");
  });
});
