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
          lines: [{ item_variant_id: 9, quantity: "2.000" }],
          deposit_return_unit_amount: null,
          deposit_return_quantity: null,
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
});
