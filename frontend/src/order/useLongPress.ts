import { useRef } from "react";

interface Handlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

/**
 * Tap = onTap. Halten (>= ms) = onLongPress. Robust gegen pointercancel
 * (Scroll auf Touch) - behebt TESTPLAN F-12.
 */
export function useLongPress(
  onTap: () => void,
  onLongPress: () => void,
  ms = 500,
): Handlers {
  const timer = useRef<number>();
  const fired = useRef(false);

  const clear = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
  };

  return {
    onPointerDown: (e) => {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      fired.current = false;
      clear();
      timer.current = window.setTimeout(() => {
        fired.current = true;
        onLongPress();
      }, ms);
    },
    onPointerUp: () => {
      clear();
      if (!fired.current) onTap();
    },
    onPointerLeave: clear,
    onPointerCancel: () => {
      clear();
      fired.current = true; // kein Tap nach abgebrochenem Pointer
    },
    onContextMenu: (e) => e.preventDefault(),
  };
}
