/**
 * Lokaler, optimistischer Warenkorb des Bedienterminals (10").
 * Wahrheit liegt im Backend (active_order + SSE) - dieser Reducer sorgt nur
 * fuer sofortiges Feedback beim Tippen. Referenzlogik: die `Component`-Klasse
 * im Designer-Mockup (design/mockup-pos.dc.html).
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

export interface DepositReturn {
  unitAmount: number;
  quantity: number;
}

export interface CartState {
  lines: CartLine[];
  lastVariantId: number | null;
  depositReturn: DepositReturn | null;
}

export type CartAction =
  | { type: "bump"; line: Omit<CartLine, "qty">; step: number }
  | { type: "setQty"; variantId: number; qty: number }
  | { type: "remove"; variantId: number }
  | { type: "clear" }
  | { type: "setDepositReturn"; unitAmount: number; quantity: number }
  | { type: "syncLines"; lines: { variantId: number; qty: number }[] };

export const emptyCart: CartState = {
  lines: [],
  lastVariantId: null,
  depositReturn: null,
};

function withLines(state: CartState, lines: CartLine[], last?: number | null): CartState {
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

    case "setQty": {
      const lines = state.lines.map((l) =>
        l.variantId === action.variantId ? { ...l, qty: Math.max(0, action.qty) } : l,
      );
      return withLines(state, lines);
    }

    case "remove":
      return withLines(
        state,
        state.lines.filter((l) => l.variantId !== action.variantId),
      );

    case "clear":
      return { ...emptyCart };

    case "setDepositReturn": {
      const { unitAmount, quantity } = action;
      return {
        ...state,
        depositReturn:
          unitAmount <= 0 || quantity <= 0 ? null : { unitAmount, quantity },
      };
    }

    case "syncLines": {
      const known = new Map(state.lines.map((l) => [l.variantId, l]));
      const lines: CartLine[] = [];
      for (const s of action.lines) {
        const base = known.get(s.variantId);
        if (base) lines.push({ ...base, qty: s.qty });
      }
      return withLines(state, lines);
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
  const depositReturn = state.depositReturn
    ? state.depositReturn.unitAmount * state.depositReturn.quantity
    : 0;
  return {
    gross,
    deposit,
    depositReturn,
    due: Math.max(0, gross + deposit - depositReturn),
    count: state.lines.reduce((a, l) => a + l.qty, 0),
  };
}
