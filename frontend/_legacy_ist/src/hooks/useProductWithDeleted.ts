import { useEffect, useState } from 'react';
import { api } from '../assets/constants';
import { Item } from '../context/ProductContext';

export function useProductWithDeleted() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${api}/stock-items/all`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then((data) => {
        setItems(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || 'Fehler beim Laden der Artikel');
      })
      .finally(() => setLoading(false));
  }, []);

  return { items, loading, error };
}
