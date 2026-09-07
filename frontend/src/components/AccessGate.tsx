import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Lock } from "@phosphor-icons/react";
import { api, getAccessCode, setAccessCode } from "../api/client";
import { NumPad } from "./NumPad";
import s from "./AccessGate.module.css";

type Phase = "checking" | "locked" | "open";

/**
 * Der Server kann einen Zugangscode verlangen (HZ_ACCESS_CODE). Nur dann
 * erscheint dieses Schloss - ohne gesetzten Code merkt der Betrieb nichts.
 * Faellt der Server aus, wird NICHT gesperrt: das Banner meldet das, und der
 * Bediener behaelt seinen Bildschirm.
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    try {
      const h = await api.health();
      if (!h.access_code_required) {
        setPhase("open");
        return;
      }
      const res = await api.accessCheck(getAccessCode());
      setPhase(res.valid ? "open" : "locked");
    } catch {
      // Server nicht erreichbar -> nicht aussperren.
      setPhase("open");
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  async function submit() {
    if (!code || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await api.accessCheck(code);
      if (res.valid) {
        setAccessCode(code);
        setPhase("open");
      } else {
        setErr("Code stimmt nicht.");
        setCode("");
      }
    } catch {
      setErr("Kasse antwortet nicht.");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "checking") return <div className={s.splash}>Kasse wird geladen …</div>;
  if (phase === "open") return <>{children}</>;

  return (
    <div className={`${s.screen} no-select`}>
      <div className={s.card}>
        <div className={s.head}>
          <Lock size={24} weight="fill" />
          <h1>Zugangscode</h1>
        </div>
        <p className={s.hint}>Code eingeben, um die Kasse zu öffnen.</p>
        <NumPad
          value={code}
          onChange={setCode}
          unit=""
          decimals={false}
          masked
          placeholder="– – – –"
        />
        {err && <p className={s.err}>{err}</p>}
        <button
          className={s.go}
          disabled={!code || busy}
          onClick={submit}
          type="button"
        >
          {busy ? "Prüfe …" : "Entsperren"}
        </button>
      </div>
    </div>
  );
}
