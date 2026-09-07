import { useCallback, useRef, useState, type ReactNode } from "react";
import { Button, Field, Modal } from "./ui";

interface ConfirmOpts {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}
interface PromptOpts {
  title: string;
  label: string;
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
}

type Pending =
  | { kind: "confirm"; opts: ConfirmOpts }
  | { kind: "prompt"; opts: PromptOpts };

/**
 * Ersetzt window.confirm / window.prompt durch getemperte Modals.
 * Rueckgabe: { confirm, prompt, dialog } - `dialog` ins JSX haengen.
 */
export function useDialogs() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [value, setValue] = useState("");
  const resolver = useRef<((v: unknown) => void) | null>(null);

  const finish = useCallback((result: unknown) => {
    resolver.current?.(result);
    resolver.current = null;
    setPending(null);
  }, []);

  const confirm = useCallback((opts: ConfirmOpts) => {
    setPending({ kind: "confirm", opts });
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve as (v: unknown) => void;
    });
  }, []);

  const prompt = useCallback((opts: PromptOpts) => {
    setValue(opts.initial ?? "");
    setPending({ kind: "prompt", opts });
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve as (v: unknown) => void;
    });
  }, []);

  let dialog: ReactNode = null;
  if (pending?.kind === "confirm") {
    const o = pending.opts;
    dialog = (
      <Modal
        title={o.title}
        onClose={() => finish(false)}
        actions={
          <>
            <Button onClick={() => finish(false)}>Abbrechen</Button>
            <Button
              variant={o.danger ? "danger" : "primary"}
              autoFocus
              onClick={() => finish(true)}
            >
              {o.confirmLabel ?? "Bestätigen"}
            </Button>
          </>
        }
      >
        {o.body && <div style={{ lineHeight: 1.5 }}>{o.body}</div>}
      </Modal>
    );
  } else if (pending?.kind === "prompt") {
    const o = pending.opts;
    dialog = (
      <Modal
        title={o.title}
        onClose={() => finish(null)}
        actions={
          <>
            <Button onClick={() => finish(null)}>Abbrechen</Button>
            <Button
              variant="primary"
              disabled={!value.trim()}
              onClick={() => finish(value.trim())}
            >
              {o.confirmLabel ?? "Speichern"}
            </Button>
          </>
        }
      >
        <Field
          label={o.label}
          value={value}
          autoFocus
          placeholder={o.placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) finish(value.trim());
          }}
        />
      </Modal>
    );
  }

  return { confirm, prompt, dialog };
}
