import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Category, EventDto, StockItem } from "../api/types";

interface OrderData {
  loading: boolean;
  event: EventDto | null;
  categories: Category[];
  items: StockItem[];
  reload: () => void;
}

export function useOrderData(): OrderData {
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<EventDto | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const ev = await api.activeEvent();
      if (!alive) return;
      setEvent(ev);
      if (!ev) {
        setCategories([]);
        setItems([]);
        return;
      }
      const [cats, its] = await Promise.all([
        api.categories(ev.catalog_id),
        api.stockItems(ev.catalog_id),
      ]);
      if (!alive) return;
      setCategories(cats);
      setItems(its);
    })()
      .catch(() => undefined)
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tick]);

  return { loading, event, categories, items, reload };
}
