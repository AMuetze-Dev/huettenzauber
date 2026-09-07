import { useState } from "react";
import type { Category } from "../api/types";
import { Button, ErrorText, Field, Modal } from "../components/ui";
import { CATEGORY_ICONS, iconKeyFor } from "../order/catIcon";
import s from "./CatalogAdmin.module.css";

export interface CategoryDraft {
  name: string;
  icon: string;
}

/**
 * Name UND Symbol in einem Dialog. Am Ausschank wird auf das Bild getippt,
 * nicht gelesen - deshalb steht die Symbolwahl gleichberechtigt neben dem
 * Namen und nicht in einem Untermenü.
 */
export function CategoryEditor({
  category,
  onClose,
  onSave,
}: {
  category: Category | null;
  onClose: () => void;
  onSave: (draft: CategoryDraft) => Promise<void>;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState(
    category ? iconKeyFor(category) : CATEGORY_ICONS[0].key,
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const Preview = (CATEGORY_ICONS.find((c) => c.key === icon) ?? CATEGORY_ICONS[0]).Icon;

  async function save() {
    if (!name.trim()) {
      setErr("Name darf nicht leer sein");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSave({ name: name.trim(), icon });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fehler");
      setBusy(false);
    }
  }

  return (
    <Modal
      title={category ? "Kategorie bearbeiten" : "Neue Kategorie"}
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
        <div className={s.iconPreview}>
          <span className={s.iconPreviewTile}>
            <Preview size={30} />
          </span>
          <div>
            <div className={s.iconPreviewName}>{name || "Kategorie"}</div>
            <div className={s.iconPreviewHint}>
              So erscheint die Kategorie am Bedienterminal.
            </div>
          </div>
        </div>

        <Field
          label="Name"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Warme Getränke"
        />

        <div className={s.fieldLabel}>Symbol</div>
        <div className={s.iconGrid} role="radiogroup" aria-label="Symbol">
          {CATEGORY_ICONS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={icon === key}
              aria-label={label}
              title={label}
              className={`${s.iconChoice} ${icon === key ? s.iconChoiceSel : ""}`}
              onClick={() => setIcon(key)}
            >
              <Icon size={22} />
            </button>
          ))}
        </div>
        <ErrorText>{err}</ErrorText>
      </div>
    </Modal>
  );
}
