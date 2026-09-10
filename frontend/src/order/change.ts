/**
 * Rückgeld am Tresen.
 *
 * Gäste legen selten den nächsthöheren Schein hin: bei 40,30 € kommen auch
 * mal 45 € oder 42 €. Eingetippt wird deshalb der Betrag, den der Gast
 * hinlegt; die Vorschläge hier sparen nur die häufigsten Fälle ein.
 */

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
