"use client";

import type { ExceptionOption } from "@/lib/scene/exceptions";
import { KIND_LABEL, statusText } from "@/lib/scene/status-text";
import type { Entity } from "@/lib/scene/types";

export type MeshMode = "loading" | "models" | "failed" | "off";

const MESH_LABEL: Readonly<Record<MeshMode, string>> = {
  loading: "Models…",
  models: "Models",
  failed: "Models ✕",
  off: "Models",
};
const MESH_TITLE: Readonly<Record<MeshMode, string>> = {
  loading: "Primitives shown while the free models load",
  models: "Free models on; click for primitives",
  failed: "Models failed to load; primitives shown",
  off: "Primitives on; click for the free models",
};

interface SceneOverlayProps {
  roof: boolean;
  lens: boolean;
  meshes: MeshMode;
  graphicsLost: boolean;
  exceptions: readonly ExceptionOption[];
  selected: Entity | undefined;
  onSelect: (id: string | null) => void;
  onToggleRoof: () => void;
  onToggleMeshes: () => void;
  onToggleLens: () => void;
  onReset: () => void;
}

const PILL =
  "pointer-events-auto rounded-md bg-zinc-900/80 text-zinc-100 shadow-sm backdrop-blur-sm";
const TOGGLE =
  "h-7 px-2.5 text-xs font-medium text-zinc-100 transition-colors duration-150 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50 aria-pressed:bg-white/15";
const LOST =
  "Graphics stopped (WebGL context lost), so the 3D view is paused. It restarts if the browser restores graphics; otherwise reload the page.";

/** Required labels (schematic layout, illustrative state, model credits) in one chip; details open on demand. */
const ProvenanceChip = ({ models }: { models: boolean }) => (
  <details className={`${PILL} group max-w-full text-[11px]`}>
    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-1.5 px-2.5 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
      <span className="font-mono uppercase tracking-wider text-amber-300">
        Schematic layout
      </span>
      <span className="text-zinc-500">·</span>
      <span className="text-sky-200">Illustrative state</span>
      <span className="text-zinc-500">·</span>
      <span className="text-zinc-300 group-open:text-white">
        Details & credits
      </span>
    </summary>
    <div className="max-w-sm space-y-1 border-t border-white/10 px-2.5 pt-1.5 pb-2 text-zinc-300 leading-snug">
      <p>
        Door and stall positions are not surveyed. DFW Commerce Center Building
        I · 182 doors · 4 ramps · 235 trailer spaces (S1).
      </p>
      <p>Illustrative run state · not facility data or results.</p>
      <p className="[&_a]:underline">
        {models ? "Models: " : "Models (off): "}
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
        , modified · semi by WilliWam, container and pallet by Quaternius, CC0 ·
        pallets are decoration ·{" "}
        <a href="/models/ATTRIBUTION.md" target="_blank" rel="noreferrer">
          all credits
        </a>
      </p>
    </div>
  </details>
);

export const SceneOverlay = ({
  roof,
  lens,
  meshes,
  graphicsLost,
  exceptions,
  selected,
  onSelect,
  onToggleRoof,
  onToggleMeshes,
  onToggleLens,
  onReset,
}: SceneOverlayProps) => (
  // One wrapping row, so the required labels never sit under the controls;
  // above the drawers so a tall wrapped row stays visible.
  <div className="pointer-events-none absolute inset-x-3 bottom-3 z-30 flex flex-wrap-reverse items-end justify-between gap-1.5">
    <ProvenanceChip models={meshes === "models"} />
    <div className="ml-auto flex max-w-full flex-wrap-reverse items-end justify-end gap-1.5">
      <div
        aria-live="polite"
        className={
          selected || graphicsLost
            ? `${PILL} max-w-80 px-2.5 py-1.5 text-xs`
            : "sr-only"
        }
      >
        {graphicsLost
          ? LOST
          : selected && (
              <>
                <b className="font-mono">{selected.id}</b> ·{" "}
                {KIND_LABEL[selected.kind]}
                <br />
                {statusText(selected)}
              </>
            )}
      </div>
      <div
        className={`${PILL} flex flex-wrap items-center justify-end divide-x divide-white/10`}
      >
        <select
          aria-label="Select an entity in an exception state"
          className={`${TOGGLE} bg-transparent [&>option]:text-zinc-900`}
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
        <button
          type="button"
          className={TOGGLE}
          onClick={onToggleLens}
          aria-pressed={lens}
          disabled={graphicsLost}
          title="Tilt-shift miniature lens; the sharp band follows the selection"
        >
          Lens
        </button>
        <button
          type="button"
          className={TOGGLE}
          onClick={onToggleRoof}
          aria-pressed={roof}
          disabled={graphicsLost}
          title={roof ? "Hide the roof" : "Show the roof"}
        >
          Roof
        </button>
        <button
          type="button"
          className={TOGGLE}
          onClick={onToggleMeshes}
          aria-pressed={meshes !== "off"}
          disabled={graphicsLost}
          title={MESH_TITLE[meshes]}
        >
          {MESH_LABEL[meshes]}
        </button>
        <button
          type="button"
          className={TOGGLE}
          onClick={onReset}
          disabled={graphicsLost}
          title="Frame the whole site again"
        >
          Reset
        </button>
      </div>
    </div>
  </div>
);
