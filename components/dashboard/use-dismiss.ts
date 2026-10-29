"use client";

import { type RefObject, useEffect } from "react";

/**
 * Closes a popover on a press outside `root` or on Escape. Escape is caught on
 * window in the capture phase, so it closes the popover before the scene's own
 * Escape handler (which would clear the selection) sees it; focus returns to the trigger.
 */
export const useDismiss = (
  open: boolean,
  close: () => void,
  root: RefObject<HTMLElement | null>,
  trigger: RefObject<HTMLElement | null>,
) => {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!(e.target instanceof Node && root.current?.contains(e.target))) {
        close();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close();
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, close, root, trigger]);
};
