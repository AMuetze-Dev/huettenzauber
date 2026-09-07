import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { Catalog, EventDto } from "../api/types";
import { useToast } from "../components/Toast";
import { Button, ErrorText, Field, Modal } from "../components/ui";
import { useDialogs } from "../components/useDialogs";
import s from "./AdminLayout.module.css";
import rows from "./rows.module.css";

function statusLabel(e: EventDto): {
  text: string;
  tone: "active" | "archived" | "idle";
} {
  if (e.is_active) return { text: "aktiv", tone: "active" };
  if (e.ended_at) return { text: "archiviert", tone: "archived" };
  return { text: "inaktiv", tone: "idle" };
}

export default function EventsAdmin() {
  const toast = useToast();
  const { confirm, prompt, dialog } = useDialogs();
  const [events, setEvents] = useState<EventDto[]>([]);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [catalogId, setCatalogId] = useState<number | "">("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [ev, cat] = await Promise.all([api.events(), api.catalogs()]);
    setEvents(ev);
    setCatalogs(cat);
  }, []);

  useEffect(() => {
    load()
      .catch((e) => setErr(e instanceof ApiError ? e.detail : "Fehler"))
      .finally(() => setLoading(false));
  }, [load]);

  const catName = (id: number) =>
    catalogs.find((c) => c.id === id)?.name ?? `Katalog ${id}`;

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await load();
      if (ok) toast.success(ok);
    } catch (e) {
      const msg = e instanceof ApiError ? e.detail : "Fehler";
      setErr(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (!name.trim() || catalogId === "") return;
    await run(
      () => api.createEvent(Number(catalogId), name.trim()),
      "Veranstaltung angelegt",
    );
    setCreating(false);
    setName("");
    setCatalogId("");
  }

  async function activate(e: EventDto) {
    const running = events.find((x) => x.is_active && x.id !== e.id);
    if (running) {
      const ok = await confirm({
        title: `„${e.name}" aktivieren?`,
        confirmLabel: "Umschalten",
        body: `„${running.name}" läuft gerade und wird dabei beendet. Ein noch offener Warenkorb geht verloren.`,
      });
      if (!ok) return;
    }
    await run(() => api.activateEvent(e.id), `„${e.name}" ist aktiv`);
  }

  async function archive(e: EventDto) {
    const ok = await confirm({
      title: `„${e.name}" archivieren?`,
      confirmLabel: "Archivieren",
      body: "Die Bons bleiben für die Statistik erhalten. Danach nimmt das Bedienterminal keine Bestellungen mehr an, bis eine andere Veranstaltung aktiv ist.",
    });
    if (ok) await run(() => api.archiveEvent(e.id), "Archiviert");
  }

  async function rename(e: EventDto) {
    const n = await prompt({
      title: "Veranstaltung umbenennen",
      label: "Name",
      initial: e.name,
    });
    if (n) await run(() => api.updateEvent(e.id, n), "Umbenannt");
  }

  async function remove(e: EventDto) {
    const ok = await confirm({
      title: `„${e.name}" löschen?`,
      danger: true,
      confirmLabel: "Löschen",
      body: "Nur möglich, solange keine Bons daran hängen – sonst bleibt die Veranstaltung als Archiv bestehen.",
    });
    if (ok) await run(() => api.deleteEvent(e.id), "Gelöscht");
  }

  return (
    <>
      <div className={s.pageHead}>
        <h1>Veranstaltungen</h1>
        <span className={s.grow} />
        <Button
          variant="primary"
          onClick={() => setCreating(true)}
          disabled={catalogs.length === 0}
          title={
            catalogs.length === 0 ? "Zuerst einen Katalog anlegen" : undefined
          }
        >
          Neue Veranstaltung
        </Button>
      </div>
      <ErrorText>{err}</ErrorText>

      {loading && <p style={{ color: "var(--text-muted)" }}>Wird geladen …</p>}

      {!loading && events.length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>
          Noch keine Veranstaltung. Zuerst im Katalog eine Vorlage anlegen.
        </p>
      )}

      <div className={rows.list}>
        {events.map((e) => {
          const st = statusLabel(e);
          return (
            <div key={e.id} className={rows.row}>
              <div className={rows.main}>
                <span className={rows.name}>{e.name}</span>
                <span className={rows.sub}>Katalog: {catName(e.catalog_id)}</span>
              </div>
              <span className={`${rows.tag} ${rows[st.tone]}`}>{st.text}</span>
              <div className={rows.actions}>
                {!e.is_active && !e.ended_at && (
                  <Button small disabled={busy} onClick={() => activate(e)}>
                    Aktivieren
                  </Button>
                )}
                {e.is_active && (
                  <Button small disabled={busy} onClick={() => archive(e)}>
                    Archivieren
                  </Button>
                )}
                <Button small disabled={busy} onClick={() => rename(e)}>
                  Umbenennen
                </Button>
                <Button
                  small
                  variant="danger"
                  disabled={busy}
                  onClick={() => remove(e)}
                >
                  Löschen
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {creating && (
        <Modal
          title="Neue Veranstaltung"
          onClose={() => setCreating(false)}
          actions={
            <>
              <Button onClick={() => setCreating(false)}>Abbrechen</Button>
              <Button
                variant="primary"
                disabled={busy || !name.trim() || catalogId === ""}
                onClick={create}
              >
                Anlegen
              </Button>
            </>
          }
        >
          <Field
            label="Name"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Glühweinmeile Dez 2026"
          />
          <label className={rows.selectField}>
            <span>Katalog</span>
            <select
              value={catalogId}
              onChange={(e) =>
                setCatalogId(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">— wählen —</option>
              {catalogs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </Modal>
      )}

      {dialog}
    </>
  );
}
