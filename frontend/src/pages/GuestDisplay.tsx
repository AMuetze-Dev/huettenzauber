import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import type { StockItem } from "../api/types";
import { euro, toNumber } from "../lib/money";
import { useActiveOrderStream } from "../order/useActiveOrderStream";
import { fitRows, FALLBACK_LINE_HEIGHT } from "./guestRows";
import styles from "./GuestDisplay.module.css";

interface VariantInfo {
  itemName: string;
  variantName: string | null;
  price: number;
}

/** Startwert, bis der ResizeObserver die echte Höhe gemeldet hat. */
const FALLBACK_HEIGHT = 7 * FALLBACK_LINE_HEIGHT;

/** Ruhebild: laeuft stundenlang auf dem 7"-Display, darf also nicht flimmern
 *  und keine feste Grafik einbrennen - deshalb nur die wandernde Uhrzeit. */
function Idle() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 20_000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className={styles.welcome}>
      <span className={`${styles.clock} tnum`}>
        {now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
      </span>
      <h1>Willkommen</h1>
      <p>Ihre Bestellung erscheint hier, sobald sie aufgenommen wird.</p>
    </div>
  );
}

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

  // Was sich gerade geändert hat, wird kurz hinterlegt - der Gast soll sehen,
  // was eben gebucht wurde, ohne die ganze Liste absuchen zu müssen.
  const [fresh, setFresh] = useState<ReadonlySet<number>>(new Set());
  const letzteMengen = useRef(new Map<number, number>());
  useEffect(() => {
    const vorher = letzteMengen.current;
    const neu = new Set<number>();
    for (const r of rows) if ((vorher.get(r.id) ?? 0) !== r.qty) neu.add(r.id);
    letzteMengen.current = new Map(rows.map((r) => [r.id, r.qty]));
    // Beim ersten Aufbau ist alles "neu" - das waere nur Unruhe.
    if (vorher.size === 0 || neu.size === 0) return;
    setFresh(neu);
    const t = window.setTimeout(() => setFresh(new Set()), 1400);
    return () => window.clearTimeout(t);
  }, [rows]);

  // So viele Zeilen zeigen, wie wirklich hinpassen - erst dann kürzen.
  const linesRef = useRef<HTMLDivElement>(null);
  const [lineSpace, setLineSpace] = useState(FALLBACK_HEIGHT);
  const [lineHeight, setLineHeight] = useState(FALLBACK_LINE_HEIGHT);
  useEffect(() => {
    const el = linesRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const messen = () => {
      const cs = getComputedStyle(el);
      // clientHeight schliesst das Innenabstandspolster ein - ohne Abzug
      // ragte die letzte Zeile knapp ueber den Rand.
      const polster =
        parseFloat(cs.paddingTop || "0") + parseFloat(cs.paddingBottom || "0");
      setLineSpace(el.clientHeight - polster);
      // Zeilenhoehe steht in der CSS (--guest-line); von dort lesen, damit
      // eine Aenderung am Stylesheet nicht still die Rechnung verstellt.
      const hoehe = parseFloat(cs.getPropertyValue("--guest-line"));
      if (Number.isFinite(hoehe) && hoehe > 0) setLineHeight(hoehe);
    };
    messen();
    const ro = new ResizeObserver(messen);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isEmpty]);

  const fit = useMemo(
    () => fitRows(rows, lineSpace, lineHeight),
    [rows, lineSpace, lineHeight],
  );

  return (
    <div className={`${styles.screen} no-select`}>
      <div className={styles.header}>
        <img src="/logo-zum-ross.svg" alt="Landgasthof Zum Ross" />
        <span className={styles.kicker}>Landgasthof Zum Ross · Diesbar</span>
        <span className={`${styles.kicker} ${styles.right}`}>Ihre Bestellung</span>
      </div>

      {isEmpty ? (
        <Idle />
      ) : (
        <div className={styles.body}>
          <div className={styles.lines} ref={linesRef}>
            {fit.shown.map((r) => (
              <div
                key={r.id}
                className={`${styles.line} ${fresh.has(r.id) ? styles.fresh : ""}`}
              >
                <span className={`${styles.q} tnum`}>{r.qty}×</span>
                <span className={styles.name}>{r.name}</span>
                <span className={`${styles.sum} tnum`}>{euro(r.sum)}</span>
              </div>
            ))}
            {fit.hidden > 0 && (
              <span className={styles.more}>
                + {fit.hidden} weitere{" "}
                {fit.hidden === 1 ? "Position" : "Positionen"}
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
