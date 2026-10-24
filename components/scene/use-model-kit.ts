"use client";

import { useEffect, useState } from "react";
import { type Kit, loadModelKit } from "./model-kit";

export type ModelKitStatus =
  | { state: "loading" }
  | { state: "ready"; kit: Kit }
  | { state: "failed" };

const LOADING: ModelKitStatus = { state: "loading" };

/** Loads the free-model kit while `enabled`; the caller shows primitives until it is ready. */
export const useModelKit = (enabled: boolean): ModelKitStatus => {
  const [status, setStatus] = useState<ModelKitStatus>(LOADING);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    setStatus((s) => (s.state === "failed" ? LOADING : s));
    loadModelKit().then(
      (kit) => {
        if (live) setStatus({ state: "ready", kit });
      },
      () => {
        if (live) setStatus({ state: "failed" });
      },
    );
    return () => {
      live = false;
    };
  }, [enabled]);
  return status;
};
