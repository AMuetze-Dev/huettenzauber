import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowsClockwise,
  Lock,
  Minus,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { api, ApiError } from "../api/client";
import type { CashCount, CashMovement, DepositReturnRow } from "../api/types";
import { NumPad } from "../components/NumPad";
import { useToast } from "../components/Toast";
import { Button, Modal } from "../components/ui";
import { useDialogs } from "../components/useDialogs";
import { euro, toNumber } from "../lib/money";
import layout from "./AdminLayout.module.css";
import s from "./CashDeskAdmin.module.css";

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

type Pad = null | "float" | "count" | "deposit" | "in" | "out";

const QTY_CHOICES = ["1", "2", "3", "4", "5", "6", "10", "12"];

/** Vorgaben statt Tippen - am Pi haengt keine Tastatur. */
const REASONS_IN = ["Wechselgeld nachgelegt", "Kleingeld getauscht", "Einlage"];
const REASONS_OUT = ["In den Tresor", "Auslage bezahlt", "Entnahme"];

export default function CashDeskAdmin() {
  const toast = useToast();
  const { confirm, dialog } = useDialogs();
  const [count, setCount] = useState<CashCount | null>(null);
  const [returns, setReturns] = useState<DepositReturnRow[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [noEvent, setNoEvent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pad, setPad] = useState<Pad>(null);
  const [padValue, setPadValue] = useState("");
  const [depQty, setDepQty] = useState("1");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try {
      const [c, r, m] = await Promise.all([
        api.cashCount(),
        api.depositReturns({ standaloneOnly: true }),
        api.cashMovements(),
      ]);
      setCount(c);
      setReturns(r);
      setMovements(m);
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

  function openPad(kind: Exclude<Pad, null>, initial = "") {
    setPadValue(initial);
    setDepQty("1");
    setReason("");
    setPad(kind);
  }

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      await load();
      toast.success(ok);
      setPad(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.detail : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  async function closeWithoutCount() {
    const ok = await confirm({
      title: "Ohne Zählung abschließen?",
      confirmLabel: "Trotzdem abschließen",
      body: "Der Tag wird als abgerechnet vermerkt, aber es steht kein gezählter Bestand dabei. Eine Differenz lässt sich später nicht mehr belegen.",
    });
    if (ok) await run(() => api.closeDay(null), "Tag abgeschlossen");
  }

  if (noEvent)
    return (
      <>
        <div className={layout.pageHead}>
          <h1>Kassenschnitt</h1>
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
          <h1>Kassenschnitt</h1>
        </div>
        <p className={s.empty}>Wird geladen …</p>
      </>
    );

  const expected = toNumber(count.expected_cash);
  const diff = count.counted_cash == null ? null : toNumber(count.difference);
  const padDiff = toNumber(padValue) - expected;

  return (
    <>
      <div className={layout.pageHead}>
        <h1>Kassenschnitt</h1>
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
          <h2>Was in der Kasse sein müsste</h2>
          <dl className={s.rows}>
            <Row label={`Bons (${count.bill_count})`} value={count.total_gross} />
            <Row label="Pfand eingenommen" value={count.total_deposit} />
            <Row label="Pfand in Bons zurück" value={count.deposit_return_in_bills} minus />
            <Row
              label="Pfand einzeln ausgezahlt"
              value={count.standalone_deposit_return}
              minus
            />
            <div className={s.rule} />
            <Row label="Bareinnahme" value={count.cash_income} strong />
            <Row label="Wechselgeld zu Beginn" value={count.opening_float} />
            <Row
              label="Ein-/Auszahlungen"
              value={count.movement_total}
              signed
            />
            <div className={s.rule} />
            <Row label="Soll-Bestand" value={count.expected_cash} big />
          </dl>
          <div className={s.cardActions}>
            <Button
              onClick={() => openPad("float", String(toNumber(count.opening_float)))}
            >
              Wechselgeld setzen
            </Button>
          </div>
        </section>

        <section className={s.card}>
          <h2>Zählung &amp; Abschluss</h2>
          {count.counted_cash == null ? (
            <p className={s.empty}>
              Noch nicht gezählt. Das Geld zählen, den Betrag eintippen – die
              Differenz rechnet die Kasse.
            </p>
          ) : (
            <>
              <div className={`${s.counted} tnum`}>{euro(count.counted_cash)}</div>
              <div
                className={`${s.diff} ${Math.abs(diff ?? 0) < 0.005 ? s.good : s.bad} tnum`}
              >
                {Math.abs(diff ?? 0) < 0.005
                  ? "stimmt genau"
                  : `${(diff ?? 0) > 0 ? "Überschuss" : "Fehlbetrag"} ${euro(Math.abs(diff ?? 0))}`}
              </div>
            </>
          )}
          {count.closed && count.closed_at && (
            <p className={s.empty}>
              Abgeschlossen um {hhmm(count.closed_at)} Uhr. Neue Bons zählen bereits
              zum nächsten Tag.
            </p>
          )}
          <div className={s.cardActions}>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => openPad("count", String(expected))}
            >
              <Lock size={16} />
              {count.closed ? "Zählung korrigieren" : "Zählen & abschließen"}
            </Button>
            {!count.closed && (
              <Button disabled={busy} onClick={closeWithoutCount}>
                Ohne Zählung abschließen
              </Button>
            )}
          </div>
        </section>

        <section className={s.card}>
          <h2>Geld rein &amp; raus</h2>
          <p className={s.hint}>
            Alles, was ohne Verkauf in die Kasse kommt oder sie verlässt –
            nachgelegtes Wechselgeld, Geld in den Tresor.
          </p>
          {movements.length === 0 ? (
            <p className={s.empty}>Heute noch nichts bewegt.</p>
          ) : (
            <div className={s.retList}>
              {movements.map((m) => {
                const amount = toNumber(m.amount);
                return (
                  <div key={m.id} className={s.ret}>
                    <span
                      className={`${s.moveIcon} ${amount > 0 ? s.good : s.bad}`}
                      aria-hidden
                    >
                      {amount > 0 ? <Plus size={13} /> : <Minus size={13} />}
                    </span>
                    <span className={s.moveReason}>
                      {m.reason || (amount > 0 ? "Einlage" : "Entnahme")}
                    </span>
                    <span className={s.retTime}>{hhmm(m.created_at)} Uhr</span>
                    <span
                      className={`${s.retSum} ${amount > 0 ? s.good : s.bad} tnum`}
                    >
                      {amount > 0 ? "+ " : "− "}
                      {euro(Math.abs(amount))}
                    </span>
                    <Button
                      small
                      variant="danger"
                      aria-label={`Bewegung über ${euro(Math.abs(amount))} löschen`}
                      disabled={busy}
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Eintrag löschen?",
                          danger: true,
                          confirmLabel: "Löschen",
                          body: `${m.reason || "Bargeldbewegung"} · ${euro(amount)}`,
                        });
                        if (ok)
                          await run(
                            () => api.deleteCashMovement(m.id),
                            "Eintrag gelöscht",
                          );
                      }}
                    >
                      <Trash size={14} />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          <div className={s.cardActions}>
            <Button onClick={() => openPad("in")}>
              <Plus size={15} />
              Geld einlegen
            </Button>
            <Button onClick={() => openPad("out")}>
              <Minus size={15} />
              Geld entnehmen
            </Button>
          </div>
        </section>

        <section className={`${s.card} ${s.wide}`}>
          <h2>Pfand ohne Bon ausgezahlt</h2>
          <p className={s.hint}>
            Für Gäste, die nur Gläser zurückbringen. Der Betrag geht direkt vom
            Soll-Bestand ab.
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
            <Button onClick={() => openPad("deposit", "2.00")}>
              Pfand auszahlen
            </Button>
          </div>
        </section>
      </div>

      {pad === "float" && (
        <PadModal
          title="Wechselgeld zu Beginn"
          hint="Der Betrag, der vor dem ersten Verkauf in der Kasse lag."
          value={padValue}
          onValue={setPadValue}
          busy={busy}
          onClose={() => setPad(null)}
          onSubmit={() =>
            run(() => api.setCashFloat(padValue || "0"), "Wechselgeld gespeichert")
          }
        />
      )}

      {pad === "count" && (
        <PadModal
          title={count.closed ? "Zählung korrigieren" : "Zählen & abschließen"}
          hint={`Soll-Bestand ${euro(expected)} – jetzt den tatsächlich gezählten Betrag eintippen.`}
          value={padValue}
          onValue={setPadValue}
          busy={busy}
          confirmLabel={count.closed ? "Korrektur speichern" : "Tag abschließen"}
          disabled={padValue === ""}
          onClose={() => setPad(null)}
          onSubmit={() =>
            run(
              () => api.closeDay(padValue || "0"),
              count.closed ? "Zählung korrigiert" : "Tag abgeschlossen",
            )
          }
          extra={
            padValue === "" ? null : (
              <div
                className={`${s.padDiff} ${Math.abs(padDiff) < 0.005 ? s.good : s.bad}`}
              >
                {Math.abs(padDiff) < 0.005
                  ? "stimmt genau"
                  : `${padDiff > 0 ? "Überschuss" : "Fehlbetrag"} ${euro(Math.abs(padDiff))}`}
              </div>
            )
          }
        />
      )}

      {pad === "deposit" && (
        <PadModal
          title="Pfand auszahlen"
          hint="Betrag je Stück eintippen, dann die Anzahl wählen."
          value={padValue}
          onValue={setPadValue}
          busy={busy}
          confirmLabel={`${depQty}× auszahlen · ${euro(toNumber(padValue) * Number(depQty))}`}
          disabled={toNumber(padValue) <= 0 || Number(depQty) <= 0}
          onClose={() => setPad(null)}
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

      {(pad === "in" || pad === "out") && (
        <PadModal
          title={pad === "in" ? "Geld einlegen" : "Geld entnehmen"}
          hint={
            pad === "in"
              ? "Wechselgeld, das ohne Verkauf in die Kasse kommt."
              : "Geld, das die Kasse verlässt – etwa in den Tresor."
          }
          value={padValue}
          onValue={setPadValue}
          busy={busy}
          confirmLabel={
            pad === "in"
              ? `${euro(toNumber(padValue))} einlegen`
              : `${euro(toNumber(padValue))} entnehmen`
          }
          disabled={toNumber(padValue) <= 0}
          onClose={() => setPad(null)}
          onSubmit={() =>
            run(
              () =>
                api.addCashMovement(
                  pad === "in" ? padValue : `-${padValue}`,
                  reason,
                ),
              pad === "in" ? "Einlage gebucht" : "Entnahme gebucht",
            )
          }
          extra={
            <div className={s.reasonRow}>
              <span className={s.reasonLabel}>Grund</span>
              <div className={s.reasonChips}>
                {(pad === "in" ? REASONS_IN : REASONS_OUT).map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={reason === r}
                    className={`${s.reasonChip} ${reason === r ? s.qtySel : ""}`}
                    onClick={() => setReason(reason === r ? "" : r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
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
  strong,
  big,
  minus,
  signed,
}: {
  label: string;
  value: string;
  strong?: boolean;
  big?: boolean;
  /** Immer als Abzug darstellen. */
  minus?: boolean;
  /** Vorzeichen aus dem Wert übernehmen (+/−). */
  signed?: boolean;
}) {
  const cls = [s.row, strong && s.strong, big && s.bigRow].filter(Boolean).join(" ");
  const n = toNumber(value);
  const prefix = minus ? "− " : signed && n > 0 ? "+ " : signed && n < 0 ? "− " : "";
  return (
    <div className={cls}>
      <dt>{label}</dt>
      <dd className="tnum">
        {prefix}
        {euro(signed ? Math.abs(n) : value)}
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
