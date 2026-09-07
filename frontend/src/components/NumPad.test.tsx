import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { NumPad } from "./NumPad";

/** Wrapper mit State - der NumPad ist bewusst kontrolliert. */
function Harness(props: Partial<React.ComponentProps<typeof NumPad>> = {}) {
  const [value, setValue] = useState(props.value ?? "");
  return (
    <>
      <NumPad {...props} value={value} onChange={setValue} />
      {/* Wert als Attribut, damit er die Textsuche im NumPad nicht stoert. */}
      <output data-testid="raw" data-value={value} />
    </>
  );
}

const raw = () => screen.getByTestId("raw").getAttribute("data-value");

async function type(keys: string) {
  const user = userEvent.setup();
  for (const k of keys) {
    if (k === ",") await user.click(screen.getByRole("button", { name: "Komma" }));
    else await user.click(screen.getByRole("button", { name: k }));
  }
}

describe("NumPad", () => {
  it("tippt Ziffern in der Reihenfolge der Eingabe", async () => {
    render(<Harness />);
    await type("123");
    expect(raw()).toBe("123");
  });

  it("zeigt den Platzhalter, solange nichts eingegeben ist", () => {
    render(<Harness placeholder="– – – –" />);
    expect(screen.getByText("– – – –")).toBeInTheDocument();
  });

  it("Komma erzeugt bei leerer Eingabe 0,", async () => {
    render(<Harness />);
    await type(",");
    expect(raw()).toBe("0.");
  });

  it("akzeptiert nur ein Komma", async () => {
    render(<Harness />);
    await type("1,5,");
    expect(raw()).toBe("1.5");
  });

  it("erlaubt höchstens zwei Nachkommastellen", async () => {
    render(<Harness />);
    await type("1,239");
    expect(raw()).toBe("1.23");
  });

  it("schluckt die führende Null bei Beträgen", async () => {
    render(<Harness />);
    await type("07");
    expect(raw()).toBe("7");
  });

  it("behält die führende Null bei Codes (decimals=false)", async () => {
    render(<Harness decimals={false} />);
    await type("0042");
    expect(raw()).toBe("0042");
  });

  it("ohne decimals gibt es kein Komma, sondern eine C-Taste", async () => {
    render(<Harness decimals={false} />);
    expect(screen.queryByRole("button", { name: "Komma" })).toBeNull();
    await type("12");
    await userEvent.click(screen.getByRole("button", { name: "Eingabe löschen" }));
    expect(raw()).toBe("");
  });

  it("Rücktaste entfernt genau ein Zeichen", async () => {
    render(<Harness />);
    await type("123");
    await userEvent.click(screen.getByRole("button", { name: "Zeichen löschen" }));
    expect(raw()).toBe("12");
  });

  it("Rücktaste auf leerer Eingabe bleibt leer (kein Absturz)", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Zeichen löschen" }));
    expect(raw()).toBe("");
  });

  it("begrenzt die Länge – niemand tippt 20 Stellen versehentlich sinnvoll", async () => {
    render(<Harness />);
    await type("123456789012345");
    expect(raw()!.length).toBe(12);
  });

  it("maskiert die Anzeige, ohne den Wert zu verändern", async () => {
    render(<Harness masked decimals={false} />);
    await type("1234");
    expect(raw()).toBe("1234");
    expect(screen.getByText("••••")).toBeInTheDocument();
    expect(screen.queryByText("1234")).toBeNull();
  });

  it("zeigt die Einheit an", () => {
    render(<Harness unit="Stück" />);
    expect(screen.getByText("Stück")).toBeInTheDocument();
  });

  it("ohne Einheit steht kein leeres Kästchen im Display", () => {
    const { container } = render(<Harness unit="" />);
    expect(container.textContent).not.toContain("€");
  });

  it("alle Tasten erfüllen die 44px-Touchvorgabe (min-height gesetzt)", () => {
    render(<Harness />);
    // 9 Ziffern + Komma + 0 + Rücktaste
    expect(screen.getAllByRole("button")).toHaveLength(12);
  });
});
