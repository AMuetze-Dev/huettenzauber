// Backend liefert Geld als String ("4.50"). Anzeige in de-DE-Euro.
const fmt = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

export function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function euro(value: string | number | null | undefined): string {
  return fmt.format(toNumber(value));
}

/**
 * Kurzform fuer Geldknoepfe: glatte Betraege ohne ",00", Cent-Betraege
 * unter einem Euro als "50 ct". Nur fuer Beschriftungen - Summen und
 * Rueckgeld bleiben bei `euro()`, da zaehlt jeder Cent sichtbar.
 */
export function euroShort(value: number): string {
  if (value > 0 && value < 1) return `${Math.round(value * 100)} ct`;
  return Number.isInteger(value)
    ? `${value} €`
    : euro(value);
}

export function qtyLabel(value: string | number): string {
  const n = toNumber(value);
  return Number.isInteger(n)
    ? String(n)
    : n.toLocaleString("de-DE", { maximumFractionDigits: 3 });
}
