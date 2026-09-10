/**
 * Stil-Regeln, die in jsdom nicht prüfbar sind, aber am Tresen zählen.
 *
 * jsdom rechnet kein Layout: ob eine Kachel höher ist als ihre Klickfläche,
 * sieht man dort nie. Der Fehler war real - klappte ein Artikel seine Größen
 * auf, wurden die Nachbarkacheln in derselben Rasterzeile mitgestreckt, ihr
 * Knopf blieb aber inhaltshoch. Unten sah es nach Kachel aus und tat nichts.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// `?raw` scheidet aus: bei einer .module.css liefert Vite das Klassen-Objekt,
// nicht den Quelltext. Der Pfad haengt an dieser Datei statt an
// `process.cwd()` - sonst findet der Test nichts mehr, sobald vitest aus einem
// anderen Verzeichnis gestartet wird. Ueber `import.meta.dirname` und nicht
// ueber `new URL(..., import.meta.url)`: unter jsdom ist `URL` die des
// Browsers, und `fileURLToPath` weist die zurueck.
const hier = (import.meta as unknown as { dirname: string }).dirname;
const css = readFileSync(resolve(hier, "OrderTerminal.module.css"), "utf-8");

/** Inhalt eines Regelblocks, ohne verschachtelte Blöcke. */
function regel(selektor: string): string {
  const i = css.indexOf(`\n${selektor} {`);
  expect(i, `Regel ${selektor} fehlt`).toBeGreaterThan(-1);
  return css.slice(i, css.indexOf("}", i));
}

describe("Kachel: Klickfläche deckt die Sichtfläche", () => {
  it("der Knopf füllt die Kachel aus", () => {
    expect(regel(".cardBtn")).toMatch(/flex:\s*1\b/);
  });

  it("das Polster sitzt im Knopf, nicht in der Kachel", () => {
    expect(regel(".cardBtn")).toMatch(/padding:\s*\d/);
    expect(regel(".card")).toMatch(/padding:\s*0\b/);
  });

  it("die Kachel ist der Anker für das Mengen-Abzeichen", () => {
    expect(regel(".card")).toMatch(/position:\s*relative/);
  });

  it("das Abzeichen in der Kachel liegt innen", () => {
    // `overflow: hidden` an der Kachel würde einen negativen Versatz kappen.
    expect(regel(".card")).toMatch(/overflow:\s*hidden/);
    expect(regel(".card > .badge,\n.cardBtn .badge")).toMatch(/top:\s*8px/);
  });

  it("Schnellzugriff und Größen-Chips behalten das überhängende Abzeichen", () => {
    expect(regel(".badge")).toMatch(/top:\s*-4px/);
    expect(regel(".fav")).toMatch(/position:\s*relative/);
    expect(regel(".chip")).toMatch(/position:\s*relative/);
  });

  it("die Größen-Chips bringen ihr eigenes Polster mit", () => {
    // Sonst kleben sie am Kachelrand, seit die Kachel keines mehr hat.
    expect(regel(".chips")).toMatch(/padding:\s*\d+px \d+px \d+px/);
  });
});
