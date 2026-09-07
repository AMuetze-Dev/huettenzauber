import { useEffect, useState } from "react";
import { WifiSlash } from "@phosphor-icons/react";
import { onConnectionChange } from "../api/client";
import s from "./ConnectionBanner.module.css";

/**
 * Sichtbarer Streifen, sobald das Backend nicht antwortet. Vorher scheiterten
 * Anfragen still (`.catch(() => undefined)`) - am Ausschank sieht man dann
 * nicht, dass nichts mehr ankommt.
 */
export function ConnectionBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => onConnectionChange(setOnline), []);

  if (online) return null;
  return (
    <div className={s.bar} role="alert">
      <WifiSlash size={18} weight="fill" />
      <span>
        Keine Verbindung zur Kasse. Eingaben werden nicht gespeichert – kurz
        warten, die Verbindung baut sich selbst wieder auf.
      </span>
    </div>
  );
}
