"use client";

import type { RootState } from "@react-three/fiber";
import { useCallback, useState } from "react";

export type GraphicsState = "ok" | "lost";

/**
 * Tracks WebGL context loss. On restore the Canvas remounts (new key) with a
 * fresh renderer instead of trusting the restored one to re-upload everything.
 */
export const useGraphicsContext = () => {
  const [graphics, setGraphics] = useState<GraphicsState>("ok");
  const [canvasKey, setCanvasKey] = useState(0);
  const onCreated = useCallback(({ gl }: RootState) => {
    const canvas = gl.domElement;
    const listeners = new AbortController();
    const { signal } = listeners;
    canvas.addEventListener(
      "webglcontextlost",
      (e) => {
        e.preventDefault();
        setGraphics("lost");
      },
      { signal },
    );
    canvas.addEventListener(
      "webglcontextrestored",
      () => {
        // The old canvas is force-lost on unmount; that must not flag the new one.
        listeners.abort();
        setCanvasKey((k) => k + 1);
        setGraphics("ok");
      },
      { signal },
    );
  }, []);
  return { graphics, canvasKey, onCreated };
};
