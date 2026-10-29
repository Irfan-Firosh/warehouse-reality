"use client";

import { Crosshair } from "lucide-react";
import { TextureButton } from "@/components/ui/texture-button";
import type { ExceptionOption } from "@/lib/scene/exceptions";
import { KIND_LABEL, statusText } from "@/lib/scene/status-text";
import type { Entity } from "@/lib/scene/types";

export type MeshMode = "loading" | "models" | "failed" | "off";

/** The Models switch label in the settings pane, so a load failure is never silent. */
export const MESH_LABEL: Readonly<Record<MeshMode, string>> = {
  loading: "Models…",
  models: "Models",
  failed: "Models ✕",
  off: "Models",
};

export const MESH_TITLE: Readonly<Record<MeshMode, string>> = {
  loading: "Primitives shown while the free models load",
  models: "Free models on; click for primitives",
  failed: "Models failed to load; primitives shown",
  off: "Primitives on; click for the free models",
};

/** How the credits line introduces the models, so loading and a failure read differently from off. */
const CREDIT_LEAD: Readonly<Record<MeshMode, string>> = {
  loading: "Models (loading; primitives shown): ",
  models: "Models: ",
  failed: "Models (failed to load; primitives shown): ",
  off: "Models (off): ",
};

interface SceneOverlayProps {
  meshes: MeshMode;
  /** The scene draws a server run's engine state, not the illustrative one. */
  fromRun: boolean;
  graphicsLost: boolean;
  exceptions: readonly ExceptionOption[];
  selected: Entity | undefined;
  ambient: boolean;
  canFollow: boolean;
  following: boolean;
  onSelect: (id: string | null) => void;
  onToggleFollow: () => void;
}

const PILL =
  "pointer-events-auto rounded-md bg-zinc-900/80 text-zinc-100 shadow-sm backdrop-blur-sm";
const SELECT =
  "h-[30px] rounded-[6px] border border-black/20 bg-gradient-to-b from-white to-neutral-50 px-2 text-xs text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50 dark:border-neutral-950 dark:from-neutral-800 dark:to-neutral-700 dark:text-neutral-200 [&>option]:bg-white [&>option]:text-zinc-900";

const LOST =
  "Graphics stopped (WebGL context lost), so the 3D view is paused. It restarts if the browser restores graphics; otherwise reload the page.";

/** Required labels (schematic layout, illustrative state, model credits) in one chip; details open on demand. */
interface ProvenanceChipProps {
  meshes: MeshMode;
  fromRun: boolean;
  ambient: boolean;
}

const ProvenanceChip = ({ meshes, fromRun, ambient }: ProvenanceChipProps) => (
  <details className={`${PILL} group max-w-full text-[11px]`}>
    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-1.5 px-2.5 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
      <span className="font-mono uppercase tracking-wider text-amber-300">
        Schematic layout
      </span>
      <span className="text-zinc-500">·</span>
      {fromRun ? (
        <span className="text-lime-200">Engine run state</span>
      ) : (
        <span className="text-sky-200">Illustrative state</span>
      )}
      {ambient && (
        <>
          <span className="text-zinc-500">·</span>
          <span className="text-sky-200">Ambient motion: illustrative</span>
        </>
      )}
      {meshes === "failed" && (
        <>
          <span className="text-zinc-500">·</span>
          <span className="text-amber-300">
            Models failed; primitives shown
          </span>
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
      {fromRun ? (
        <p>
          Door, stall, trailer and equipment statuses come from the server
          run&apos;s engine snapshot. Scenario values, not facility data.
        </p>
      ) : (
        <p>Illustrative run state · not facility data or results.</p>
      )}
      {ambient && (
        <p>
          Ambient motion is decoration: trucks and forklifts move on a display
          clock, not the engine, and their pace means nothing.
        </p>
      )}
      <p className="[&_a]:underline">
        {CREDIT_LEAD[meshes]}
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
  meshes,
  fromRun,
  graphicsLost,
  exceptions,
  selected,
  ambient,
  canFollow,
  following,
  onSelect,
  onToggleFollow,
}: SceneOverlayProps) => (
  // One wrapping row, so the required labels never sit under the controls;
  // above the drawers so a tall wrapped row stays visible.
  <div className="pointer-events-none absolute inset-x-3 bottom-3 z-30 flex flex-wrap-reverse items-end justify-between gap-1.5">
    <ProvenanceChip meshes={meshes} fromRun={fromRun} ambient={ambient} />
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
        {(canFollow || following) && (
          <TextureButton
            variant={following ? "primary" : "minimal"}
            size="sm"
            className="w-auto"
            onClick={onToggleFollow}
            disabled={graphicsLost}
            aria-pressed={following}
            title={
              following
                ? "Stop following (F or Esc)"
                : "Chase this truck (F); [ and ] switch trucks"
            }
          >
            <Crosshair className="size-3.5" />
            {following ? "Following" : "Follow"}
          </TextureButton>
        )}
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
      </div>
    </div>
  </div>
);
