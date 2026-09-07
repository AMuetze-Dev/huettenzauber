import type { ReactNode } from "react";
import styles from "./Topbar.module.css";

export function Topbar({
  subtitle = "Landgasthof Diesbar · Ausschank",
  children,
}: {
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.topbar}>
      <img src="/logo-zum-ross.svg" alt="Zum Roß" />
      <div className={styles.sep} />
      <span className={styles.place}>{subtitle}</span>
      <span className={styles.grow} />
      {children}
    </div>
  );
}
