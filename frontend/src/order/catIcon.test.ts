import { describe, expect, it } from "vitest";
import { CATEGORY_ICONS, ICON_GROUPS, catIcon, iconKeyFor } from "./catIcon";

/** Schlüssel, die bereits in Katalogen stehen können - Umbenennen verliert
 *  bestehende Symbolzuordnungen. */
const VERGEBENE_SCHLUESSEL = [
  "beer",
  "wine",
  "champagne",
  "cheers",
  "coffee",
  "brandy",
  "martini",
  "water",
  "food",
  "burger",
  "pizza",
  "bread",
  "fish",
  "veggie",
  "sweets",
  "icecream",
  "popcorn",
  "winter",
  "special",
  "shop",
  "stand",
  "other",
];

describe("Kategorie-Symbole", () => {
  it("die Auswahl hat eindeutige Schlüssel", () => {
    const keys = CATEGORY_ICONS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("jede Auswahl hat eine deutsche Beschriftung", () => {
    for (const c of CATEGORY_ICONS) expect(c.label.trim()).not.toBe("");
  });

  it("bereits vergebene Schlüssel bleiben erhalten", () => {
    const keys = new Set(CATEGORY_ICONS.map((c) => c.key));
    for (const k of VERGEBENE_SCHLUESSEL) expect(keys).toContain(k);
  });

  it("jedes Symbol gehört zu einer bekannten Gruppe", () => {
    for (const c of CATEGORY_ICONS)
      expect(ICON_GROUPS).toContain(c.group as (typeof ICON_GROUPS)[number]);
  });

  it("keine Gruppe ist leer", () => {
    for (const g of ICON_GROUPS)
      expect(CATEGORY_ICONS.filter((c) => c.group === g).length).toBeGreaterThan(0);
  });

  it("die Auswahl deckt die üblichen Feste ab", () => {
    expect(CATEGORY_ICONS.length).toBeGreaterThanOrEqual(40);
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
    expect(iconKeyFor({ name: "Kaesespaetzle" })).toBe("cheese");
  });

  it("die Feste des Hauses treffen ihr Symbol", () => {
    expect(iconKeyFor({ name: "Glühweinmeile" })).toBe("mulled");
    expect(iconKeyFor({ name: "Federweißerfest" })).toBe("wine");
    expect(iconKeyFor({ name: "Männertag" })).toBe("crown");
    expect(iconKeyFor({ name: "Kinderpunsch" })).toBe("mulled");
  });

  it("Glühwein gewinnt gegen die allgemeine Warm-Regel", () => {
    // Sonst landet alles Warme beim Kaffeebecher.
    expect(iconKeyFor({ name: "Glühwein & Punsch" })).toBe("mulled");
  });

  it("weitere Klassiker vom Fest", () => {
    expect(iconKeyFor({ name: "Bratwurst" })).toBe("meat");
    expect(iconKeyFor({ name: "Gebrannte Mandeln" })).toBe("nut");
    expect(iconKeyFor({ name: "Backfisch" })).toBe("fish");
    expect(iconKeyFor({ name: "Pfand" })).toBe("coins");
    expect(iconKeyFor({ name: "Weihnachtsmarkt" })).toBe("tree");
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
