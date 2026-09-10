import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowsClockwise,
  FilePdf,
  Lock,
  Trash,
} from "@phosphor-icons/react";
import { api, ApiError } from "../api/client";
import type { CashCount, DepositReturnRow } from "../api/types";
import { NumPad } from "../components/NumPad";
import { useToast } from "../components/Toast";
import { Button, Modal } from "../components/ui";
import { useDialogs } from "../components/useDialogs";
import { saveFile } from "../lib/download";
import { euro, toNumber } from "../lib/money";
import layout from "./AdminLayout.module.css";
import s from "./CashDeskAdmin.module.css";

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const QTY_CHOICES = ["1", "2", "3", "4", "5", "6", "10", "12"];

/**
 * Tagesabschluss: was über die Theke ging, dazu der Abschluss und die
 * Pfandauszahlung ohne Bon.
 *
 * Kein gezählter Kassenbestand, kein Wechselgeld, keine Bargeldbewegungen –
 * die waren im Betrieb nie zuverlässig erfasst und haben nur eine
 * scheingenaue Differenz erzeugt (D41 in ARCHITEKTUR.md).
 */
export default function CashDeskAdmin() {
  const toast = useToast();
  const { confirm, dialog } = useDialogs();
  const [count, setCount] = useState<CashCount | null>(null);
  const [returns, setReturns] = useState<DepositReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [noEvent, setNoEvent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pad, setPad] = useState(false);
  const [padValue, setPadValue] = useState("");
  const [depQty, setDepQty] = useState("1");

  const load = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([
        api.cashCount(),
        api.depositReturns({ standaloneOnly: true }),
      ]);
      setCount(c);
      setReturns(r);
      setNoEvent(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setNoEvent(true);
      else if (e instanceof ApiError && !e.isOffline) toast.error(e.detail);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      await load();
      toast.success(ok);
      setPad(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.detail : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf() {
    setBusy(true);
    try {
      saveFile(await api.billsPdf());
      toast.success("Übersicht gespeichert");
    } catch (e) {
      toast.error(
        e instanceof ApiError && !e.isOffline
          ? e.detail
          : "Kasse nicht erreichbar – Ausdruck fehlgeschlagen.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function closeDay() {
    const ok = await confirm({
      title: count?.closed ? "Erneut abschließen?" : "Tag abschließen?",
      confirmLabel: count?.closed ? "Erneut abschließen" : "Abschließen",
      body: count?.closed
        ? "Der Tag ist schon vermerkt. Ein weiterer Abschluss aktualisiert die Summen und legt eine neue Sicherung an."
        : "Der Tag wird als abgerechnet vermerkt und eine Sicherung der Datenbank angelegt. Verkaufen bleibt danach möglich – neue Bons zählen dann zum nächsten Betriebstag.",
    });
    if (ok) await run(() => api.closeDay(), "Tag abgeschlossen");
  }

  if (noEvent)
    return (
      <>
        <div className={layout.pageHead}>
          <h1>Tagesabschluss</h1>
        </div>
        <p className={s.empty}>
          Keine aktive Veranstaltung – zuerst unter „Veranstaltungen“ eine
          aktivieren.
        </p>
      </>
    );

  if (loading || !count)
    return (
      <>
        <div className={layout.pageHead}>
          <h1>Tagesabschluss</h1>
        </div>
        <p className={s.empty}>Wird geladen …</p>
      </>
    );

  return (
    <>
      <div className={layout.pageHead}>
        <h1>Tagesabschluss</h1>
        <span className={s.day}>
          {new Date(count.business_day).toLocaleDateString("de-DE", {
            weekday: "long",
            day: "2-digit",
            month: "long",
          })}
          {count.closed && <em className={s.closedTag}>abgeschlossen</em>}
        </span>
        <span className={layout.grow} />
        <Button onClick={() => void load()}>
          <ArrowsClockwise size={16} />
          Aktualisieren
        </Button>
      </div>

      <div className={s.cards}>
        <section className={s.card}>
          <h2>Was über die Theke ging</h2>
          <dl className={s.rows}>
            <Row label={`Bons (${count.bill_count})`} value={count.total_gross} />
            <Row label="Pfand eingenommen" value={count.total_deposit} />
            <Row
              label="Pfand in Bons zurück"
              value={count.deposit_return_in_bills}
              minus
            />
            <Row
              label="Pfand einzeln ausgezahlt"
              value={count.standalone_deposit_return}
              minus
            />
            <div className={s.rule} />
            <Row label="Bareinnahme" value={count.cash_income} big />
          </dl>
          <p className={s.hint}>
            Was der Rechner mitbekommen hat. Trinkgeld und Geld im Tresor stehen
            bewusst nicht hier – im Betrieb ließ sich das nie vollständig
            erfassen.
          </p>
          <div className={s.cardActions}>
            <Button disabled={busy} onClick={() => void downloadPdf()}>
              <FilePdf size={16} />
              Übersicht als PDF
            </Button>
          </div>
        </section>

        <section className={s.card}>
          <h2>Abschluss</h2>
          {count.closed && count.closed_at ? (
            <p className={s.hint}>
              Abgeschlossen um {hhmm(count.closed_at)} Uhr, eine Sicherung liegt
              vor. Neue Bons zählen bereits zum nächsten Betriebstag.
            </p>
          ) : (
            <p className={s.hint}>
              Vermerkt den Tag als abgerechnet und legt eine Sicherung der
              Datenbank an. Verkaufen bleibt danach möglich.
            </p>
          )}
          <div className={s.cardActions}>
            <Button variant="primary" disabled={busy} onClick={() => void closeDay()}>
              <Lock size={16} />
              {count.closed ? "Erneut abschließen" : "Tag abschließen"}
            </Button>
          </div>
        </section>

        <section className={`${s.card} ${s.wide}`}>
          <h2>Pfand ohne Bon ausgezahlt</h2>
          <p className={s.hint}>
            Für Gäste, die nur Gläser zurückbringen. Der Betrag geht direkt von
            der Bareinnahme ab.
          </p>
          {returns.length === 0 ? (
            <p className={s.empty}>Heute noch keine.</p>
          ) : (
            <div className={s.retList}>
              {returns.map((r) => (
                <div key={r.id} className={s.ret}>
                  <span className={`${s.retQty} tnum`}>{r.quantity}×</span>
                  <span className={s.retUnit}>à {euro(r.unit_amount)}</span>
                  <span className={s.retTime}>{hhmm(r.created_at)} Uhr</span>
                  <span className={`${s.retSum} tnum`}>− {euro(r.total_amount)}</span>
                  <Button
                    small
                    variant="danger"
                    aria-label={`Pfandrückgabe über ${euro(r.total_amount)} löschen`}
                    disabled={busy}
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Eintrag löschen?",
                        danger: true,
                        confirmLabel: "Löschen",
                        body: `${r.quantity}× à ${euro(r.unit_amount)} = ${euro(r.total_amount)}`,
                      });
                      if (ok)
                        await run(
                          () => api.deleteDepositReturn(r.id),
                          "Eintrag gelöscht",
                        );
                    }}
                  >
                    <Trash size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className={s.cardActions}>
            <Button
              onClick={() => {
                setPadValue("2.00");
                setDepQty("1");
                setPad(true);
              }}
            >
              Pfand auszahlen
            </Button>
          </div>
        </section>
      </div>

      {pad && (
        <PadModal
          title="Pfand auszahlen"
          hint="Betrag je Stück eintippen, dann die Anzahl wählen."
          value={padValue}
          onValue={setPadValue}
          busy={busy}
          confirmLabel={`${depQty}× auszahlen · ${euro(toNumber(padValue) * Number(depQty))}`}
          disabled={toNumber(padValue) <= 0 || Number(depQty) <= 0}
          onClose={() => setPad(false)}
          onSubmit={() =>
            run(
              () => api.createDepositReturn(padValue, Number(depQty)),
              `${depQty}× Pfand ausgezahlt`,
            )
          }
          extra={
            <div className={s.qtyRow}>
              <span>Anzahl</span>
              {QTY_CHOICES.map((q) => (
                <button
                  key={q}
                  type="button"
                  aria-label={`${q} Stück`}
                  aria-pressed={depQty === q}
                  className={`${s.qty} ${depQty === q ? s.qtySel : ""}`}
                  onClick={() => setDepQty(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          }
        />
      )}

      {dialog}
    </>
  );
}

function Row({
  label,
  value,
  big,
  minus,
}: {
  label: string;
  value: string;
  big?: boolean;
  /** Immer als Abzug darstellen. */
  minus?: boolean;
}) {
  const cls = [s.row, big && s.bigRow].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <dt>{label}</dt>
      <dd className="tnum">
        {minus ? "− " : ""}
        {euro(value)}
      </dd>
    </div>
  );
}

function PadModal({
  title,
  hint,
  value,
  onValue,
  onClose,
  onSubmit,
  busy,
  confirmLabel = "Speichern",
  disabled,
  extra,
}: {
  title: string;
  hint?: string;
  value: string;
  onValue: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  busy: boolean;
  confirmLabel?: string;
  disabled?: boolean;
  extra?: ReactNode;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" disabled={busy || disabled} onClick={onSubmit}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {hint && <p className={s.hint}>{hint}</p>}
      <NumPad value={value} onChange={onValue} />
      {extra}
    </Modal>
  );
}
