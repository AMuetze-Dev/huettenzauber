import { useEffect, useRef, useState } from "react";
import type { ActiveOrder } from "../api/types";

type State = { order: ActiveOrder | null; connected: boolean };

/**
 * Abonniert /api/active-order/stream. EventSource bricht bei HTTP 409
 * (keine aktive Veranstaltung) hart ab -> wir bauen selbst neu auf.
 */
export function useActiveOrderStream(): State {
  const [state, setState] = useState<State>({ order: null, connected: false });
  const retry = useRef<number>();

  useEffect(() => {
    let closed = false;
    let es: EventSource | null = null;

    const connect = () => {
      if (closed) return;
      es = new EventSource("/api/active-order/stream");
      es.onopen = () => setState((s) => ({ ...s, connected: true }));
      es.onmessage = (ev) => {
        try {
          const order = JSON.parse(ev.data) as ActiveOrder;
          setState({ order, connected: true });
        } catch {
          /* keepalive / unparsbar - ignorieren */
        }
      };
      es.onerror = () => {
        es?.close();
        setState((s) => ({ ...s, connected: false }));
        window.clearTimeout(retry.current);
        retry.current = window.setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      closed = true;
      window.clearTimeout(retry.current);
      es?.close();
    };
  }, []);

  return state;
}
