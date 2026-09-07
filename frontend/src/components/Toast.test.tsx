import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./Toast";

function Buttons() {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast.success("Bon gebucht")}>ok</button>
      <button onClick={() => toast.error("Kasse antwortet nicht")}>fehler</button>
      <button onClick={() => toast.info("Hinweis")}>info</button>
    </>
  );
}

const withProvider = () =>
  render(
    <ToastProvider>
      <Buttons />
    </ToastProvider>,
  );

describe("Toast", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const click = (label: string) => fireEvent.click(screen.getByText(label));

  it("zeigt eine Erfolgsmeldung", () => {
    withProvider();
    click("ok");
    expect(screen.getByText("Bon gebucht")).toBeInTheDocument();
  });

  it("blendet Erfolg nach 3,5 s wieder aus", () => {
    withProvider();
    click("ok");
    act(() => void vi.advanceTimersByTime(3600));
    expect(screen.queryByText("Bon gebucht")).toBeNull();
  });

  it("lässt Fehler länger stehen als Erfolg", () => {
    withProvider();
    click("fehler");
    act(() => void vi.advanceTimersByTime(3600));
    expect(screen.getByText("Kasse antwortet nicht")).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(3500));
    expect(screen.queryByText("Kasse antwortet nicht")).toBeNull();
  });

  it("stapelt mehrere Meldungen", () => {
    withProvider();
    click("ok");
    click("info");
    expect(screen.getByText("Bon gebucht")).toBeInTheDocument();
    expect(screen.getByText("Hinweis")).toBeInTheDocument();
  });

  it("gleiche Meldung zweimal erscheint zweimal (kein stilles Verschlucken)", () => {
    withProvider();
    click("ok");
    click("ok");
    expect(screen.getAllByText("Bon gebucht")).toHaveLength(2);
  });

  it("lässt sich von Hand schließen", () => {
    withProvider();
    click("fehler");
    fireEvent.click(screen.getByRole("button", { name: "Meldung schließen" }));
    expect(screen.queryByText("Kasse antwortet nicht")).toBeNull();
  });

  it("meldet sich als Live-Region an (Screenreader / Vorlesefunktion)", () => {
    withProvider();
    click("info");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("useToast ohne Provider ist ein Programmierfehler", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Buttons />)).toThrow(/ToastProvider/);
    quiet.mockRestore();
  });
});
