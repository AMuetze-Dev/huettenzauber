import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle, Info, Warning, X } from "@phosphor-icons/react";
import s from "./Toast.module.css";

type Kind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: Kind;
  text: string;
}

interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

const ICONS: Record<Kind, typeof Info> = {
  success: CheckCircle,
  error: Warning,
  info: Info,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (kind: Kind, text: string) => {
      const id = next.current++;
      setToasts((t) => [...t, { id, kind, text }]);
      window.setTimeout(() => remove(id), kind === "error" ? 7000 : 3500);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (t) => push("success", t),
      error: (t) => push("error", t),
      info: (t) => push("info", t),
    }),
    [push],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className={s.stack} role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.kind];
          return (
            <div key={t.id} className={`${s.toast} ${s[t.kind] ?? ""}`}>
              <Icon size={18} weight="fill" className={s.icon} />
              <div className={s.body}>{t.text}</div>
              <button
                className={s.close}
                onClick={() => remove(t.id)}
                aria-label="Meldung schließen"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast muss innerhalb von ToastProvider stehen");
  return ctx;
}
