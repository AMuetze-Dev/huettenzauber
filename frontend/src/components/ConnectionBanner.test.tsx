import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import { ConnectionBanner } from "./ConnectionBanner";

const TEXT = /Keine Verbindung zur Kasse/;

function ok(body: unknown = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ConnectionBanner", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("ist unsichtbar, solange die Kasse antwortet", async () => {
    vi.mocked(fetch).mockResolvedValue(ok([]));
    render(<ConnectionBanner />);
    await act(async () => void (await api.catalogs()));
    expect(screen.queryByText(TEXT)).toBeNull();
  });

  it("erscheint, sobald eine Anfrage das Backend nicht erreicht", async () => {
    render(<ConnectionBanner />);
    vi.mocked(fetch).mockRejectedValue(new TypeError("network"));
    await act(async () => void (await api.catalogs().catch(() => undefined)));
    await waitFor(() => expect(screen.getByText(TEXT)).toBeInTheDocument());
  });

  it("verschwindet wieder, sobald das Backend antwortet", async () => {
    render(<ConnectionBanner />);
    vi.mocked(fetch).mockRejectedValue(new TypeError("network"));
    await act(async () => void (await api.catalogs().catch(() => undefined)));
    await waitFor(() => expect(screen.getByText(TEXT)).toBeInTheDocument());

    vi.mocked(fetch).mockResolvedValue(ok([]));
    await act(async () => void (await api.catalogs()));
    await waitFor(() => expect(screen.queryByText(TEXT)).toBeNull());
  });

  it("ein HTTP-Fehler ist kein Verbindungsausfall", async () => {
    render(<ConnectionBanner />);
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ detail: "kaputt" }), { status: 500 }),
    );
    await act(async () => void (await api.catalogs().catch(() => undefined)));
    expect(screen.queryByText(TEXT)).toBeNull();
  });

  it("meldet sich als Warnung an", async () => {
    render(<ConnectionBanner />);
    vi.mocked(fetch).mockRejectedValue(new TypeError("network"));
    await act(async () => void (await api.catalogs().catch(() => undefined)));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });
});
