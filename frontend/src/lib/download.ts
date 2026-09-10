import type { PdfDownload } from "../api/client";

/** Legt eine geholte Datei im Download-Ordner des Browsers ab.
 *
 * Umweg über einen Blob-Link, weil der Endpunkt den Zugangscode im Kopf
 * erwartet – ein direkter Link auf die URL käme ohne ihn an.
 */
export function saveFile({ blob, filename }: PdfDownload): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Erst freigeben, wenn der Browser den Download übernommen hat.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
