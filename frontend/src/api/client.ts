import type {
  ActiveOrder,
  Bill,
  BillListRow,
  CashCount,
  CashMovement,
  Catalog,
  Category,
  DaySummary,
  DepositReturnRow,
  EventDto,
  Health,
  Statistics,
  StockItem,
} from "./types";

const BASE = "/api";
const CODE_KEY = "hz_access_code";

export interface VariantInput {
  id?: number | null;
  name: string | null;
  price: string;
  bill_steps?: string;
}
export interface StockItemInput {
  name: string;
  category_id: number | null;
  deposit_amount: string;
  sort_order?: number;
  is_favorite?: boolean;
  color?: string | null;
  variants: VariantInput[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail);
  }
  /** true, wenn der Server nicht erreichbar war (kein HTTP-Status). */
  get isOffline() {
    return this.status === 0;
  }
}

// --- Zugangscode (nur noetig, wenn der Server ihn verlangt) ---
export function getAccessCode(): string {
  try {
    return localStorage.getItem(CODE_KEY) ?? "";
  } catch {
    return "";
  }
}
export function setAccessCode(code: string): void {
  try {
    if (code) localStorage.setItem(CODE_KEY, code);
    else localStorage.removeItem(CODE_KEY);
  } catch {
    /* Private-Mode: dann eben nur fuer diese Sitzung */
  }
}

// --- Verbindungs-Beobachter (fuer das Offline-Banner) ---
type Listener = (online: boolean) => void;
const listeners = new Set<Listener>();
let lastOnline = true;

export function onConnectionChange(fn: Listener): () => void {
  listeners.add(fn);
  fn(lastOnline);
  return () => listeners.delete(fn);
}

function markConnection(online: boolean) {
  if (online === lastOnline) return;
  lastOnline = online;
  listeners.forEach((l) => l(online));
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const code = getAccessCode();
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(code ? { "X-Access-Code": code } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    markConnection(false);
    throw new ApiError(0, "Server nicht erreichbar");
  }
  markConnection(true);

  if (res.status === 204) return undefined as T;
  const body = await res.text();
  let data: unknown;
  try {
    data = body ? JSON.parse(body) : undefined;
  } catch {
    data = undefined;
  }
  if (!res.ok) {
    const detail =
      (data as { detail?: unknown })?.detail ?? res.statusText ?? "Fehler";
    throw new ApiError(
      res.status,
      typeof detail === "string" ? detail : "Ungültige Eingabe",
    );
  }
  return data as T;
}

export const api = {
  // System
  health: () => req<Health>("/health"),
  accessCheck: (code: string) =>
    req<{ required: boolean; valid: boolean }>("/access-check", {
      headers: { "X-Access-Code": code },
    }),

  // Veranstaltung
  activeEvent: async (): Promise<EventDto | null> => {
    try {
      return await req<EventDto>("/events/active");
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },
  events: () => req<EventDto[]>("/events"),
  event: (id: number) => req<EventDto>(`/events/${id}`),
  createEvent: (catalog_id: number, name: string) =>
    req<EventDto>("/events", {
      method: "POST",
      body: JSON.stringify({ catalog_id, name }),
    }),
  updateEvent: (id: number, name: string) =>
    req<EventDto>(`/events/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
  activateEvent: (id: number) =>
    req<EventDto>(`/events/${id}/activate`, { method: "POST" }),
  archiveEvent: (id: number) =>
    req<EventDto>(`/events/${id}/archive`, { method: "POST" }),
  deleteEvent: (id: number) => req<void>(`/events/${id}`, { method: "DELETE" }),

  // Katalog
  catalogs: () => req<Catalog[]>("/catalogs"),
  createCatalog: (name: string) =>
    req<Catalog>("/catalogs", { method: "POST", body: JSON.stringify({ name }) }),
  updateCatalog: (id: number, name: string) =>
    req<Catalog>(`/catalogs/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
  deleteCatalog: (id: number) => req<void>(`/catalogs/${id}`, { method: "DELETE" }),
  duplicateCatalog: (id: number, name: string) =>
    req<Catalog>(`/catalogs/${id}/duplicate`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  categories: (catalogId: number) =>
    req<Category[]>(`/catalogs/${catalogId}/categories`),
  addCategory: (
    catalogId: number,
    body: { name: string; icon?: string; sort_order?: number },
  ) =>
    req<Category>(`/catalogs/${catalogId}/categories`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateCategory: (
    id: number,
    body: { name: string; icon: string; sort_order?: number },
  ) =>
    req<Category>(`/categories/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteCategory: (id: number) => req<void>(`/categories/${id}`, { method: "DELETE" }),
  reorderCategories: (catalogId: number, ordered_ids: number[]) =>
    req<Category[]>(`/catalogs/${catalogId}/categories/order`, {
      method: "PUT",
      body: JSON.stringify({ ordered_ids }),
    }),

  stockItems: (catalogId: number, includeInactive = false) =>
    req<StockItem[]>(
      `/catalogs/${catalogId}/stock-items${includeInactive ? "?include_inactive=true" : ""}`,
    ),
  favorites: (catalogId: number) =>
    req<StockItem[]>(`/catalogs/${catalogId}/favorites`),
  stockItem: (id: number) => req<StockItem>(`/stock-items/${id}`),
  addStockItem: (catalogId: number, body: StockItemInput) =>
    req<StockItem>(`/catalogs/${catalogId}/stock-items`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateStockItem: (id: number, body: StockItemInput) =>
    req<StockItem>(`/stock-items/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  setFavorite: (id: number, is_favorite: boolean) =>
    req<StockItem>(`/stock-items/${id}/favorite`, {
      method: "PUT",
      body: JSON.stringify({ is_favorite }),
    }),
  deleteStockItem: (id: number) => req<void>(`/stock-items/${id}`, { method: "DELETE" }),
  reorderStockItems: (catalogId: number, ordered_ids: number[]) =>
    req<StockItem[]>(`/catalogs/${catalogId}/stock-items/order`, {
      method: "PUT",
      body: JSON.stringify({ ordered_ids }),
    }),

  // Aktive Bestellung
  activeOrder: () => req<ActiveOrder>("/active-order"),
  lineDelta: (variant_id: number, delta: number | string) =>
    req<ActiveOrder>("/active-order/lines", {
      method: "POST",
      body: JSON.stringify({ variant_id, delta: String(delta) }),
    }),
  clearOrder: () => req<ActiveOrder>("/active-order", { method: "DELETE" }),
  /** Setzt die Stückzahl für EINEN Pfandbetrag; andere Sorten bleiben. */
  setDepositReturn: (unit_amount: number | string, quantity: number) =>
    req<ActiveOrder>("/active-order/deposit-return", {
      method: "PUT",
      body: JSON.stringify({ unit_amount: String(unit_amount), quantity }),
    }),
  clearDepositReturns: () =>
    req<ActiveOrder>("/active-order/deposit-return", { method: "DELETE" }),

  // Bon
  createBill: () => req<Bill>("/bills", { method: "POST" }),
  bills: (opts?: { day?: string; includeDeleted?: boolean }) => {
    const q = new URLSearchParams();
    if (opts?.day) q.set("day", opts.day);
    if (opts?.includeDeleted) q.set("include_deleted", "true");
    const t = q.toString();
    return req<BillListRow[]>(`/bills${t ? `?${t}` : ""}`);
  },
  bill: (id: number) => req<Bill>(`/bills/${id}`),
  voidBill: (id: number) => req<Bill>(`/bills/${id}/void`, { method: "POST" }),
  restoreBill: (id: number) => req<Bill>(`/bills/${id}/restore`, { method: "POST" }),

  // Pfandrückgabe (eigenständig)
  depositReturns: (opts?: { day?: string; standaloneOnly?: boolean }) => {
    const q = new URLSearchParams();
    if (opts?.day) q.set("day", opts.day);
    if (opts?.standaloneOnly) q.set("standalone_only", "true");
    const t = q.toString();
    return req<DepositReturnRow[]>(`/deposit-returns${t ? `?${t}` : ""}`);
  },
  createDepositReturn: (unit_amount: string, quantity: number) =>
    req<DepositReturnRow>("/deposit-returns", {
      method: "POST",
      body: JSON.stringify({ unit_amount, quantity }),
    }),
  deleteDepositReturn: (id: number) =>
    req<void>(`/deposit-returns/${id}`, { method: "DELETE" }),

  // Kassenschnitt
  daySummary: (day?: string) =>
    req<DaySummary>(`/day-summary${day ? `?day=${day}` : ""}`),
  cashCount: (day?: string) =>
    req<CashCount>(`/cash-count${day ? `?day=${day}` : ""}`),
  setCashFloat: (amount: string, day?: string) =>
    req<CashCount>(`/cash-float${day ? `?day=${day}` : ""}`, {
      method: "PUT",
      body: JSON.stringify({ amount }),
    }),
  cashMovements: (day?: string) =>
    req<CashMovement[]>(`/cash-movements${day ? `?day=${day}` : ""}`),
  addCashMovement: (amount: string, reason: string, day?: string) =>
    req<CashMovement>(`/cash-movements${day ? `?day=${day}` : ""}`, {
      method: "POST",
      body: JSON.stringify({ amount, reason }),
    }),
  deleteCashMovement: (id: number) =>
    req<void>(`/cash-movements/${id}`, { method: "DELETE" }),
  closeDay: (counted_cash?: string | null, day?: string) =>
    req<unknown>(`/day-close${day ? `?day=${day}` : ""}`, {
      method: "POST",
      body: JSON.stringify({ counted_cash: counted_cash ?? null }),
    }),

  // Statistik
  statistics: (day?: string) =>
    req<Statistics>(`/statistics${day ? `?day=${day}` : ""}`),
};
