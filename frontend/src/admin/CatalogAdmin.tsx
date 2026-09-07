import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CopySimple,
  DotsSixVertical,
  Pencil,
  Plus,
  Star,
  Trash,
} from "@phosphor-icons/react";
import { api, ApiError, type StockItemInput } from "../api/client";
import type { Category, Catalog, StockItem } from "../api/types";
import { SortableList, type DragHandle } from "../components/SortableList";
import { useToast } from "../components/Toast";
import { Button, ErrorText } from "../components/ui";
import { useDialogs } from "../components/useDialogs";
import { euro } from "../lib/money";
import { catIcon } from "../order/catIcon";
import layout from "./AdminLayout.module.css";
import s from "./CatalogAdmin.module.css";
import { CategoryEditor } from "./CategoryEditor";
import { ItemEditor } from "./ItemEditor";

const ALL = -1;

export default function CatalogAdmin() {
  const toast = useToast();
  const { confirm, prompt, dialog } = useDialogs();
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [catalogId, setCatalogId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [selCat, setSelCat] = useState<number>(ALL);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [creatingCat, setCreatingCat] = useState(false);
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [creatingItem, setCreatingItem] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadCatalogs = useCallback(async () => {
    const cs = await api.catalogs();
    setCatalogs(cs);
    setCatalogId((cur) => cur ?? cs[0]?.id ?? null);
    return cs;
  }, []);

  const loadCatalog = useCallback(async (id: number) => {
    const [cats, its] = await Promise.all([
      api.categories(id),
      api.stockItems(id, true),
    ]);
    setCategories(cats);
    setItems(its);
  }, []);

  useEffect(() => {
    loadCatalogs()
      .catch((e) => setErr(e instanceof ApiError ? e.detail : "Fehler"))
      .finally(() => setLoading(false));
  }, [loadCatalogs]);

  useEffect(() => {
    if (catalogId != null)
      void loadCatalog(catalogId).catch((e) =>
        setErr(e instanceof ApiError ? e.detail : "Fehler"),
      );
  }, [catalogId, loadCatalog]);

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      if (catalogId != null) await loadCatalog(catalogId);
      if (ok) toast.success(ok);
      return true;
    } catch (e) {
      const msg = e instanceof ApiError ? e.detail : "Fehler";
      setErr(msg);
      toast.error(msg);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const shownItems = useMemo(
    () =>
      items.filter((i) => (selCat === ALL ? true : (i.category_id ?? 0) === selCat)),
    [items, selCat],
  );
  const favCount = items.filter((i) => i.is_favorite && i.is_active).length;

  function reorderCats(ids: number[]) {
    setCategories((cs) => ids.map((id) => cs.find((c) => c.id === id)!));
    if (catalogId != null)
      api
        .reorderCategories(catalogId, ids)
        .catch(() => toast.error("Reihenfolge nicht gespeichert"));
  }

  function reorderItems(ids: number[]) {
    setItems((its) => ids.map((id) => its.find((i) => i.id === id)!));
    if (catalogId != null)
      api
        .reorderStockItems(catalogId, ids)
        .catch(() => toast.error("Reihenfolge nicht gespeichert"));
  }

  async function saveItem(body: StockItemInput) {
    if (editing) await api.updateStockItem(editing.id, body);
    else await api.addStockItem(catalogId!, body);
    setEditing(null);
    setCreatingItem(false);
    if (catalogId != null) await loadCatalog(catalogId);
    toast.success(editing ? "Artikel gespeichert" : "Artikel angelegt");
  }

  async function newCatalog() {
    const n = await prompt({
      title: "Neuer Katalog",
      label: "Name",
      placeholder: "z. B. Glühweinmeile",
    });
    if (!n) return;
    try {
      const c = await api.createCatalog(n);
      await loadCatalogs();
      setCatalogId(c.id);
      setSelCat(ALL);
      toast.success(`Katalog „${c.name}" angelegt`);
    } catch (e) {
      const msg = e instanceof ApiError ? e.detail : "Fehler";
      setErr(msg);
      toast.error(msg);
    }
  }

  async function duplicateCatalog() {
    if (catalogId == null) return;
    const cur = catalogs.find((c) => c.id === catalogId);
    const n = await prompt({
      title: "Katalog kopieren",
      label: "Name der Kopie",
      initial: cur ? `${cur.name} (Kopie)` : "",
      confirmLabel: "Kopieren",
    });
    if (!n) return;
    try {
      const c = await api.duplicateCatalog(catalogId, n);
      await loadCatalogs();
      setCatalogId(c.id);
      setSelCat(ALL);
      toast.success(`Kopie „${c.name}" angelegt – Preise dort anpassen.`);
    } catch (e) {
      const msg = e instanceof ApiError ? e.detail : "Fehler";
      setErr(msg);
      toast.error(msg);
    }
  }

  async function renameCatalog() {
    if (catalogId == null) return;
    const cur = catalogs.find((c) => c.id === catalogId);
    const n = await prompt({
      title: "Katalog umbenennen",
      label: "Name",
      initial: cur?.name ?? "",
    });
    if (!n) return;
    if (await run(() => api.updateCatalog(catalogId, n), "Umbenannt"))
      await loadCatalogs();
  }

  async function deleteCatalog() {
    if (catalogId == null) return;
    const cur = catalogs.find((c) => c.id === catalogId);
    const ok = await confirm({
      title: "Katalog löschen?",
      danger: true,
      confirmLabel: "Löschen",
      body: `„${cur?.name}" wird mitsamt Kategorien und Artikeln entfernt. Kataloge mit Veranstaltungen lassen sich nicht löschen.`,
    });
    if (!ok) return;
    if (await run(() => api.deleteCatalog(catalogId), "Katalog gelöscht")) {
      setCatalogId(null);
      const cs = await loadCatalogs();
      setCatalogId(cs[0]?.id ?? null);
    }
  }

  async function toggleFavorite(it: StockItem) {
    setItems((its) =>
      its.map((x) =>
        x.id === it.id ? { ...x, is_favorite: !x.is_favorite } : x,
      ),
    );
    try {
      await api.setFavorite(it.id, !it.is_favorite);
    } catch (e) {
      setItems((its) =>
        its.map((x) => (x.id === it.id ? { ...x, is_favorite: it.is_favorite } : x)),
      );
      toast.error(e instanceof ApiError ? e.detail : "Nicht gespeichert");
    }
  }

  async function deactivateItem(it: StockItem) {
    const ok = await confirm({
      title: `„${it.name}" deaktivieren?`,
      danger: true,
      confirmLabel: "Deaktivieren",
      body: "Der Artikel verschwindet aus dem Bedienterminal. Bereits gedruckte Bons bleiben unverändert.",
    });
    if (ok) await run(() => api.deleteStockItem(it.id), "Artikel deaktiviert");
  }

  return (
    <>
      <div className={layout.pageHead}>
        <h1>Katalog</h1>
        <span className={layout.grow} />
        <Button onClick={newCatalog}>Neuer Katalog</Button>
      </div>

      <div className={s.toolbar}>
        <select
          value={catalogId ?? ""}
          onChange={(e) => {
            setCatalogId(Number(e.target.value));
            setSelCat(ALL);
          }}
          aria-label="Katalog wählen"
        >
          {catalogs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {catalogId != null && (
          <>
            <Button small onClick={duplicateCatalog} disabled={busy}>
              <CopySimple size={14} />
              Kopieren
            </Button>
            <Button small onClick={renameCatalog} disabled={busy}>
              Umbenennen
            </Button>
            <Button small variant="danger" onClick={deleteCatalog} disabled={busy}>
              Löschen
            </Button>
          </>
        )}
      </div>
      <ErrorText>{err}</ErrorText>

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Wird geladen …</p>
      ) : catalogId == null ? (
        <p style={{ color: "var(--text-muted)" }}>
          Noch kein Katalog. Mit „Neuer Katalog" anlegen.
        </p>
      ) : (
        <div className={s.cols}>
          <div className={s.catCol}>
            <div className={s.colHead}>
              <h2>Kategorien</h2>
            </div>
            <button
              className={`${s.cat} ${selCat === ALL ? s.sel : ""}`}
              onClick={() => setSelCat(ALL)}
            >
              <span className={s.n}>Alle Artikel</span>
            </button>

            <SortableList items={categories} onReorder={reorderCats}>
              {(c, h) => {
                const Icon = catIcon(c);
                return (
                  <div className={`${s.cat} ${selCat === c.id ? s.sel : ""}`}>
                    <button
                      className={s.mini}
                      {...h.dragProps}
                      aria-label="ziehen zum Sortieren"
                      style={{ cursor: "grab", touchAction: "none" }}
                    >
                      <DotsSixVertical size={14} />
                    </button>
                    <span className={s.catIcon} aria-hidden>
                      <Icon size={19} />
                    </span>
                    <button
                      className={s.n}
                      style={{ background: "none", border: 0 }}
                      onClick={() => setSelCat(c.id)}
                    >
                      {c.name}
                    </button>
                    <button
                      className={s.mini}
                      onClick={() => setEditingCat(c)}
                      aria-label={`Kategorie ${c.name} bearbeiten`}
                      title="Name und Symbol ändern"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      className={s.mini}
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Kategorie „${c.name}" löschen?`,
                          danger: true,
                          confirmLabel: "Löschen",
                          body: "Artikel darin bleiben erhalten, stehen dann aber ohne Kategorie da.",
                        });
                        if (ok)
                          await run(() => api.deleteCategory(c.id), "Kategorie gelöscht");
                      }}
                      aria-label={`Kategorie ${c.name} löschen`}
                    >
                      <Trash size={13} />
                    </button>
                  </div>
                );
              }}
            </SortableList>

            <Button small onClick={() => setCreatingCat(true)} disabled={busy}>
              <Plus size={14} />
              Neue Kategorie
            </Button>
          </div>

          <div className={s.itemCol}>
            <div className={s.colHead}>
              <h2>Artikel</h2>
              <span className={s.grow} />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {favCount} im Schnellzugriff
              </span>
              <Button variant="primary" small onClick={() => setCreatingItem(true)}>
                <Plus size={14} />
                Neuer Artikel
              </Button>
            </div>
            {selCat !== ALL && (
              <p style={{ fontSize: 12, color: "var(--text-dim)" }}>
                Reihenfolge ändern in „Alle Artikel".
              </p>
            )}
            {shownItems.length === 0 && (
              <p style={{ color: "var(--text-muted)" }}>Keine Artikel.</p>
            )}

            <SortableList items={selCat === ALL ? items : []} onReorder={reorderItems}>
              {(it, h) => (
                <ItemRow
                  it={it}
                  handle={h}
                  onEdit={setEditing}
                  onToggleFav={toggleFavorite}
                  onDeactivate={deactivateItem}
                />
              )}
            </SortableList>

            {selCat !== ALL &&
              shownItems.map((it) => (
                <ItemRow
                  key={it.id}
                  it={it}
                  onEdit={setEditing}
                  onToggleFav={toggleFavorite}
                  onDeactivate={deactivateItem}
                />
              ))}
          </div>
        </div>
      )}

      {(editingCat || creatingCat) && catalogId != null && (
        <CategoryEditor
          category={editingCat}
          onClose={() => {
            setEditingCat(null);
            setCreatingCat(false);
          }}
          onSave={async (draft) => {
            if (editingCat) await api.updateCategory(editingCat.id, draft);
            else await api.addCategory(catalogId, draft);
            setEditingCat(null);
            setCreatingCat(false);
            await loadCatalog(catalogId);
            toast.success(editingCat ? "Kategorie gespeichert" : "Kategorie angelegt");
          }}
        />
      )}

      {(editing || creatingItem) && catalogId != null && (
        <ItemEditor
          item={editing}
          categories={categories}
          defaultCategoryId={selCat === ALL ? null : selCat}
          onClose={() => {
            setEditing(null);
            setCreatingItem(false);
          }}
          onSave={saveItem}
        />
      )}

      {dialog}
    </>
  );
}

function ItemRow({
  it,
  handle,
  onEdit,
  onToggleFav,
  onDeactivate,
}: {
  it: StockItem;
  handle?: DragHandle;
  onEdit: (it: StockItem) => void;
  onToggleFav: (it: StockItem) => void;
  onDeactivate: (it: StockItem) => void;
}) {
  const prices = it.variants.map((v) => Number(v.price));
  const range =
    prices.length === 0
      ? "—"
      : Math.min(...prices) === Math.max(...prices)
        ? euro(prices[0])
        : `${euro(Math.min(...prices))}–${euro(Math.max(...prices))}`;
  return (
    <div className={`${s.item} ${it.is_active ? "" : s.inactive}`}>
      {handle && (
        <button
          className={s.mini}
          {...handle.dragProps}
          aria-label="ziehen zum Sortieren"
          style={{ cursor: "grab", touchAction: "none" }}
        >
          <DotsSixVertical size={14} />
        </button>
      )}
      {it.color && (
        <span className={s.itemColor} style={{ background: it.color }} aria-hidden />
      )}
      <div className={s.n}>
        <div className={s.t}>
          {it.name}
          {!it.is_active && " (inaktiv)"}
        </div>
        <div className={s.m}>
          {range} · {it.variants.length} Variante(n)
        </div>
      </div>
      {Number(it.deposit_amount) > 0 && (
        <span className={s.depTag}>Pfand {euro(it.deposit_amount)}</span>
      )}
      <button
        className={`${s.mini} ${it.is_favorite ? s.favTag : ""}`}
        onClick={() => onToggleFav(it)}
        aria-pressed={it.is_favorite}
        aria-label={
          it.is_favorite
            ? `${it.name} aus dem Schnellzugriff nehmen`
            : `${it.name} in den Schnellzugriff legen`
        }
        title="Schnellzugriff"
      >
        <Star size={14} weight={it.is_favorite ? "fill" : "regular"} />
      </button>
      <Button small onClick={() => onEdit(it)} aria-label={`${it.name} bearbeiten`}>
        <Pencil size={14} />
      </Button>
      <Button
        small
        variant="danger"
        disabled={!it.is_active}
        aria-label={`${it.name} deaktivieren`}
        onClick={() => onDeactivate(it)}
      >
        <Trash size={14} />
      </Button>
    </div>
  );
}
