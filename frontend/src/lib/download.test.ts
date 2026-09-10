import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveFile } from "./download";

function pdf(): Blob {
  return new Blob(["%PDF-1.3"], { type: "application/pdf" });
}

describe("saveFile", () => {
  // jsdom bringt die Blob-URL-Fabrik nicht mitgeliefert - erst anlegen,
  // dann kann sie belauscht werden.
  beforeEach(() => {
    Object.assign(URL, {
      createObjectURL: () => "blob:leer",
      revokeObjectURL: () => {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("klickt einen Link mit dem gelieferten Dateinamen", () => {
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    let geklickt: HTMLAnchorElement | null = null;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      geklickt = this;
    });

    saveFile({ blob: pdf(), filename: "tag.pdf" });

    expect(create).toHaveBeenCalled();
    expect(geklickt).not.toBeNull();
    expect(geklickt!.download).toBe("tag.pdf");
    expect(geklickt!.getAttribute("href")).toBe("blob:test");
  });

  it("lässt keinen Link im Dokument stehen", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    saveFile({ blob: pdf(), filename: "tag.pdf" });

    expect(document.querySelectorAll("a[download]")).toHaveLength(0);
  });

  it("gibt die Blob-URL erst später frei – sonst bricht der Download ab", () => {
    vi.useFakeTimers();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    saveFile({ blob: pdf(), filename: "tag.pdf" });
    expect(revoke).not.toHaveBeenCalled();

    vi.advanceTimersByTime(30_000);
    expect(revoke).toHaveBeenCalledWith("blob:test");
  });
});
