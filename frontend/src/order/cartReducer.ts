/**
 * Warenkorb des Bedienterminals (10").
 *
 * Wahrheit liegt im Backend (`active_order` + SSE). Lokal wird nur sofort
 * mitgezeichnet, damit ein Tipp nicht auf die Antwort warten muss.
 *
 * Der Server nummeriert jeden Stand (`revision`). Angewandt wird nur ein
 * Stand, der neuer ist als der zuletzt gesehene - damit
 *  - sich ueberholende Antworten keine Position verschlucken,
 *  - ein zweiter Eingabepunkt (Handy im Hotspot) hier von selbst auftaucht,
 *  - und der eigene, noch nicht bestaetigte Tipp nicht kurz wegblinkt.
 */

export interface CartLine {
  variantId: number;
  stockItemId: number;
  itemName: string;
  variantLabel: string;
  unitPrice: number;
  deposit: number; // Pfand pro Stueck
  qty: number;
}

/** Eine Pfandsorte im Vorgang: 3 Weingläser à 2,00 €. */
export interface DepositReturn {
  unitAmount: number;
  quantity: number;
}

/** Metadaten zu einer Variante - kommt aus dem geladenen Katalog. */
export type LineLookup = (variantId: number) => Omit<CartLine, "qty"> | null;

export interface CartState {
  lines: CartLine[];
  lastVariantId: number | null;
  /** Je Pfandbetrag eine Zeile - gemischtes Leergut in einem Vorgang. */
  depositReturns: DepositReturn[];
  /** Zuletzt uebernommener Serverstand. */
  revision: number;
}

export type CartAction =
  | { type: "bump"; line: Omit<CartLine, "qty">; step: number }
  | { type: "bumpFailed"; variantId: number; step: number }
  | { type: "setQty"; variantId: number; qty: number }
  | { type: "remove"; variantId: number }
  | { type: "clear" }
  | { type: "setDepositReturn"; unitAmount: number; quantity: number }
  | { type: "clearDepositReturns" }
  /** Katalog kam später als der erste Serverstand - Namen/Preise nachziehen. */
  | { type: "relabel"; lookup: LineLookup }
  | {
      type: "serverSnapshot";
      revision: number;
      lines: { variantId: number; qty: number }[];
      depositReturns: DepositReturn[];
      lookup: LineLookup;
    };

export const emptyCart: CartState = {
  lines: [],
  lastVariantId: null,
  depositReturns: [],
  revision: -1,
};

/** Auf ganze Cent runden, damit 2,00 und 2,001 dieselbe Sorte sind. */
function cents(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Position, deren Artikel der Client (noch) nicht kennt - lieber sichtbar
 *  falsch benannt als unsichtbar. */
function placeholder(variantId: number): Omit<CartLine, "qty"> {
  return {
    variantId,
    stockItemId: 0,
    itemName: `Artikel #${variantId}`,
    variantLabel: "",
    unitPrice: 0,
    deposit: 0,
  };
}

function withLines(
  state: CartState,
  lines: CartLine[],
  last?: number | null,
): CartState {
  return {
    ...state,
    lines: lines.filter((l) => l.qty > 0),
    lastVariantId: last === undefined ? state.lastVariantId : last,
  };
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "bump": {
      const { line, step } = action;
      const existing = state.lines.find((l) => l.variantId === line.variantId);
      let lines: CartLine[];
      if (existing) {
        lines = state.lines.map((l) =>
          l.variantId === line.variantId ? { ...l, qty: l.qty + step } : l,
        );
      } else if (step > 0) {
        lines = [...state.lines, { ...line, qty: step }];
      } else {
        return state;
      }
      return withLines(state, lines, step > 0 ? line.variantId : state.lastVariantId);
    }

    case "bumpFailed":
      return withLines(
        state,
        state.lines.map((l) =>
          l.variantId === action.variantId ? { ...l, qty: l.qty - action.step } : l,
        ),
      );

    case "setQty":
      return withLines(
        state,
        state.lines.map((l) =>
          l.variantId === action.variantId
            ? { ...l, qty: Math.max(0, action.qty) }
            : l,
        ),
      );

    case "remove":
      return withLines(
        state,
        state.lines.filter((l) => l.variantId !== action.variantId),
      );

    case "clear":
      return { ...emptyCart, revision: state.revision };

    case "setDepositReturn": {
      const unitAmount = cents(action.unitAmount);
      const quantity = action.quantity;
      const rest = state.depositReturns.filter((d) => d.unitAmount !== unitAmount);
      return {
        ...state,
        depositReturns:
          unitAmount <= 0 || quantity <= 0
            ? rest
            : [...rest, { unitAmount, quantity }].sort(
                (a, b) => a.unitAmount - b.unitAmount,
              ),
      };
    }

    case "clearDepositReturns":
      return { ...state, depositReturns: [] };

    case "relabel": {
      // Beim Start kann der Serverstand vor dem Katalog eintreffen; die
      // Positionen stehen dann als Platzhalter zu 0,00 € da.
      let changed = false;
      const lines = state.lines.map((l) => {
        const meta = action.lookup(l.variantId);
        if (!meta || meta.unitPrice === l.unitPrice) return l;
        changed = true;
        return { ...meta, qty: l.qty };
      });
      return changed ? { ...state, lines } : state;
    }

    case "serverSnapshot": {
      // Ueberholte oder doppelte Nachricht: verwerfen.
      if (action.revision <= state.revision) return state;
      const known = new Map(state.lines.map((l) => [l.variantId, l]));
      const lines = action.lines.map((s) => {
        const meta =
          action.lookup(s.variantId) ??
          known.get(s.variantId) ??
          placeholder(s.variantId);
        return { ...meta, variantId: s.variantId, qty: s.qty };
      });
      return withLines(
        {
          ...state,
          revision: action.revision,
          depositReturns: action.depositReturns,
        },
        lines,
      );
    }

    default:
      return state;
  }
}

export interface CartTotals {
  gross: number;
  deposit: number;
  depositReturn: number;
  due: number;
  count: number;
}

export function cartTotals(state: CartState): CartTotals {
  const gross = state.lines.reduce((a, l) => a + l.unitPrice * l.qty, 0);
  const deposit = state.lines.reduce((a, l) => a + l.deposit * l.qty, 0);
  const depositReturn = state.depositReturns.reduce(
    (a, d) => a + d.unitAmount * d.quantity,
    0,
  );
  return {
    gross,
    deposit,
    depositReturn,
    due: Math.max(0, gross + deposit - depositReturn),
    count: state.lines.reduce((a, l) => a + l.qty, 0),
  };
}
