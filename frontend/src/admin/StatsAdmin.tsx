import { useCallback, useEffect, useMemo, useState } from "react";
import { DownloadSimple } from "@phosphor-icons/react";
import { api, ApiError } from "../api/client";
import type { Statistics } from "../api/types";
import { Button, ErrorText } from "../components/ui";
import { euro, qtyLabel, toNumber } from "../lib/money";
import layout from "./AdminLayout.module.css";
import s from "./StatsAdmin.module.css";

function csv(stats: Statistics): string {
  const head = ["Rang", "Artikel", "Variante", "Menge", "Umsatz"];
  const rows = stats.consumption.map((c, i) => [
    String(i + 1),
    c.item_name,
    c.variant_name ?? "",
    qtyLabel(c.quantity),
    toNumber(c.revenue).toFixed(2),
  ]);
  return [head, ...rows]
    .map((r) => r.map((f) => `"${f.replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
}

export default function StatsAdmin() {
  const [day, setDay] = useState<string>(""); // "" = ganze Veranstaltung
  const [stats, setStats] = useState<Statistics | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStats(await api.statistics(day || undefined));
      setErr(null);
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : "Fehler");
      setStats(null);
    }
  }, [day]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxQty = useMemo(
    () =>
      stats
        ? Math.max(1, ...stats.consumption.map((c) => toNumber(c.quantity)))
        : 1,
    [stats],
  );

  function download() {
    if (!stats) return;
    const blob = new Blob(["﻿" + csv(stats)], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `verbrauch_${stats.event_name}_${stats.scope}.csv`.replace(
      /\s+/g,
      "-",
    );
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <div className={layout.pageHead}>
        <h1>Statistik</h1>
        <span className={layout.grow} />
        <Button onClick={download} disabled={!stats || stats.consumption.length === 0}>
          <DownloadSimple size={16} />
          CSV
        </Button>
      </div>
      <ErrorText>{err}</ErrorText>

      {stats && (
        <>
          <div className={s.scopeBar}>
            <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
              {stats.event_name}
            </span>
            <select value={day} onChange={(e) => setDay(e.target.value)}>
              <option value="">Ganze Veranstaltung</option>
              {stats.days.map((d) => (
                <option key={d.business_day} value={d.business_day}>
                  {d.business_day} ({d.bill_count})
                </option>
              ))}
            </select>
          </div>

          <div className={s.kpis}>
            <div className={s.kpi}>
              <div className={s.l}>Belege</div>
              <div className={s.v}>{stats.bill_count}</div>
            </div>
            <div className={s.kpi}>
              <div className={s.l}>Umsatz brutto</div>
              <div className={s.v}>{euro(stats.total_gross)}</div>
            </div>
            <div className={s.kpi}>
              <div className={s.l}>Pfand</div>
              <div className={s.v}>{euro(stats.total_deposit)}</div>
            </div>
            <div className={s.kpi}>
              <div className={s.l}>Netto (Bar)</div>
              <div className={s.v}>{euro(stats.net_total)}</div>
            </div>
          </div>

          <div className={s.table}>
            <div className={s.head} style={{ display: "grid", gridTemplateColumns: "34px 1fr 90px 110px", gap: 12 }}>
              <span>#</span>
              <span>Artikel</span>
              <span style={{ textAlign: "right" }}>Menge</span>
              <span style={{ textAlign: "right" }}>Umsatz</span>
            </div>
            {stats.consumption.length === 0 && (
              <p style={{ color: "var(--text-muted)", padding: "12px" }}>
                Noch keine Verkäufe.
              </p>
            )}
            {stats.consumption.map((c, i) => (
              <div key={`${c.item_name}-${c.variant_name}`} className={s.trow}>
                <span
                  className={s.bar}
                  style={{ width: `${(toNumber(c.quantity) / maxQty) * 100}%` }}
                />
                <span className={s.rank}>{i + 1}</span>
                <span className={s.nm}>
                  {c.item_name}
                  {c.variant_name && <small>{c.variant_name}</small>}
                </span>
                <span className={`${s.qty} tnum`}>{qtyLabel(c.quantity)}</span>
                <span className={`${s.rev} tnum`}>{euro(c.revenue)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
