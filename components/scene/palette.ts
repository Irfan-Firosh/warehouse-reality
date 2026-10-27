"use client";

import { useSyncExternalStore } from "react";
import type { Entity } from "@/lib/scene/types";

export interface ScenePalette {
  bg: number;
  ground: number;
  asphalt: number;
  wall: number;
  roof: number;
  floor: number;
  trailer: number;
  chassis: number;
  road: number;
  yard: number;
  free: number;
  stallFree: number;
  stallUsed: number;
  staging: number;
  load: number;
}

const LIGHT: ScenePalette = {
  bg: 0xe4e4e7,
  ground: 0xd4d4d8,
  asphalt: 0xa1a1aa,
  wall: 0x9ca3af,
  roof: 0xb8b8c0,
  floor: 0xcfcfd4,
  trailer: 0xf4f4f5,
  chassis: 0x52525b,
  road: 0x3f3f46,
  yard: 0x475569,
  free: 0x71717a,
  stallFree: 0xe4e4e7,
  stallUsed: 0x8a8a93,
  staging: 0xbfc5d2,
  load: 0xc8a97e,
};
const DARK: ScenePalette = {
  bg: 0x111113,
  ground: 0x18181b,
  asphalt: 0x3a3a41,
  wall: 0x52525b,
  roof: 0x5b5b63,
  floor: 0x2a2a2f,
  trailer: 0xd4d4d8,
  chassis: 0x27272a,
  road: 0x5b5b66,
  yard: 0x4b5d7a,
  free: 0x6b6b74,
  stallFree: 0x8b8b94,
  stallUsed: 0x27272a,
  staging: 0x3a4152,
  load: 0x9c8462,
};

export const STATUS = {
  serving: 0x10b981,
  blocked: 0xf59e0b,
  waiting: 0xf59e0b,
  gate: 0xf59e0b,
  closed: 0xef4444,
  failed: 0xef4444,
  reserved: 0x06b6d4,
  selected: 0x3b6ff0,
} as const;
export const WHITE = 0xffffff;

const isDark = (): boolean =>
  document.documentElement.classList.contains("dark");

const subscribe = (onChange: () => void): (() => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
};

/** Follows the `.dark` class on <html>, which the dashboard sets from the OS preference and the theme toggle. */
export const usePalette = (): ScenePalette =>
  useSyncExternalStore(
    subscribe,
    () => (isDark() ? DARK : LIGHT),
    () => DARK,
  );

export const statusColor = (e: Entity, p: ScenePalette): number => {
  switch (e.kind) {
    case "door":
      return e.status === "free" ? p.free : STATUS[e.status];
    case "ramp":
      return p.free;
    case "stall":
      return e.trailer ? p.stallUsed : p.stallFree;
    case "trailer":
      return e.status === "serving" ||
        e.status === "parked" ||
        e.status === "moving"
        ? p.trailer
        : STATUS[e.status];
    case "forklift":
      return e.status === "failed" ? STATUS.failed : WHITE;
    case "tractor":
      return e.role === "yard" ? p.yard : p.road;
  }
};
