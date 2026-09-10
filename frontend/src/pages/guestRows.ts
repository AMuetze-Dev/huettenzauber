/**
 * Wie viele Positionen passen auf das 7"-Kundendisplay?
 *
 * Vorher standen dort fest sieben Zeilen - bei acht Positionen erschien
 * "+ 1 weitere", obwohl der halbe Bildschirm leer war. Jetzt entscheidet der
 * tatsächlich vorhandene Platz.
 */

/** Nur der Notnagel, falls die CSS-Variable nicht lesbar ist. */
export const FALLBACK_LINE_HEIGHT = 48;

/** Höhe des Hinweises "+ n weitere Positionen" (siehe `.more` in der CSS). */
export const MORE_HEIGHT = 30;

export interface RowFit<T> {
  /** Die Positionen, die gezeigt werden - die zuletzt getippten. */
  shown: T[];
  /** Wie viele nicht mehr aufs Display passen (0 = alle sichtbar). */
  hidden: number;
}

/**
 * Schneidet erst ab, wenn es wirklich nicht mehr passt - und rechnet dabei
 * ein, dass der Hinweis selbst eine Zeile kostet.
 */
export function fitRows<T>(
  rows: T[],
  availableHeight: number,
  lineHeight: number = FALLBACK_LINE_HEIGHT,
): RowFit<T> {
  const zeile = lineHeight > 0 ? lineHeight : FALLBACK_LINE_HEIGHT;
  const passen = Math.max(1, Math.floor(availableHeight / zeile));
  if (rows.length <= passen) return { shown: rows, hidden: 0 };

  const mitHinweis = Math.max(
    1,
    Math.floor((availableHeight - MORE_HEIGHT) / zeile),
  );
  return {
    shown: rows.slice(rows.length - mitHinweis),
    hidden: rows.length - mitHinweis,
  };
}
