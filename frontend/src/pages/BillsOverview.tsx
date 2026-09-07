import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowUUpLeft, Printer, Prohibit } from "@phosphor-icons/react";
import { api, ApiError } from "../api/client";
import type { Bill, BillListRow, DaySummary } from "../api/types";
import { Topbar } from "../components/Topbar";
import styles from "./BillsOverview.module.css";
import topbar from "../components/Topbar.module.css";
import { euro, qtyLabel } from "../lib/money";

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function BillsOverview() {
  const navigate = useNavigate();
  const [showVoided, setShowVoided] = useState(false);
  const [rows, setRows] = useState<BillListRow[]>([]);
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Bill | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [noEvent, setNoEvent] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, sum] = await Promise.all([
        api.bills({ includeDeleted: showVoided }),
        api.daySummary(),
      ]);
      setRows(list);
      setSummary(sum);
      setNoEvent(false);
      setSelectedId((cur) =>
        cur != null && list.some((b) => b.id === cur)
          ? cur
          : (list[0]?.id ?? null),
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setNoEvent(true);
    }
  }, [showVoided]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setConfirming(false);
    if (selectedId == null) {
      setDetail(null);
      return;
    }
    let alive = true;
    api
      .bill(selectedId)
      .then((b) => alive && setDetail(b))
      .catch(() => alive && setDetail(null));
    return () => {
      alive = false;
    };
  }, [selectedId, rows]);

  async function toggleVoid() {
    if (selectedId == null || busy || !detail) return;
    setBusy(true);
    try {
      if (detail.is_deleted) await api.restoreBill(selectedId);
      else await api.voidBill(selectedId);
      await load();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <div className={`${styles.screen} no-select`}>
      <Topbar>
        <button className={topbar.navBtn} onClick={() => navigate("/order")}>
          <ArrowLeft size={16} />
          Bestellung
        </button>
      </Topbar>

      <div style={{ padding: "14px 18px 0" }} className={styles.head}>
        <h1>Rechnungen heute</h1>
        {summary && (
          <span className={styles.meta}>
            {summary.bill_count} Belege · {euro(summary.net_total)}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={showVoided}
            onChange={(e) => setShowVoided(e.target.checked)}
          />
          Stornierte anzeigen
        </label>
      </div>

      {noEvent ? (
        <div className={styles.placeholder}>Keine aktive Veranstaltung.</div>
      ) : (
        <div className={styles.body}>
          <div className={styles.list}>
            {rows.length === 0 && (
              <div className={styles.empty}>Noch keine Rechnungen heute.</div>
            )}
            {rows.map((b) => (
              <button
                key={b.id}
                className={`${styles.row} ${b.id === selectedId ? styles.active : ""} ${
                  b.is_deleted ? styles.dead : ""
                }`}
                onClick={() => setSelectedId(b.id)}
              >
                <span className={`${styles.nr} tnum`}>#{b.id}</span>
                <span className={`${styles.time} tnum`}>
                  {hhmm(b.created_at)}
                </span>
                <span className={styles.pos}>
                  {b.position_count} Positionen
                </span>
                <span
                  className={`${styles.state} ${b.is_deleted ? styles.voided : ""}`}
                >
                  {b.is_deleted ? "Storniert" : "Bezahlt · Bar"}
                </span>
                <span className={`${styles.sum} tnum`}>
                  {euro(b.total_gross)}
                </span>
              </button>
            ))}
          </div>

          <div className={styles.detail}>
            {!detail ? (
              <div className={styles.placeholder}>
                Rechnung links auswählen.
              </div>
            ) : (
              <>
                <div className={styles.detailHead}>
                  <div className={styles.topRow}>
                    <span className={`${styles.nr} tnum`}>#{detail.id}</span>
                    <span
                      className={`${styles.pill} ${detail.is_deleted ? styles.voided : ""}`}
                    >
                      {detail.is_deleted ? "Storniert" : "Bezahlt · Bar"}
                    </span>
                  </div>
                  <span className={styles.time}>
                    {hhmm(detail.created_at)} Uhr · Ausschank
                  </span>
                </div>

                <div className={styles.positions}>
                  {detail.items.map((p, i) => (
                    <div key={i} className={styles.pline}>
                      <span className={`${styles.q} tnum`}>
                        {qtyLabel(p.quantity)}×
                      </span>
                      <span className={styles.n}>
                        {p.variant_name && p.variant_name !== p.item_name
                          ? `${p.item_name} · ${p.variant_name}`
                          : p.item_name}
                      </span>
                      <span className={`${styles.s} tnum`}>
                        {euro(Number(p.unit_price) * Number(p.quantity))}
                      </span>
                    </div>
                  ))}
                  {Number(detail.total_deposit) > 0 && (
                    <div className={styles.pline}>
                      <span className={styles.q} />
                      <span className={styles.n}>Pfand</span>
                      <span className={`${styles.s} tnum`}>
                        {euro(detail.total_deposit)}
                      </span>
                    </div>
                  )}
                  {Number(detail.deposit_return_total) > 0 && (
                    <div className={styles.pline}>
                      <span className={styles.q} />
                      <span className={styles.n}>Pfandrückgabe</span>
                      <span className={`${styles.s} tnum`}>
                        − {euro(detail.deposit_return_total)}
                      </span>
                    </div>
                  )}
                </div>

                <div className={styles.detailFoot}>
                  <div className={styles.sumRow}>
                    <span className={styles.label}>Belegsumme</span>
                    <span className={`${styles.val} tnum`}>
                      {euro(
                        Number(detail.total_gross) +
                          Number(detail.total_deposit) -
                          Number(detail.deposit_return_total),
                      )}
                    </span>
                  </div>

                  {confirming ? (
                    <div className={styles.confirm}>
                      <span className={styles.q}>
                        Beleg #{detail.id} über {euro(detail.total_gross)}{" "}
                        wirklich stornieren?
                      </span>
                      <div className={styles.btns}>
                        <button
                          className={styles.yes}
                          disabled={busy}
                          onClick={toggleVoid}
                        >
                          Ja, stornieren
                        </button>
                        <button
                          className={styles.no}
                          onClick={() => setConfirming(false)}
                        >
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.actions}>
                      {detail.is_deleted ? (
                        <button
                          className={styles.voidBtn}
                          disabled={busy}
                          onClick={toggleVoid}
                        >
                          <ArrowUUpLeft size={18} />
                          Storno rückgängig
                        </button>
                      ) : (
                        <button
                          className={styles.voidBtn}
                          onClick={() => setConfirming(true)}
                        >
                          <Prohibit size={18} />
                          Beleg stornieren
                        </button>
                      )}
                      <button
                        className={styles.iconBtn}
                        title="Beleg erneut drucken"
                        onClick={() => window.print()}
                      >
                        <Printer size={18} />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
