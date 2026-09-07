import type { ReactNode } from "react";
import styles from "./Topbar.module.css";

export function Topbar({
  subtitle = "Landgasthof Zum Ross, Diesbar · Ausschank",
  children,
}: {
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.topbar}>
      <img src="/logo-zum-ross.svg" alt="Landgasthof Zum Ross" />
      <div className={styles.sep} />
      <span className={styles.place}>{subtitle}</span>
      <span className={styles.grow} />
      {children}
    </div>
  );
}
