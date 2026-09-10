import { Backspace } from "@phosphor-icons/react";
import s from "./NumPad.module.css";

const MAX_LEN = 12;

/**
 * Zehnertastatur fuer die Touch-Terminals - am Pi haengt keine Tastatur.
 * `value` ist ein roher String ("12.50"), damit Zwischenstaende wie "12." gehen.
 * `decimals=false` liefert eine reine Ziffernfolge (PIN, Stueckzahl) - dort
 * bleibt eine fuehrende Null erhalten.
 */
export function NumPad({
  value,
  onChange,
  unit = "€",
  decimals = true,
  masked = false,
  placeholder = "0",
}: {
  value: string;
  onChange: (next: string) => void;
  unit?: string;
  decimals?: boolean;
  masked?: boolean;
  placeholder?: string;
}) {
  function push(ch: string) {
    if (value.length >= MAX_LEN) return;
    if (ch === ".") {
      if (!decimals || value.includes(".")) return;
      return onChange(value === "" ? "0." : value + ".");
    }
    // hoechstens zwei Nachkommastellen
    const [, frac] = value.split(".");
    if (frac !== undefined && frac.length >= 2) return;
    // fuehrende Null nur bei Betraegen schlucken, nicht bei Codes
    const base = decimals && value === "0" ? "" : value;
    onChange(base + ch);
  }

  // Angezeigt wird deutsch: die Taste heisst "," und der ganze Rest des
  // Programms schreibt 12,50 - ein Punkt im Feld liest sich wie ein Tippfehler.
  const shown =
    value === ""
      ? placeholder
      : masked
        ? "•".repeat(value.length)
        : value.replace(".", ",");
  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3"];

  return (
    <div className={s.wrap}>
      <div className={s.display} data-empty={value === "" ? "" : undefined}>
        <span className={s.val}>{shown}</span>
        {unit && <span className={s.unit}>{unit}</span>}
      </div>
      <div className={s.grid}>
        {keys.map((k) => (
          <button key={k} className={s.key} onClick={() => push(k)} type="button">
            {k}
          </button>
        ))}
        {decimals ? (
          <button
            className={s.key}
            onClick={() => push(".")}
            type="button"
            aria-label="Komma"
          >
            ,
          </button>
        ) : (
          <button
            className={`${s.key} ${s.muted}`}
            onClick={() => onChange("")}
            type="button"
            aria-label="Eingabe löschen"
          >
            C
          </button>
        )}
        <button className={s.key} onClick={() => push("0")} type="button">
          0
        </button>
        <button
          className={s.key}
          onClick={() => onChange(value.slice(0, -1))}
          type="button"
          aria-label="Zeichen löschen"
        >
          <Backspace size={22} />
        </button>
      </div>
    </div>
  );
}
