import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { Catalog, EventDto } from "../api/types";
import { Button, ErrorText, Field, Modal } from "../components/ui";
import s from "./AdminLayout.module.css";
import rows from "./rows.module.css";

function statusLabel(e: EventDto): { text: string; tone: "active" | "archived" | "idle" } {
  if (e.is_active) return { text: "aktiv", tone: "active" };
  if (e.ended_at) return { text: "archiviert", tone: "archived" };
  return { text: "inaktiv", tone: "idle" };
}

export default function EventsAdmin() {
  const [events, setEvents] = useState<EventDto[]>([]);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [catalogId, setCatalogId] = useState<number | "">("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [ev, cat] = await Promise.all([api.events(), api.catalogs()]);
    setEvents(ev);
    setCatalogs(cat);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const catName = (id: number) =>
    catalogs.find((c) => c.id === id)?.name ?? `Katalog ${id}`;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (!name.trim() || catalogId === "") return;
    await run(() => api.createEvent(Number(catalogId), name.trim()));
    setCreating(false);
    setName("");
    setCatalogId("");
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
        >
          Neue Veranstaltung
        </Button>
      </div>
      <ErrorText>{err}</ErrorText>

      {events.length === 0 && (
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
                  <Button
                    small
                    disabled={busy}
                    onClick={() => run(() => api.activateEvent(e.id))}
                  >
                    Aktivieren
                  </Button>
                )}
                {e.is_active && (
                  <Button
                    small
                    disabled={busy}
                    onClick={() => run(() => api.archiveEvent(e.id))}
                  >
                    Archivieren
                  </Button>
                )}
                <Button
                  small
                  onClick={() => {
                    const n = prompt("Neuer Name", e.name);
                    if (n && n.trim()) run(() => api.updateEvent(e.id, n.trim()));
                  }}
                >
                  Umbenennen
                </Button>
                <Button
                  small
                  variant="danger"
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`Veranstaltung "${e.name}" löschen?`))
                      run(() => api.deleteEvent(e.id));
                  }}
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
          <label className="ui-field">
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Katalog</span>
            <select
              value={catalogId}
              onChange={(e) =>
                setCatalogId(e.target.value ? Number(e.target.value) : "")
              }
              style={{
                minHeight: "var(--touch)",
                padding: "0 12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "#1a1917",
                color: "var(--text)",
              }}
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
    </>
  );
}
