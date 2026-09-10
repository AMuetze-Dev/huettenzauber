import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GuestDisplay from "./GuestDisplay";

class FakeEventSource {
  onopen: (() => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {}
  close() {}
}

function order(lines: [number, number][], over: Record<string, unknown> = {}) {
  return {
    event_id: 1,
    updated_at: "2026-01-01T00:00:00Z",
    revision: 1,
    lines: lines.map(([id, qty]) => ({
      item_variant_id: id,
      quantity: qty.toFixed(3),
    })),
    deposit_returns: [],
    total_gross: "0.00",
    total_deposit: "0.00",
    deposit_return_total: "0.00",
    total_due: "0.00",
    ...over,
  };
}

describe("GuestDisplay", () => {
  beforeEach(() => {
    vi.stubGlobal("EventSource", FakeEventSource as unknown as typeof EventSource);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("zeigt den Willkommens-Leerzustand, solange kein Event kommt", () => {
    render(<GuestDisplay />);
    expect(screen.getByText("Willkommen")).toBeInTheDocument();
  });

  it("rendert Positionen + Gesamt aus einem SSE-Event", () => {
    let es: FakeEventSource | null = null;
    vi.stubGlobal(
      "EventSource",
      class extends FakeEventSource {
        constructor(url: string) {
          super(url);
          es = this;
        }
      } as unknown as typeof EventSource,
    );

    render(<GuestDisplay />);
    act(() => {
      es!.onmessage!({
        data: JSON.stringify({
          event_id: 1,
          updated_at: "2026-01-01T00:00:00Z",
          revision: 1,
          lines: [{ item_variant_id: 9, quantity: "2.000" }],
          deposit_returns: [],
          total_gross: "9.00",
          total_deposit: "4.00",
          deposit_return_total: "0.00",
          total_due: "13.00",
        }),
      } as MessageEvent);
    });

    expect(screen.getByText("13,00 €")).toBeInTheDocument();
    expect(screen.getByText("2×")).toBeInTheDocument();
  });

  it("zeigt Pfand- und Pfandrückgabe-Zeilen nur wenn > 0", () => {
    let es: FakeEventSource | null = null;
    vi.stubGlobal(
      "EventSource",
      class extends FakeEventSource {
        constructor(url: string) {
          super(url);
          es = this;
        }
      } as unknown as typeof EventSource,
    );
    render(<GuestDisplay />);
    act(() => {
      es!.onmessage!({
        data: JSON.stringify({
          event_id: 1,
          updated_at: "2026-01-01T00:00:00Z",
          revision: 1,
          lines: [{ item_variant_id: 5, quantity: "1.000" }],
          deposit_returns: [
            { unit_amount: "2.00", quantity: 3, total_amount: "6.00" },
          ],
          total_gross: "4.50",
          total_deposit: "2.00",
          deposit_return_total: "6.00",
          total_due: "0.50",
        }),
      } as MessageEvent);
    });
    expect(screen.getByText("Pfand")).toBeInTheDocument();
    expect(screen.getByText("Pfandrückgabe")).toBeInTheDocument();
  });

  it("mehr Positionen als Platz: der Rest wird zusammengefasst", () => {
    let es: FakeEventSource | null = null;
    vi.stubGlobal(
      "EventSource",
      class extends FakeEventSource {
        constructor(url: string) {
          super(url);
          es = this;
        }
      } as unknown as typeof EventSource,
    );
    render(<GuestDisplay />);
    const lines = Array.from({ length: 10 }, (_, i) => ({
      item_variant_id: i + 1,
      quantity: "1.000",
    }));
    act(() => {
      es!.onmessage!({
        data: JSON.stringify({
          event_id: 1,
          updated_at: "2026-01-01T00:00:00Z",
          revision: 1,
          lines,
          deposit_returns: [],
          total_gross: "10.00",
          total_deposit: "0.00",
          deposit_return_total: "0.00",
          total_due: "10.00",
        }),
      } as MessageEvent);
    });
    // Ohne ResizeObserver (jsdom) greift die Startannahme von sieben Zeilen;
    // der Hinweis kostet selbst eine, also bleiben sechs sichtbar.
    expect(screen.getByText(/\+ 4 weitere Positionen/)).toBeInTheDocument();
  });

  it("unbekannte Varianten-ID fällt auf 'Artikel N' zurück", () => {
    let es: FakeEventSource | null = null;
    vi.stubGlobal(
      "EventSource",
      class extends FakeEventSource {
        constructor(url: string) {
          super(url);
          es = this;
        }
      } as unknown as typeof EventSource,
    );
    render(<GuestDisplay />);
    act(() => {
      es!.onmessage!({
        data: JSON.stringify({
          event_id: 1,
          updated_at: "2026-01-01T00:00:00Z",
          revision: 1,
          lines: [{ item_variant_id: 404, quantity: "1.000" }],
          deposit_returns: [],
          total_gross: "0.00",
          total_deposit: "0.00",
          deposit_return_total: "0.00",
          total_due: "0.00",
        }),
      } as MessageEvent);
    });
    expect(screen.getByText("Artikel 404")).toBeInTheDocument();
  });

  it("keepalive / unparsbare Nachricht ändert nichts", () => {
    let es: FakeEventSource | null = null;
    vi.stubGlobal(
      "EventSource",
      class extends FakeEventSource {
        constructor(url: string) {
          super(url);
          es = this;
        }
      } as unknown as typeof EventSource,
    );
    render(<GuestDisplay />);
    act(() => {
      es!.onmessage!({ data: ": keepalive" } as MessageEvent);
    });
    expect(screen.getByText("Willkommen")).toBeInTheDocument();
  });

  describe("frisch gebuchte Position", () => {
    function mitStream() {
      let es: FakeEventSource | null = null;
      vi.stubGlobal(
        "EventSource",
        class extends FakeEventSource {
          constructor(url: string) {
            super(url);
            es = this;
          }
        } as unknown as typeof EventSource,
      );
      render(<GuestDisplay />);
      return {
        push: (o: unknown) =>
          act(() => {
            es!.onmessage!({ data: JSON.stringify(o) } as MessageEvent);
          }),
      };
    }

    const zeileVon = (text: string) =>
      screen.getByText(text).closest("div")!;

    it("der erste Aufbau hebt nichts hervor", () => {
      const { push } = mitStream();
      push(order([[5, 1]]));
      expect(zeileVon("1×").className).not.toMatch(/fresh/);
    });

    it("eine erhöhte Menge wird kurz hinterlegt", () => {
      const { push } = mitStream();
      push(order([[5, 1]]));
      push(order([[5, 2]], { revision: 2 }));
      expect(zeileVon("2×").className).toMatch(/fresh/);
    });

    it("unveränderte Positionen bleiben ruhig", () => {
      const { push } = mitStream();
      push(order([[5, 1], [6, 1]]));
      push(order([[5, 1], [6, 3]], { revision: 2 }));
      expect(zeileVon("3×").className).toMatch(/fresh/);
      expect(zeileVon("1×").className).not.toMatch(/fresh/);
    });

    it("die Hervorhebung verschwindet von selbst", () => {
      vi.useFakeTimers();
      try {
        const { push } = mitStream();
        push(order([[5, 1]]));
        push(order([[5, 2]], { revision: 2 }));
        expect(zeileVon("2×").className).toMatch(/fresh/);
        act(() => void vi.advanceTimersByTime(1500));
        expect(zeileVon("2×").className).not.toMatch(/fresh/);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
