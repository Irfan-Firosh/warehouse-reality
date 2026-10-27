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
  /** Lighting and grade: a sunny miniature by day, a low-saturation dusk in dark mode. */
  sun: number;
  sunIntensity: number;
  sky: number;
  bounce: number;
  skyIntensity: number;
  saturation: number;
}

// Model-railway paint: a grass board on a warm tabletop, dark asphalt so white trailers pop, pale warm building.
const LIGHT: ScenePalette = {
  bg: 0xe7e1d6,
  ground: 0x86ad68,
  asphalt: 0x4d535b,
  wall: 0xefe5d3,
  roof: 0xddd6c8,
  floor: 0xd6cbb6,
  trailer: 0xfafaf7,
  chassis: 0x2b2e33,
  road: 0x2f4a7a,
  yard: 0x5b6b82,
  free: 0x6b7280,
  stallFree: 0x6a7078,
  stallUsed: 0x3d4249,
  staging: 0xcdbb92,
  load: 0xc8a97e,
  sun: 0xfff1dc,
  sunIntensity: 2.4,
  sky: 0xd6ecff,
  bounce: 0x9c8a6a,
  skyIntensity: 1.1,
  saturation: 0.16,
};
// Dusk: the same model after sunset, lower saturation and a cool low light.
const DARK: ScenePalette = {
  bg: 0x0e1210,
  ground: 0x2c4232,
  asphalt: 0x353a42,
  wall: 0x7a7a80,
  roof: 0x5e6068,
  floor: 0x3a3a3f,
  trailer: 0xd4d4d8,
  chassis: 0x1f2023,
  road: 0x5470a8,
  yard: 0x5b6d8a,
  free: 0x7a7a84,
  stallFree: 0x555a63,
  stallUsed: 0x2a2d32,
  staging: 0x3a4152,
  load: 0x9c8462,
  sun: 0xffe2c8,
  sunIntensity: 1.7,
  sky: 0x8aa0c8,
  bounce: 0x2a2620,
  skyIntensity: 1.4,
  saturation: 0.05,
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

const QUERY = "(prefers-color-scheme: dark)";
const subscribe = (onChange: () => void): (() => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};

/** Follows the OS color scheme; the scene is client-only, so no server snapshot is needed beyond a default. */
export const usePalette = (): ScenePalette =>
  useSyncExternalStore(
    subscribe,
    () => (window.matchMedia(QUERY).matches ? DARK : LIGHT),
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
