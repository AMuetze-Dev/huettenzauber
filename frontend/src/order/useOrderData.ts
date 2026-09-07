import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { Category, EventDto, StockItem } from "../api/types";

interface OrderData {
  loading: boolean;
  error: string | null;
  event: EventDto | null;
  categories: Category[];
  items: StockItem[];
  favorites: StockItem[];
  reload: () => void;
}

export function useOrderData(): OrderData {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<EventDto | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [favorites, setFavorites] = useState<StockItem[]>([]);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      const ev = await api.activeEvent();
      if (!alive) return;
      setEvent(ev);
      if (!ev) {
        setCategories([]);
        setItems([]);
        setFavorites([]);
        return;
      }
      const [cats, its, favs] = await Promise.all([
        api.categories(ev.catalog_id),
        api.stockItems(ev.catalog_id),
        api.favorites(ev.catalog_id),
      ]);
      if (!alive) return;
      setCategories(cats);
      setItems(its);
      setFavorites(favs);
    })()
      .catch((e) => {
        if (!alive) return;
        // Sichtbar machen statt schlucken - am Ausschank merkt sonst niemand,
        // dass der Katalog gar nicht geladen wurde.
        setError(
          e instanceof ApiError && e.isOffline
            ? "Kasse nicht erreichbar."
            : e instanceof ApiError
              ? e.detail
              : "Katalog konnte nicht geladen werden.",
        );
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tick]);

  return { loading, error, event, categories, items, favorites, reload };
}
