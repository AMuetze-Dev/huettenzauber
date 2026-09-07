import { useState } from "react";
import { Plus, Star, Trash } from "@phosphor-icons/react";
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

/** Warme Tafel passend zur Palette - Farbe ist Zusatz, nie einzige Information. */
const COLORS = [
  "#c8a875",
  "#b5763f",
  "#8f5b47",
  "#7d8f5b",
  "#5b7d8f",
  "#8f5b7d",
  "#a8a29a",
  "#6b6560",
];

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
  const [favorite, setFavorite] = useState(item?.is_favorite ?? false);
  const [color, setColor] = useState<string | null>(item?.color ?? null);
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
    if (variants.length === 0) {
      setErr("Mindestens eine Variante mit Preis angeben");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSave({
        name: name.trim(),
        category_id: categoryId === "" ? null : Number(categoryId),
        deposit_amount: deposit || "0",
        is_favorite: favorite,
        color,
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
        <label className={s.selectField}>
          <span>Kategorie</span>
          <select
            value={categoryId}
            onChange={(e) =>
              setCategoryId(e.target.value ? Number(e.target.value) : "")
            }
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
          inputMode="decimal"
          step="0.01"
          min="0"
          value={deposit}
          onChange={(e) => setDeposit(e.target.value)}
        />

        <button
          type="button"
          className={`${s.favToggle} ${favorite ? s.favOn : ""}`}
          onClick={() => setFavorite((f) => !f)}
          aria-pressed={favorite}
        >
          <Star size={18} weight={favorite ? "fill" : "regular"} />
          <span>
            <b>Schnellzugriff</b>
            <small>
              {favorite
                ? "Liegt oben im Bedienterminal – ein Tipp, kein Suchen."
                : "Artikel zusätzlich in die oberste Leiste legen."}
            </small>
          </span>
        </button>

        <div className={s.colorField}>
          <span className={s.fieldLabel}>Farbe (optional)</span>
          <div className={s.colorRow}>
            <button
              type="button"
              className={`${s.swatch} ${s.noColor} ${color === null ? s.swatchSel : ""}`}
              onClick={() => setColor(null)}
              aria-label="keine Farbe"
              aria-pressed={color === null}
            />
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`${s.swatch} ${color === c ? s.swatchSel : ""}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={`Farbe ${c}`}
                aria-pressed={color === c}
              />
            ))}
          </div>
        </div>

        <div className={s.fieldLabel}>Varianten (Name optional, Preis in €)</div>
        {rows.map((r, i) => (
          <div key={i} className={s.variantRow}>
            <input
              placeholder="z. B. 0,5 l"
              value={r.name}
              onChange={(e) => patch(i, { name: e.target.value })}
            />
            <input
              type="number"
              inputMode="decimal"
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
              disabled={rows.length === 1}
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
