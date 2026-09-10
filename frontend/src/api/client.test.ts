import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  ApiError,
  getAccessCode,
  onConnectionChange,
  setAccessCode,
} from "./client";

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function lastCall() {
  const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
  return fetchMock.mock.calls.at(-1) as [string, RequestInit];
}

function headerOf(name: string): string | undefined {
  const init = lastCall()[1];
  return (init.headers as Record<string, string>)[name];
}

describe("api client", () => {
  beforeEach(() => {
    setAccessCode("");
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    setAccessCode("");
  });

  it("baut die URL unter /api", async () => {
    (fetch as never as ReturnType<typeof vi.fn>).mockResolvedValue(ok({ status: "ok" }));
    await api.health();
    expect(lastCall()[0]).toBe("/api/health");
  });

  it("hängt keinen Zugangscode an, solange keiner gesetzt ist", async () => {
    (fetch as never as ReturnType<typeof vi.fn>).mockResolvedValue(ok({}));
    await api.catalogs();
    expect(headerOf("X-Access-Code")).toBeUndefined();
  });

  it("schickt den gespeicherten Zugangscode mit", async () => {
    setAccessCode("4711");
    (fetch as never as ReturnType<typeof vi.fn>).mockResolvedValue(ok({}));
    await api.catalogs();
    expect(headerOf("X-Access-Code")).toBe("4711");
  });

  it("merkt sich den Code über Aufrufe hinweg", () => {
    setAccessCode("99");
    expect(getAccessCode()).toBe("99");
    setAccessCode("");
    expect(getAccessCode()).toBe("");
  });

  it("access-check prüft einen Code, ohne ihn zu speichern", async () => {
    (fetch as never as ReturnType<typeof vi.fn>).mockResolvedValue(
      ok({ required: true, valid: false }),
    );
    await api.accessCheck("1234");
    expect(headerOf("X-Access-Code")).toBe("1234");
    expect(getAccessCode()).toBe("");
  });

  it("wirft ApiError mit Status und Detail des Servers", async () => {
    (fetch as never as ReturnType<typeof vi.fn>).mockResolvedValue(
      ok({ detail: "Katalog nicht gefunden" }, 404),
    );
    await expect(api.catalogs()).rejects.toMatchObject({
      status: 404,
      detail: "Katalog nicht gefunden",
    });
  });

  it("fängt einen nicht-string detail ab (Pydantic-Fehlerliste)", async () => {
    (fetch as never as ReturnType<typeof vi.fn>).mockResolvedValue(
      ok({ detail: [{ loc: ["body"], msg: "kaputt" }] }, 422),
    );
    await expect(api.catalogs()).rejects.toMatchObject({
      status: 422,
      detail: "Ungültige Eingabe",
    });
  });

  it("markiert Netzwerkausfall als isOffline", async () => {
    (fetch as never as ReturnType<typeof vi.fn>).mockRejectedValue(new TypeError("fail"));
    const err = await api.catalogs().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.isOffline).toBe(true);
    expect(err.status).toBe(0);
  });

  it("HTTP-Fehler ist NICHT offline – der Server hat ja geantwortet", async () => {
    (fetch as never as ReturnType<typeof vi.fn>).mockResolvedValue(ok({ detail: "x" }, 500));
    const err = await api.catalogs().catch((e) => e);
    expect(err.isOffline).toBe(false);
  });

  it("204 liefert undefined statt JSON-Parsefehler", async () => {
    (fetch as never as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    await expect(api.deleteCatalog(1)).resolves.toBeUndefined();
  });

  it("leerer Body mit 200 kippt nicht", async () => {
    (fetch as never as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("", { status: 200 }),
    );
    await expect(api.catalogs()).resolves.toBeUndefined();
  });

  it("activeEvent liefert null statt Fehler, wenn nichts läuft", async () => {
    (fetch as never as ReturnType<typeof vi.fn>).mockResolvedValue(
      ok({ detail: "keine" }, 404),
    );
    await expect(api.activeEvent()).resolves.toBeNull();
  });

  it("activeEvent reicht andere Fehler durch", async () => {
    (fetch as never as ReturnType<typeof vi.fn>).mockResolvedValue(
      ok({ detail: "kaputt" }, 500),
    );
    await expect(api.activeEvent()).rejects.toBeInstanceOf(ApiError);
  });

  it("Tagesabschluss schickt keinen Zählbetrag mehr mit (D41)", async () => {
    (fetch as never as ReturnType<typeof vi.fn>).mockResolvedValue(ok({}));
    await api.closeDay();
    expect(lastCall()[0]).toBe("/api/day-close");
    expect(lastCall()[1].method).toBe("POST");
    expect(lastCall()[1].body).toBeUndefined();
  });

  it("Tagesabschluss kann einen anderen Tag adressieren", async () => {
    (fetch as never as ReturnType<typeof vi.fn>).mockResolvedValue(ok({}));
    await api.closeDay("2026-09-07");
    expect(lastCall()[0]).toBe("/api/day-close?day=2026-09-07");
  });

  it("Bon-Liste hängt Filter als Query an", async () => {
    (fetch as never as ReturnType<typeof vi.fn>).mockResolvedValue(ok([]));
    await api.bills({ day: "2026-09-07", includeDeleted: true });
    expect(lastCall()[0]).toBe("/api/bills?day=2026-09-07&include_deleted=true");
  });

  it("Bon-Liste ohne Filter hat keine Query", async () => {
    (fetch as never as ReturnType<typeof vi.fn>).mockResolvedValue(ok([]));
    await api.bills();
    expect(lastCall()[0]).toBe("/api/bills");
  });

  it("Pfandrückgaben lassen sich auf eigenständige einschränken", async () => {
    (fetch as never as ReturnType<typeof vi.fn>).mockResolvedValue(ok([]));
    await api.depositReturns({ standaloneOnly: true });
    expect(lastCall()[0]).toBe("/api/deposit-returns?standalone_only=true");
  });

  it("Mengen-Delta geht als String über die Leitung (kein Float)", async () => {
    (fetch as never as ReturnType<typeof vi.fn>).mockResolvedValue(ok({}));
    await api.lineDelta(7, 3);
    expect(JSON.parse(lastCall()[1].body as string)).toEqual({
      variant_id: 7,
      delta: "3",
    });
  });
});

describe("Verbindungsbeobachter", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("meldet Ausfall und Rückkehr genau einmal", async () => {
    const seen: boolean[] = [];
    const off = onConnectionChange((v) => seen.push(v));

    (fetch as never as ReturnType<typeof vi.fn>).mockRejectedValue(new TypeError("x"));
    await api.catalogs().catch(() => undefined);
    await api.catalogs().catch(() => undefined); // zweimal offline = eine Meldung

    (fetch as never as ReturnType<typeof vi.fn>).mockResolvedValue(ok([]));
    await api.catalogs();

    off();
    expect(seen).toEqual([true, false, true]);
  });

  it("nach dem Abmelden kommt nichts mehr", async () => {
    const seen: boolean[] = [];
    const off = onConnectionChange((v) => seen.push(v));
    off();
    (fetch as never as ReturnType<typeof vi.fn>).mockRejectedValue(new TypeError("x"));
    await api.catalogs().catch(() => undefined);
    expect(seen).toEqual([true]);
  });
});
