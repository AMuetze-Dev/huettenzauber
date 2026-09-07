import { useState } from "react";
import { Plus, Trash } from "@phosphor-icons/react";
import type { StockItemInput } from "../api/client";
import type { Category, StockItem } from "../api/types";
import { Button, ErrorText, Field, Modal } from "../components/ui";
import s from "./CatalogAdmin.module.css";

interface Row {
  id?: number | null;
  name: string;
  price: string;
  bill_steps: string;
}

function toRows(item: StockItem | null): Row[] {
  if (!item || item.variants.length === 0)
    return [{ name: "", price: "", bill_steps: "1" }];
  return item.variants.map((v) => ({
    id: v.id,
    name: v.name ?? "",
    price: v.price,
    bill_steps: v.bill_steps,
  }));
}

export function ItemEditor({
  item,
  categories,
  defaultCategoryId,
  onClose,
  onSave,
}: {
  item: StockItem | null;
  categories: Category[];
  defaultCategoryId: number | null;
  onClose: () => void;
  onSave: (body: StockItemInput) => Promise<void>;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [categoryId, setCategoryId] = useState<number | "">(
    item?.category_id ?? defaultCategoryId ?? "",
  );
  const [deposit, setDeposit] = useState(item?.deposit_amount ?? "0");
  const [rows, setRows] = useState<Row[]>(toRows(item));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function patch(i: number, p: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  }

  async function save() {
    if (!name.trim()) {
      setErr("Name darf nicht leer sein");
      return;
    }
    const variants = rows
      .filter((r) => r.price !== "")
      .map((r) => ({
        id: r.id ?? undefined,
        name: r.name.trim() || null,
        price: r.price,
        bill_steps: r.bill_steps || "1",
      }));
    setBusy(true);
    setErr(null);
    try {
      await onSave({
        name: name.trim(),
        category_id: categoryId === "" ? null : Number(categoryId),
        deposit_amount: deposit || "0",
        variants,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fehler");
      setBusy(false);
    }
  }

  return (
    <Modal
      title={item ? "Artikel bearbeiten" : "Neuer Artikel"}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" disabled={busy} onClick={save}>
            Speichern
          </Button>
        </>
      }
    >
      <div className={s.stack}>
        <Field
          label="Name"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Kategorie</span>
          <select
            value={categoryId}
            onChange={(e) =>
              setCategoryId(e.target.value ? Number(e.target.value) : "")
            }
            className={s.toolbar && ""}
            style={{
              minHeight: "var(--touch)",
              padding: "0 12px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "#1a1917",
              color: "var(--text)",
            }}
          >
            <option value="">— ohne Kategorie —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Pfand je Stück (€)"
          type="number"
          step="0.01"
          min="0"
          value={deposit}
          onChange={(e) => setDeposit(e.target.value)}
        />

        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Varianten (Name optional, Preis in €)
        </div>
        {rows.map((r, i) => (
          <div key={i} className={s.variantRow}>
            <input
              placeholder="z. B. 0,5 l"
              value={r.name}
              onChange={(e) => patch(i, { name: e.target.value })}
            />
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Preis"
              value={r.price}
              onChange={(e) => patch(i, { price: e.target.value })}
            />
            <button
              className={s.mini}
              onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
              aria-label="Variante entfernen"
            >
              <Trash size={14} />
            </button>
          </div>
        ))}
        <Button
          small
          onClick={() =>
            setRows((rs) => [...rs, { name: "", price: "", bill_steps: "1" }])
          }
        >
          <Plus size={14} />
          Variante
        </Button>
        <ErrorText>{err}</ErrorText>
      </div>
    </Modal>
  );
}
