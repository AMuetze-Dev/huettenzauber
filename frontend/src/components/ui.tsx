import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { X } from "@phosphor-icons/react";
import s from "./ui.module.css";

type Variant = "default" | "primary" | "danger";

export function Button({
  variant = "default",
  small,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  small?: boolean;
}) {
  const cls = [
    s.btn,
    variant === "primary" && s.primary,
    variant === "danger" && s.danger,
    small && s.small,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <button className={cls} {...rest} />;
}

export function Field({
  label,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={s.field}>
      <span>{label}</span>
      <input className={s.input} {...rest} />
    </label>
  );
}

export function Modal({
  title,
  onClose,
  children,
  actions,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={s.backdrop} onClick={onClose}>
      <div
        className={s.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={s.dialogHead}>
          <h2>{title}</h2>
          <Button small aria-label="Schließen" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>
        {children}
        {actions && <div className={s.dialogActions}>{actions}</div>}
      </div>
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <p className={s.err}>{children}</p> : null;
}
