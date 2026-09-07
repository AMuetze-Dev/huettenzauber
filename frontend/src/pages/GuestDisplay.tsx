import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import type { StockItem } from "../api/types";
import { euro, toNumber } from "../lib/money";
import { useActiveOrderStream } from "../order/useActiveOrderStream";
import styles from "./GuestDisplay.module.css";

interface VariantInfo {
  itemName: string;
  variantName: string | null;
  price: number;
}

const VISIBLE = 7;

export default function GuestDisplay() {
  const { order } = useActiveOrderStream();
  const [variantMap, setVariantMap] = useState<Map<number, VariantInfo>>(new Map());
  const loadedForEvent = useRef<number | null>(null);

  useEffect(() => {
    const eventId = order?.event_id ?? null;
    if (eventId == null || loadedForEvent.current === eventId) return;
    loadedForEvent.current = eventId;
    (async () => {
      const ev = await api.activeEvent();
      if (!ev) return;
      const items: StockItem[] = await api.stockItems(ev.catalog_id, true);
      const map = new Map<number, VariantInfo>();
      for (const it of items) {
        for (const v of it.variants) {
          map.set(v.id, {
            itemName: it.name,
            variantName: v.name,
            price: toNumber(v.price),
          });
        }
      }
      setVariantMap(map);
    })().catch(() => undefined);
  }, [order?.event_id]);

  const rows = useMemo(() => {
    if (!order) return [];
    return order.lines.map((l) => {
      const info = variantMap.get(l.item_variant_id);
      const qty = toNumber(l.quantity);
      const name =
        info && info.variantName && info.variantName !== info.itemName
          ? `${info.itemName} · ${info.variantName}`
          : (info?.itemName ?? `Artikel ${l.item_variant_id}`);
      return { id: l.item_variant_id, qty, name, sum: (info?.price ?? 0) * qty };
    });
  }, [order, variantMap]);

  const isEmpty = !order || rows.length === 0;

  return (
    <div className={`${styles.screen} no-select`}>
      <div className={styles.header}>
        <img src="/logo-zum-ross.svg" alt="Zum Roß" />
        <span className={styles.kicker}>Landgasthof Diesbar</span>
        <span className={`${styles.kicker} ${styles.right}`}>Ihre Bestellung</span>
      </div>

      {isEmpty ? (
        <div className={styles.welcome}>
          <h1>Willkommen</h1>
          <p>Ihre Bestellung erscheint hier, sobald sie aufgenommen wird.</p>
        </div>
      ) : (
        <div className={styles.body}>
          <div className={styles.lines}>
            {rows.slice(-VISIBLE).map((r) => (
              <div key={r.id} className={styles.line}>
                <span className={`${styles.q} tnum`}>{r.qty}×</span>
                <span className={styles.name}>{r.name}</span>
                <span className={`${styles.sum} tnum`}>{euro(r.sum)}</span>
              </div>
            ))}
            {rows.length > VISIBLE && (
              <span className={styles.more}>
                + {rows.length - VISIBLE} weitere Positionen
              </span>
            )}
          </div>

          <div className={styles.total}>
            <div className={styles.row}>
              <span>Artikel</span>
              <span className="tnum">{euro(order.total_gross)}</span>
            </div>
            {toNumber(order.total_deposit) > 0 && (
              <div className={styles.row}>
                <span>Pfand</span>
                <span className="tnum">{euro(order.total_deposit)}</span>
              </div>
            )}
            {toNumber(order.deposit_return_total) > 0 && (
              <div className={`${styles.row} ${styles.credit}`}>
                <span>Pfandrückgabe</span>
                <span className="tnum">− {euro(order.deposit_return_total)}</span>
              </div>
            )}
            <div className={styles.rule} />
            <span className={styles.grandLabel}>Gesamt</span>
            <span className={`${styles.grand} tnum`}>{euro(order.total_due)}</span>
            <span className={styles.foot}>
              {rows.reduce((a, r) => a + r.qty, 0)} Artikel · Barzahlung
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
