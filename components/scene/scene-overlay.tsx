"use client";

import type { ExceptionOption } from "@/lib/scene/exceptions";
import { KIND_LABEL, statusText } from "@/lib/scene/status-text";
import type { Entity } from "@/lib/scene/types";

export type MeshMode = "loading" | "models" | "failed" | "off";

const MESH_LABEL: Readonly<Record<MeshMode, string>> = {
  loading: "Meshes: primitives, models loading",
  models: "Meshes: free models",
  failed: "Meshes: primitives, models failed",
  off: "Meshes: primitives",
};

interface SceneOverlayProps {
  roof: boolean;
  meshes: MeshMode;
  graphicsLost: boolean;
  exceptions: readonly ExceptionOption[];
  selected: Entity | undefined;
  onSelect: (id: string | null) => void;
  onToggleRoof: () => void;
  onToggleMeshes: () => void;
  onReset: () => void;
}

const BUTTON =
  "pointer-events-auto rounded-md border border-zinc-300 bg-white/90 px-2.5 py-1.5 text-xs font-medium text-zinc-900 transition-colors duration-150 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-100 dark:hover:bg-zinc-800";
const LABEL =
  "w-fit rounded bg-zinc-900/80 px-2 py-1 font-mono text-[10px] text-zinc-200";
const HINT =
  "Click a door, stall, trailer or forklift, or pick one from Exceptions, to select it. Esc clears.";
const LOST =
  "Graphics stopped (WebGL context lost), so the 3D view is paused. It restarts if the browser restores graphics; otherwise reload the page.";

const Selection = ({ selected }: { selected: Entity | undefined }) =>
  selected ? (
    <>
      <b className="font-mono">{selected.id}</b> · {KIND_LABEL[selected.kind]}
      <br />
      {statusText(selected)}
    </>
  ) : (
    HINT
  );

/** Required labels (schematic layout, illustrative state, model credit) plus the minimal scene controls. */
export const SceneOverlay = ({
  roof,
  meshes,
  graphicsLost,
  exceptions,
  selected,
  onSelect,
  onToggleRoof,
  onToggleMeshes,
  onReset,
}: SceneOverlayProps) => (
  <>
    <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1.5 sm:max-w-[60%]">
        <span
          className={`${LABEL} font-medium uppercase tracking-wider text-amber-300`}
        >
          Schematic layout · door and stall positions not surveyed
        </span>
        <span className={LABEL}>
          DFW Commerce Center Building I · 182 doors · 4 ramps · 235 trailer
          spaces (S1)
        </span>
        <span className={`${LABEL} text-sky-200`}>
          Illustrative run state · not facility data or results
        </span>
        {meshes === "models" && (
          <span
            className={`${LABEL} pointer-events-auto font-sans [&_a]:underline`}
          >
            Models:{" "}
            <a
              href="https://poly.pizza/m/DTQBuenKJY"
              target="_blank"
              rel="noreferrer"
            >
              &quot;Forklift&quot;
            </a>{" "}
            by KolosStudios,{" "}
            <a
              href="https://creativecommons.org/licenses/by/3.0/"
              target="_blank"
              rel="noreferrer"
            >
              CC BY 3.0
            </a>
            , modified · semi by WilliWam, container and pallet by Quaternius,
            CC0 · pallets are decoration ·{" "}
            <a href="/models/ATTRIBUTION.md" target="_blank" rel="noreferrer">
              all credits
            </a>
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-start gap-1.5 sm:flex-col sm:items-end">
        <button
          type="button"
          className={BUTTON}
          onClick={onToggleRoof}
          aria-pressed={!roof}
          disabled={graphicsLost}
        >
          Roof: {roof ? "on" : "off"}
        </button>
        <button
          type="button"
          className={BUTTON}
          onClick={onToggleMeshes}
          aria-pressed={meshes === "off"}
          disabled={graphicsLost}
        >
          {MESH_LABEL[meshes]}
        </button>
        <button
          type="button"
          className={BUTTON}
          onClick={onReset}
          disabled={graphicsLost}
        >
          Reset camera
        </button>
        <select
          aria-label="Select an entity in an exception state"
          className={BUTTON}
          value={
            exceptions.some((o) => o.id === selected?.id) ? selected?.id : ""
          }
          onChange={(e) => onSelect(e.target.value || null)}
          disabled={graphicsLost}
        >
          <option value="">Exceptions…</option>
          {exceptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
    <div
      aria-live="polite"
      className="absolute right-3 bottom-3 left-3 rounded-md bg-zinc-900/85 px-2.5 py-1.5 text-xs text-zinc-100 sm:left-auto sm:max-w-80"
    >
      {graphicsLost ? LOST : <Selection selected={selected} />}
    </div>
  </>
);
