import { describe, expect, it } from "vitest";
import type { StockItem } from "../api/types";
import { depositKinds } from "./deposits";

function item(name: string, deposit: string, over: Partial<StockItem> = {}): StockItem {
  return {
    id: Math.random(),
    catalog_id: 1,
    category_id: null,
    name,
    deposit_amount: deposit,
    is_active: true,
    sort_order: 0,
    is_favorite: false,
    color: null,
    variants: [],
    ...over,
  };
}

describe("depositKinds", () => {
  it("leerer Katalog ergibt keine Sorten", () => {
    expect(depositKinds([])).toEqual([]);
  });

  it("Artikel ohne Pfand tauchen nicht auf", () => {
    expect(depositKinds([item("Pommes", "0")])).toEqual([]);
  });

  it("eine Pfandhöhe mit ihrem Artikelnamen", () => {
    const [k] = depositKinds([item("Bierglas", "1.50")]);
    expect(k).toMatchObject({ unitAmount: 1.5, label: "Bierglas" });
  });

  it("fasst Artikel gleicher Pfandhöhe zu einer Sorte zusammen", () => {
    const kinds = depositKinds([item("Weinglas", "2.00"), item("Tasse", "2.00")]);
    expect(kinds).toHaveLength(1);
    expect(kinds[0].label).toBe("Weinglas · Tasse");
  });

  it("kürzt lange Aufzählungen ab", () => {
    const kinds = depositKinds([
      item("A", "2.00"),
      item("B", "2.00"),
      item("C", "2.00"),
    ]);
    expect(kinds[0].label).toBe("A · B …");
    expect(kinds[0].itemNames).toEqual(["A", "B", "C"]);
  });

  it("trennt verschiedene Pfandhöhen", () => {
    const kinds = depositKinds([item("Bierglas", "1.50"), item("Weinglas", "2.00")]);
    expect(kinds.map((k) => k.unitAmount)).toEqual([1.5, 2]);
  });

  it("sortiert aufsteigend nach Betrag", () => {
    const kinds = depositKinds([
      item("Teuer", "5.00"),
      item("Billig", "0.50"),
      item("Mittel", "2.00"),
    ]);
    expect(kinds.map((k) => k.unitAmount)).toEqual([0.5, 2, 5]);
  });

  it("deaktivierte Artikel zählen nicht mit", () => {
    const kinds = depositKinds([item("Altglas", "3.00", { is_active: false })]);
    expect(kinds).toEqual([]);
  });

  it("Rundungsreste ergeben keine Geistersorte", () => {
    const kinds = depositKinds([item("A", "2.001"), item("B", "2.00")]);
    expect(kinds).toHaveLength(1);
    expect(kinds[0].itemNames).toEqual(["A", "B"]);
  });

  it("derselbe Artikelname erscheint nur einmal", () => {
    const kinds = depositKinds([item("Tasse", "2.00"), item("Tasse", "2.00")]);
    expect(kinds[0].itemNames).toEqual(["Tasse"]);
  });

  it("negatives Pfand wird ignoriert (Datenmüll)", () => {
    expect(depositKinds([item("Kaputt", "-1.00")])).toEqual([]);
  });
});
