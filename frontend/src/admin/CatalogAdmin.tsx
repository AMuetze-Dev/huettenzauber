import { useCallback, useEffect, useMemo, useState } from "react";
import { DotsSixVertical, Pencil, Plus, Trash } from "@phosphor-icons/react";
import { api, ApiError, type StockItemInput } from "../api/client";
import type { Category, Catalog, StockItem } from "../api/types";
import { SortableList, type DragHandle } from "../components/SortableList";
import { Button, ErrorText } from "../components/ui";
import { euro } from "../lib/money";
import layout from "./AdminLayout.module.css";
import s from "./CatalogAdmin.module.css";
import { ItemEditor } from "./ItemEditor";

const ALL = -1;

export default function CatalogAdmin() {
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [catalogId, setCatalogId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [selCat, setSelCat] = useState<number>(ALL);
  const [newCat, setNewCat] = useState("");
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [creatingItem, setCreatingItem] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadCatalogs = useCallback(async () => {
    const cs = await api.catalogs();
    setCatalogs(cs);
    setCatalogId((cur) => cur ?? cs[0]?.id ?? null);
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
    void loadCatalogs();
  }, [loadCatalogs]);
  useEffect(() => {
    if (catalogId != null) void loadCatalog(catalogId);
  }, [catalogId, loadCatalog]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      if (catalogId != null) await loadCatalog(catalogId);
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  const shownItems = useMemo(
    () =>
      items.filter((i) =>
        selCat === ALL ? true : (i.category_id ?? 0) === selCat,
      ),
    [items, selCat],
  );

  function reorderCats(ids: number[]) {
    setCategories((cs) => ids.map((id) => cs.find((c) => c.id === id)!));
    if (catalogId != null) api.reorderCategories(catalogId, ids).catch(() => undefined);
  }

  function reorderItems(ids: number[]) {
    setItems((its) => ids.map((id) => its.find((i) => i.id === id)!));
    if (catalogId != null) api.reorderStockItems(catalogId, ids).catch(() => undefined);
  }

  async function saveItem(body: StockItemInput) {
    if (editing) await api.updateStockItem(editing.id, body);
    else await api.addStockItem(catalogId!, body);
    setEditing(null);
    setCreatingItem(false);
    if (catalogId != null) await loadCatalog(catalogId);
  }

  const handleCls = `${s.mini}`;

  return (
    <>
      <div className={layout.pageHead}>
        <h1>Katalog</h1>
        <span className={layout.grow} />
        <Button
          onClick={async () => {
            const n = prompt("Name des neuen Katalogs");
            if (n && n.trim()) {
              const c = await api.createCatalog(n.trim()).catch((e) => {
                setErr(e instanceof ApiError ? e.detail : "Fehler");
                return null;
              });
              if (c) {
                await loadCatalogs();
                setCatalogId(c.id);
              }
            }
          }}
        >
          Neuer Katalog
        </Button>
      </div>

      <div className={s.toolbar}>
        <select
          value={catalogId ?? ""}
          onChange={(e) => setCatalogId(Number(e.target.value))}
        >
          {catalogs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {catalogId != null && (
          <>
            <Button
              small
              onClick={() => {
                const cur = catalogs.find((c) => c.id === catalogId);
                const n = prompt("Katalog umbenennen", cur?.name);
                if (n && n.trim())
                  run(() => api.updateCatalog(catalogId, n.trim())).then(
                    loadCatalogs,
                  );
              }}
            >
              Umbenennen
            </Button>
            <Button
              small
              variant="danger"
              onClick={() => {
                if (confirm("Katalog löschen?"))
                  run(() => api.deleteCatalog(catalogId)).then(() => {
                    setCatalogId(null);
                    loadCatalogs();
                  });
              }}
            >
              Löschen
            </Button>
          </>
        )}
      </div>
      <ErrorText>{err}</ErrorText>

      {catalogId == null ? (
        <p style={{ color: "var(--text-muted)" }}>Keinen Katalog gewählt.</p>
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
              {(c, h) => (
                <div className={`${s.cat} ${selCat === c.id ? s.sel : ""}`}>
                  <button
                    className={handleCls}
                    {...h.dragProps}
                    aria-label="ziehen zum Sortieren"
                    style={{ cursor: "grab", touchAction: "none" }}
                  >
                    <DotsSixVertical size={14} />
                  </button>
                  <button
                    className={s.n}
                    style={{ background: "none", border: 0 }}
                    onClick={() => setSelCat(c.id)}
                  >
                    {c.name}
                  </button>
                  <button
                    className={s.mini}
                    onClick={() => {
                      const n = prompt("Kategorie umbenennen", c.name);
                      if (n && n.trim())
                        run(() =>
                          api.updateCategory(c.id, {
                            name: n.trim(),
                            icon: c.icon,
                          }),
                        );
                    }}
                    aria-label="umbenennen"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className={s.mini}
                    onClick={() => {
                      if (confirm(`Kategorie "${c.name}" löschen?`))
                        run(() => api.deleteCategory(c.id));
                    }}
                    aria-label="löschen"
                  >
                    <Trash size={13} />
                  </button>
                </div>
              )}
            </SortableList>

            <div className={s.addRow}>
              <input
                placeholder="Neue Kategorie"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
              />
              <Button
                small
                disabled={!newCat.trim() || busy}
                onClick={() =>
                  run(() =>
                    api.addCategory(catalogId, { name: newCat.trim() }),
                  ).then(() => setNewCat(""))
                }
              >
                <Plus size={14} />
              </Button>
            </div>
          </div>

          <div className={s.itemCol}>
            <div className={s.colHead}>
              <h2>Artikel</h2>
              <span className={s.grow} />
              <Button
                variant="primary"
                small
                onClick={() => setCreatingItem(true)}
              >
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

            <SortableList
              items={selCat === ALL ? items : []}
              onReorder={reorderItems}
            >
              {(it, h) => <ItemRow it={it} handle={h} onEdit={setEditing} onDelete={(id) => run(() => api.deleteStockItem(id))} />}
            </SortableList>

            {selCat !== ALL &&
              shownItems.map((it) => (
                <ItemRow
                  key={it.id}
                  it={it}
                  onEdit={setEditing}
                  onDelete={(id) => run(() => api.deleteStockItem(id))}
                />
              ))}
          </div>
        </div>
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
    </>
  );
}

function ItemRow({
  it,
  handle,
  onEdit,
  onDelete,
}: {
  it: StockItem;
  handle?: DragHandle;
  onEdit: (it: StockItem) => void;
  onDelete: (id: number) => void;
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
      <Button small onClick={() => onEdit(it)}>
        <Pencil size={14} />
      </Button>
      <Button
        small
        variant="danger"
        disabled={!it.is_active}
        onClick={() => {
          if (confirm(`"${it.name}" deaktivieren?`)) onDelete(it.id);
        }}
      >
        <Trash size={14} />
      </Button>
    </div>
  );
}
