// Spiegelt die v2-Backend-Schemas (backend/schemas.py). Geld/Mengen kommen als String.

export interface Catalog {
  id: number;
  name: string;
  created_at: string;
}

export interface Category {
  id: number;
  catalog_id: number;
  name: string;
  icon: string;
  sort_order: number;
}

export interface Variant {
  id: number;
  stock_item_id: number;
  name: string | null;
  price: string;
  bill_steps: string;
  is_active: boolean;
}

export interface StockItem {
  id: number;
  catalog_id: number;
  category_id: number | null;
  name: string;
  deposit_amount: string;
  is_active: boolean;
  sort_order: number;
  is_favorite: boolean;
  color: string | null;
  variants: Variant[];
}

export interface EventDto {
  id: number;
  catalog_id: number;
  name: string;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
}

export interface ActiveLine {
  item_variant_id: number;
  quantity: string;
}

/** Eine Pfandsorte im laufenden Vorgang (3× à 2,00 €). */
export interface DepositReturnLine {
  unit_amount: string;
  quantity: number;
  total_amount: string;
}

export interface ActiveOrder {
  event_id: number;
  updated_at: string;
  /** Steigt bei jeder Änderung. Ältere Antworten dürfen neuere nicht überholen. */
  revision: number;
  lines: ActiveLine[];
  deposit_returns: DepositReturnLine[];
  total_gross: string;
  total_deposit: string;
  deposit_return_total: string;
  total_due: string;
}

export interface BillItem {
  item_variant_id: number | null;
  item_name: string;
  variant_name: string | null;
  unit_price: string;
  deposit_per_unit: string;
  quantity: string;
}

export interface Bill {
  id: number;
  event_id: number;
  created_at: string;
  business_day: string;
  is_deleted: boolean;
  total_gross: string;
  total_deposit: string;
  deposit_return_total: string;
  items: BillItem[];
}

export interface BillListRow {
  id: number;
  created_at: string;
  business_day: string;
  is_deleted: boolean;
  total_gross: string;
  total_deposit: string;
  deposit_return_total: string;
  position_count: number;
}

export interface DaySummary {
  event_id: number;
  business_day: string;
  bill_count: number;
  total_gross: string;
  total_deposit: string;
  deposit_return_total: string;
  net_total: string;
  closed: boolean;
}

export interface ConsumptionRow {
  item_name: string;
  variant_name: string | null;
  quantity: string;
  revenue: string;
}
export interface DayBreakdown {
  business_day: string;
  bill_count: number;
  total_gross: string;
  total_deposit: string;
  deposit_return_total: string;
  net_total: string;
}
export interface DepositReturnRow {
  id: number;
  event_id: number;
  bill_id: number | null;
  created_at: string;
  business_day: string;
  unit_amount: string;
  quantity: number;
  total_amount: string;
}

/** Was an einem Betriebstag über die Theke ging.
 *
 * Bewusst ohne Kassenbestand, Wechselgeld und Bargeldbewegungen: die waren im
 * Betrieb nie zuverlässig erfasst (siehe D41 in ARCHITEKTUR.md).
 */
export interface CashCount {
  event_id: number;
  event_name: string;
  business_day: string;
  bill_count: number;
  total_gross: string;
  total_deposit: string;
  deposit_return_in_bills: string;
  standalone_deposit_return: string;
  /** Bons abzüglich einzeln ausgezahltem Pfand. */
  cash_income: string;
  closed: boolean;
  closed_at: string | null;
}

export interface DayClose {
  event_id: number;
  business_day: string;
  closed_at: string;
  total_gross: string;
  total_deposit: string;
}

export interface Health {
  status: string;
  database: string;
  access_code_required: boolean;
}

export interface Statistics {
  event_id: number;
  event_name: string;
  scope: string;
  bill_count: number;
  total_gross: string;
  total_deposit: string;
  deposit_return_total: string;
  net_total: string;
  consumption: ConsumptionRow[];
  days: DayBreakdown[];
}
