import type { StockItem } from "../api/types";
import { toNumber } from "../lib/money";

/** Eine im Katalog vorkommende Pfandhöhe samt der Artikel, die sie tragen. */
export interface DepositKind {
  unitAmount: number;
  /** Was der Gast zurückbringt - "Bierglas", "Weinglas · Tasse". */
  label: string;
  itemNames: string[];
}

const MAX_NAMES = 2;

/**
 * Zieht die Pfandsorten aus dem geladenen Katalog. Der Bediener soll beim
 * Zurücknehmen nicht den Betrag suchen müssen, sondern das Gefäß antippen.
 */
export function depositKinds(items: StockItem[]): DepositKind[] {
  const byAmount = new Map<number, string[]>();
  for (const item of items) {
    if (!item.is_active) continue;
    const amount = Math.round(toNumber(item.deposit_amount) * 100) / 100;
    if (amount <= 0) continue;
    const names = byAmount.get(amount) ?? [];
    if (!names.includes(item.name)) names.push(item.name);
    byAmount.set(amount, names);
  }

  return [...byAmount.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([unitAmount, itemNames]) => ({
      unitAmount,
      itemNames,
      label:
        itemNames.length > MAX_NAMES
          ? `${itemNames.slice(0, MAX_NAMES).join(" · ")} …`
          : itemNames.join(" · "),
    }));
}
