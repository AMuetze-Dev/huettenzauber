import type {
  ActiveOrder,
  Bill,
  BillListRow,
  Catalog,
  Category,
  DaySummary,
  EventDto,
  Statistics,
  StockItem,
} from "./types";

const BASE = "/api";

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
  variants: VariantInput[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail);
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.text();
  const data = body ? JSON.parse(body) : undefined;
  if (!res.ok) {
    throw new ApiError(res.status, data?.detail ?? res.statusText);
  }
  return data as T;
}

export const api = {
  // Veranstaltung
  activeEvent: () =>
    fetch(BASE + "/events/active").then(async (r) =>
      r.status === 204 ? null : ((await r.json()) as EventDto),
    ),
  events: () => req<EventDto[]>("/events"),
  event: (id: number) => req<EventDto>(`/events/${id}`),
  createEvent: (catalog_id: number, name: string) =>
    req<EventDto>("/events", {
      method: "POST",
      body: JSON.stringify({ catalog_id, name }),
    }),
  updateEvent: (id: number, name: string) =>
    req<EventDto>(`/events/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    }),
  activateEvent: (id: number) =>
    req<EventDto>(`/events/${id}/activate`, { method: "POST" }),
  archiveEvent: (id: number) =>
    req<EventDto>(`/events/${id}/archive`, { method: "POST" }),
  deleteEvent: (id: number) =>
    req<void>(`/events/${id}`, { method: "DELETE" }),

  // Katalog
  catalogs: () => req<Catalog[]>("/catalogs"),
  createCatalog: (name: string) =>
    req<Catalog>("/catalogs", { method: "POST", body: JSON.stringify({ name }) }),
  updateCatalog: (id: number, name: string) =>
    req<Catalog>(`/catalogs/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    }),
  deleteCatalog: (id: number) =>
    req<void>(`/catalogs/${id}`, { method: "DELETE" }),

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
    req<Category>(`/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteCategory: (id: number) =>
    req<void>(`/categories/${id}`, { method: "DELETE" }),
  reorderCategories: (catalogId: number, ordered_ids: number[]) =>
    req<Category[]>(`/catalogs/${catalogId}/categories/order`, {
      method: "PUT",
      body: JSON.stringify({ ordered_ids }),
    }),

  stockItems: (catalogId: number, includeInactive = false) =>
    req<StockItem[]>(
      `/catalogs/${catalogId}/stock-items${includeInactive ? "?include_inactive=true" : ""}`,
    ),
  stockItem: (id: number) => req<StockItem>(`/stock-items/${id}`),
  addStockItem: (catalogId: number, body: StockItemInput) =>
    req<StockItem>(`/catalogs/${catalogId}/stock-items`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateStockItem: (id: number, body: StockItemInput) =>
    req<StockItem>(`/stock-items/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteStockItem: (id: number) =>
    req<void>(`/stock-items/${id}`, { method: "DELETE" }),
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
  setDepositReturn: (unit_amount: number | string, quantity: number) =>
    req<ActiveOrder>("/active-order/deposit-return", {
      method: "PUT",
      body: JSON.stringify({ unit_amount: String(unit_amount), quantity }),
    }),

  // Bon
  createBill: () => req<Bill>("/bills", { method: "POST" }),
  bills: (opts?: { day?: string; includeDeleted?: boolean }) => {
    const q = new URLSearchParams();
    if (opts?.day) q.set("day", opts.day);
    if (opts?.includeDeleted) q.set("include_deleted", "true");
    const s = q.toString();
    return req<BillListRow[]>(`/bills${s ? `?${s}` : ""}`);
  },
  bill: (id: number) => req<Bill>(`/bills/${id}`),
  voidBill: (id: number) => req<Bill>(`/bills/${id}/void`, { method: "POST" }),
  restoreBill: (id: number) =>
    req<Bill>(`/bills/${id}/restore`, { method: "POST" }),

  // Tagesabschluss
  daySummary: (day?: string) =>
    req<DaySummary>(`/day-summary${day ? `?day=${day}` : ""}`),
  closeDay: (day?: string) =>
    req<DaySummary>(`/day-close${day ? `?day=${day}` : ""}`, { method: "POST" }),

  // Statistik
  statistics: (day?: string) =>
    req<Statistics>(`/statistics${day ? `?day=${day}` : ""}`),
};
