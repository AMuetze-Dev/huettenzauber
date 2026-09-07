import type { MouseEvent as ME, PointerEvent as PE } from "react";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLongPress } from "./useLongPress";

function down(h: ReturnType<typeof useLongPress>) {
  h.onPointerDown({
    pointerId: 1,
    currentTarget: { setPointerCapture: vi.fn() },
  } as unknown as PE);
}

describe("useLongPress", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("kurzer Tap -> onTap, kein onLongPress", () => {
    const tap = vi.fn();
    const long = vi.fn();
    const { result } = renderHook(() => useLongPress(tap, long, 500));
    down(result.current);
    vi.advanceTimersByTime(100);
    result.current.onPointerUp({} as PE);
    expect(tap).toHaveBeenCalledTimes(1);
    expect(long).not.toHaveBeenCalled();
  });

  it("Halten >= ms -> onLongPress, danach Up ohne onTap", () => {
    const tap = vi.fn();
    const long = vi.fn();
    const { result } = renderHook(() => useLongPress(tap, long, 500));
    down(result.current);
    vi.advanceTimersByTime(500);
    expect(long).toHaveBeenCalledTimes(1);
    result.current.onPointerUp({} as PE);
    expect(tap).not.toHaveBeenCalled();
  });

  it("knapp unter ms -> nur onTap", () => {
    const tap = vi.fn();
    const long = vi.fn();
    const { result } = renderHook(() => useLongPress(tap, long, 500));
    down(result.current);
    vi.advanceTimersByTime(499);
    result.current.onPointerUp({} as PE);
    expect(tap).toHaveBeenCalledTimes(1);
    expect(long).not.toHaveBeenCalled();
  });

  it("pointercancel -> weder onTap noch onLongPress bei folgendem Up", () => {
    const tap = vi.fn();
    const long = vi.fn();
    const { result } = renderHook(() => useLongPress(tap, long, 500));
    down(result.current);
    result.current.onPointerCancel();
    vi.advanceTimersByTime(1000);
    result.current.onPointerUp({} as PE);
    expect(tap).not.toHaveBeenCalled();
    expect(long).not.toHaveBeenCalled();
  });

  it("pointerleave loescht den Long-Press-Timer", () => {
    const tap = vi.fn();
    const long = vi.fn();
    const { result } = renderHook(() => useLongPress(tap, long, 500));
    down(result.current);
    result.current.onPointerLeave();
    vi.advanceTimersByTime(1000);
    expect(long).not.toHaveBeenCalled();
  });

  it("onContextMenu ruft preventDefault", () => {
    const { result } = renderHook(() => useLongPress(vi.fn(), vi.fn()));
    const prevent = vi.fn();
    result.current.onContextMenu({ preventDefault: prevent } as unknown as ME);
    expect(prevent).toHaveBeenCalled();
  });
});
