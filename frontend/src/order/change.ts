/**
 * Rückgeld am Tresen.
 *
 * Gäste legen selten den nächsthöheren Schein hin: bei 40,30 € kommen auch
 * mal 45 € oder 42 €. Der Bediener soll deshalb die Stückelung antippen
 * können, die tatsächlich auf dem Tresen liegt, statt einen Betrag zu suchen.
 */

/** Scheine, die am Ausschank wirklich über den Tresen gehen. */
export const NOTES = [50, 20, 10, 5] as const;

/** Münzen. Kleiner als 50 ct kommt beim Kassieren nicht vor - dafür gibt es
 *  die freie Eingabe. */
export const COINS = [2, 1, 0.5] as const;

/** Beides zusammen, absteigend - für Tests und Summenlogik. */
export const DENOMINATIONS = [...NOTES, ...COINS] as const;

const CENT = 0.005;

/** Auf ganze Cent runden - gegen Fließkomma-Reste beim Aufaddieren. */
export function cents(value: number): number {
  return Math.round(value * 100) / 100;
}

function ceilTo(value: number, step: number): number {
  return cents(Math.ceil((value + CENT) / step) * step);
}

/**
 * Bis zu drei Beträge, die ein Gast bei dieser Summe typischerweise hinlegt:
 * die nächste Fünfer-, die nächste Zehnerstufe und der nächste Schein.
 * Immer echt größer als der fällige Betrag - der passende Betrag steht im
 * Dialog schon als eigener Knopf.
 */
export function changeSuggestions(due: number): number[] {
  if (due <= 0) return [];
  const naechsterSchein = [5, 10, 20, 50, 100].find((n) => n > due + CENT);

  // Reihenfolge = Wahrscheinlichkeit am Tresen: erst die nächste Fünferstufe,
  // dann der nächste Schein, dann die Zehnerstufe, dann noch fünf Euro mehr.
  const kandidaten = [...new Set([
    ceilTo(due, 5),
    naechsterSchein ?? ceilTo(due, 50),
    ceilTo(due, 10),
    ceilTo(due, 5) + 5,
  ])];

  // Ein 100er für 52,80 € kommt nicht vor: mehr als etwa 20 € Rückgeld gibt
  // niemand heraus, ohne vorher zu fragen.
  const grenze = due + 20 + CENT;
  const plausibel = kandidaten.filter((v) => v <= grenze);
  const rest = kandidaten.filter((v) => v > grenze);

  return [...plausibel, ...rest].slice(0, 2).sort((a, b) => a - b);
}
