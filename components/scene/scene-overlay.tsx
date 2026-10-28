"use client";

import { Aperture, Box, House, RotateCcw } from "lucide-react";
import {
  TextureButton,
  type TextureButtonProps,
} from "@/components/ui/texture-button";
import type { ExceptionOption } from "@/lib/scene/exceptions";
import { KIND_LABEL, statusText } from "@/lib/scene/status-text";
import type { Entity } from "@/lib/scene/types";
import { cn } from "@/lib/utils";

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
  ambient: boolean;
  onSelect: (id: string | null) => void;
  onToggleRoof: () => void;
  onToggleMeshes: () => void;
  onToggleLens: () => void;
  onReset: () => void;
}

const PILL =
  "pointer-events-auto rounded-md bg-zinc-900/80 text-zinc-100 shadow-sm backdrop-blur-sm";
const ICON = "size-3.5";
const SELECT =
  "h-[30px] rounded-[6px] border border-black/20 bg-gradient-to-b from-white to-neutral-50 px-2 text-xs text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50 dark:border-neutral-950 dark:from-neutral-800 dark:to-neutral-700 dark:text-neutral-200 [&>option]:bg-white [&>option]:text-zinc-900";

interface ToggleProps extends Omit<TextureButtonProps, "variant" | "size"> {
  on: boolean;
}

/** A view switch: the dark "primary" face while on, "minimal" while off. */
const Toggle = ({ on, className, ...props }: ToggleProps) => (
  <TextureButton
    variant={on ? "primary" : "minimal"}
    size="sm"
    className={cn("w-auto", className)}
    aria-pressed={on}
    {...props}
  />
);
const LOST =
  "Graphics stopped (WebGL context lost), so the 3D view is paused. It restarts if the browser restores graphics; otherwise reload the page.";

/** Required labels (schematic layout, illustrative state, model credits) in one chip; details open on demand. */
interface ProvenanceChipProps {
  models: boolean;
  ambient: boolean;
}

const ProvenanceChip = ({ models, ambient }: ProvenanceChipProps) => (
  <details className={`${PILL} group max-w-full text-[11px]`}>
    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-1.5 px-2.5 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
      <span className="font-mono uppercase tracking-wider text-amber-300">
        Schematic layout
      </span>
      <span className="text-zinc-500">·</span>
      <span className="text-sky-200">Illustrative state</span>
      {ambient && (
        <>
          <span className="text-zinc-500">·</span>
          <span className="text-sky-200">Ambient motion: illustrative</span>
        </>
      )}
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
      {ambient && (
        <p>
          Ambient motion is decoration: trucks and forklifts move on a display
          clock, not the engine, and their pace means nothing.
        </p>
      )}
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
  ambient,
  onSelect,
  onToggleRoof,
  onToggleMeshes,
  onToggleLens,
  onReset,
}: SceneOverlayProps) => (
  // One wrapping row, so the required labels never sit under the controls;
  // above the drawers so a tall wrapped row stays visible.
  <div className="pointer-events-none absolute inset-x-3 bottom-3 z-30 flex flex-wrap-reverse items-end justify-between gap-1.5">
    <ProvenanceChip models={meshes === "models"} ambient={ambient} />
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
      <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1">
        <select
          aria-label="Select an entity in an exception state"
          className={SELECT}
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
        <Toggle
          on={lens}
          onClick={onToggleLens}
          disabled={graphicsLost}
          title="Tilt-shift miniature lens; the sharp band follows the selection"
        >
          <Aperture className={ICON} />
          Lens
        </Toggle>
        <Toggle
          on={roof}
          onClick={onToggleRoof}
          disabled={graphicsLost}
          title={roof ? "Hide the roof" : "Show the roof"}
        >
          <House className={ICON} />
          Roof
        </Toggle>
        <Toggle
          on={meshes !== "off"}
          onClick={onToggleMeshes}
          disabled={graphicsLost}
          title={MESH_TITLE[meshes]}
        >
          <Box className={ICON} />
          {MESH_LABEL[meshes]}
        </Toggle>
        <TextureButton
          variant="minimal"
          size="sm"
          className="w-auto"
          onClick={onReset}
          disabled={graphicsLost}
          title="Frame the whole site again"
        >
          <RotateCcw className={ICON} />
          Reset
        </TextureButton>
      </div>
    </div>
  </div>
);
