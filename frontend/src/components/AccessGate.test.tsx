import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, getAccessCode, setAccessCode } from "../api/client";
import { AccessGate } from "./AccessGate";

const KASSE = "Kasse offen";

function gate() {
  return render(
    <AccessGate>
      <div>{KASSE}</div>
    </AccessGate>,
  );
}

const tippe = (ziffern: string) => {
  for (const z of ziffern) fireEvent.click(screen.getByRole("button", { name: z }));
};

describe("AccessGate", () => {
  beforeEach(() => {
    setAccessCode("");
    vi.spyOn(api, "health");
    vi.spyOn(api, "accessCheck");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    setAccessCode("");
  });

  it("ohne gesetzten Servercode bleibt die Kasse offen", async () => {
    vi.mocked(api.health).mockResolvedValue({
      status: "ok",
      database: "ok",
      access_code_required: false,
    });
    gate();
    expect(await screen.findByText(KASSE)).toBeInTheDocument();
    expect(api.accessCheck).not.toHaveBeenCalled();
  });

  it("sperrt, wenn der Server einen Code verlangt und keiner passt", async () => {
    vi.mocked(api.health).mockResolvedValue({
      status: "ok",
      database: "ok",
      access_code_required: true,
    });
    vi.mocked(api.accessCheck).mockResolvedValue({ required: true, valid: false });
    gate();
    expect(await screen.findByText("Zugangscode")).toBeInTheDocument();
    expect(screen.queryByText(KASSE)).toBeNull();
  });

  it("ein bereits gespeicherter, gültiger Code öffnet ohne Nachfrage", async () => {
    setAccessCode("1234");
    vi.mocked(api.health).mockResolvedValue({
      status: "ok",
      database: "ok",
      access_code_required: true,
    });
    vi.mocked(api.accessCheck).mockResolvedValue({ required: true, valid: true });
    gate();
    expect(await screen.findByText(KASSE)).toBeInTheDocument();
  });

  it("sperrt NICHT, wenn der Server gar nicht antwortet", async () => {
    // Sonst steht der Ausschank vor einem Schloss, das niemand aufbekommt.
    vi.mocked(api.health).mockRejectedValue(new Error("offline"));
    gate();
    expect(await screen.findByText(KASSE)).toBeInTheDocument();
  });

  it("richtiger Code entsperrt und wird gemerkt", async () => {
    vi.mocked(api.health).mockResolvedValue({
      status: "ok",
      database: "ok",
      access_code_required: true,
    });
    vi.mocked(api.accessCheck)
      .mockResolvedValueOnce({ required: true, valid: false })
      .mockResolvedValueOnce({ required: true, valid: true });

    gate();
    await screen.findByText("Zugangscode");
    tippe("2468");
    fireEvent.click(screen.getByRole("button", { name: "Entsperren" }));

    expect(await screen.findByText(KASSE)).toBeInTheDocument();
    expect(getAccessCode()).toBe("2468");
  });

  it("falscher Code meldet das und leert die Eingabe", async () => {
    vi.mocked(api.health).mockResolvedValue({
      status: "ok",
      database: "ok",
      access_code_required: true,
    });
    vi.mocked(api.accessCheck).mockResolvedValue({ required: true, valid: false });

    gate();
    await screen.findByText("Zugangscode");
    tippe("1111");
    fireEvent.click(screen.getByRole("button", { name: "Entsperren" }));

    expect(await screen.findByText("Code stimmt nicht.")).toBeInTheDocument();
    expect(getAccessCode()).toBe("");
    await waitFor(() => expect(screen.getByText("– – – –")).toBeInTheDocument());
  });

  it("Entsperren ist ohne Eingabe nicht anklickbar", async () => {
    vi.mocked(api.health).mockResolvedValue({
      status: "ok",
      database: "ok",
      access_code_required: true,
    });
    vi.mocked(api.accessCheck).mockResolvedValue({ required: true, valid: false });
    gate();
    await screen.findByText("Zugangscode");
    expect(screen.getByRole("button", { name: "Entsperren" })).toBeDisabled();
  });

  it("die Ziffern stehen nicht im Klartext auf dem Schirm", async () => {
    vi.mocked(api.health).mockResolvedValue({
      status: "ok",
      database: "ok",
      access_code_required: true,
    });
    vi.mocked(api.accessCheck).mockResolvedValue({ required: true, valid: false });
    gate();
    await screen.findByText("Zugangscode");
    tippe("77");
    expect(screen.getByText("••")).toBeInTheDocument();
  });

  it("führende Null im Code geht nicht verloren", async () => {
    vi.mocked(api.health).mockResolvedValue({
      status: "ok",
      database: "ok",
      access_code_required: true,
    });
    vi.mocked(api.accessCheck)
      .mockResolvedValueOnce({ required: true, valid: false })
      .mockResolvedValueOnce({ required: true, valid: true });

    gate();
    await screen.findByText("Zugangscode");
    tippe("0815");
    fireEvent.click(screen.getByRole("button", { name: "Entsperren" }));

    await screen.findByText(KASSE);
    expect(getAccessCode()).toBe("0815");
  });

  it("Serverausfall beim Prüfen wird gemeldet, statt still zu scheitern", async () => {
    vi.mocked(api.health).mockResolvedValue({
      status: "ok",
      database: "ok",
      access_code_required: true,
    });
    vi.mocked(api.accessCheck)
      .mockResolvedValueOnce({ required: true, valid: false })
      .mockRejectedValueOnce(new Error("offline"));

    gate();
    await screen.findByText("Zugangscode");
    tippe("1234");
    fireEvent.click(screen.getByRole("button", { name: "Entsperren" }));

    expect(await screen.findByText("Kasse antwortet nicht.")).toBeInTheDocument();
  });
});
