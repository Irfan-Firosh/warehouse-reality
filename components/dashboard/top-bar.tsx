"use client";

import { useEffect, useRef, useState } from "react";

const PILL =
  "pointer-events-auto flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-zinc-200 bg-white/90 p-1 text-zinc-950 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-50";
const BUTTON =
  "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors duration-150 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-zinc-800";

interface TopBarProps {
  logicalTime: string;
  isPaused: boolean;
  speed: 1 | 4 | 16;
  isDeliberating?: boolean;
  onTogglePause: () => void;
  onNextEvent: () => void;
  onChangeSpeed: (speed: 1 | 4 | 16) => void;
  onOpenDisruptionModal: () => void;
}

/** Name, logical clock and run controls: the only chrome that stays on screen. */
export const TopBar = ({
  logicalTime,
  isPaused,
  speed,
  isDeliberating = false,
  onTogglePause,
  onNextEvent,
  onChangeSpeed,
  onOpenDisruptionModal,
}: TopBarProps) => {
  const status = isDeliberating
    ? "NVIDIA model deliberating"
    : isPaused
      ? "Paused · agents standby"
      : "Running";
  return (
    <header className={PILL}>
      <span className="flex items-center gap-2 px-1.5">
        <span className="grid size-6 place-items-center rounded-md bg-blue-600 text-[10px] font-bold text-white">
          WS
        </span>
        <span className="hidden text-sm font-semibold tracking-tight sm:inline">
          Warehouse Sim
        </span>
      </span>
      <span className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
      <span
        className="flex items-center gap-1.5 px-1.5 font-mono text-xs font-semibold tabular-nums text-blue-600 dark:text-blue-400"
        title={status}
      >
        <span
          className={`size-1.5 rounded-full bg-blue-500 ${isDeliberating ? "animate-ping" : isPaused ? "" : "animate-pulse"}`}
        />
        <span className="sr-only">{status} · </span>
        Day 1 · {logicalTime}
      </span>
      <button
        type="button"
        onClick={onTogglePause}
        className={BUTTON}
        aria-label={isPaused ? "Resume simulation" : "Pause simulation"}
      >
        {isPaused ? "▶" : "❚❚"}
      </button>
      <button
        type="button"
        onClick={onNextEvent}
        className={BUTTON}
        aria-label="Advance to the next scheduled event"
        title="Next event"
      >
        ⏭
      </button>
      <div
        className="flex overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700"
        title="Display pacing only; never changes simulation outcomes"
      >
        {([1, 4, 16] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChangeSpeed(s)}
            aria-pressed={speed === s}
            className={`h-6 px-1.5 text-[11px] font-medium transition-colors ${
              speed === s
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {s}×
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onOpenDisruptionModal}
        className={`${BUTTON} text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-950/60`}
      >
        ⚡ <span className="hidden sm:inline">Disruption</span>
      </button>
    </header>
  );
};

interface ViewMenuProps {
  facilityOpen: boolean;
  inspectorOpen: boolean;
  unknownCount: number;
  onToggleFacility: () => void;
  onToggleInspector: () => void;
  onOpenEvidence: () => void;
  onCheckpoint: () => void;
}

interface MoreMenuProps {
  unknownCount: number;
  onOpenEvidence: () => void;
  onCheckpoint: () => void;
}

/** The "⋯" menu: closes on a pick, an outside press or Escape (which then stops there). */
const MoreMenu = ({
  unknownCount,
  onOpenEvidence,
  onCheckpoint,
}: MoreMenuProps) => {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!(e.target instanceof Node && root.current?.contains(e.target))) {
        setOpen(false);
      }
    };
    // Capture on window runs before the scene's Escape handler, which would clear the selection.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  const pick = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="more-actions"
        aria-label="More actions"
        className={BUTTON}
      >
        ⋯
      </button>
      {open && (
        <div
          id="more-actions"
          role="menu"
          className="absolute top-full right-0 z-30 mt-2 flex w-48 flex-col rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          <button
            type="button"
            role="menuitem"
            onClick={pick(onOpenEvidence)}
            className={BUTTON}
          >
            Evidence · {unknownCount} unknowns
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={pick(onCheckpoint)}
            className={BUTTON}
          >
            ⚑ Checkpoint
          </button>
        </div>
      )}
    </div>
  );
};

/** Drawer toggles plus the rarely used actions, tucked behind "⋯". */
export const ViewMenu = ({
  facilityOpen,
  inspectorOpen,
  unknownCount,
  onToggleFacility,
  onToggleInspector,
  onOpenEvidence,
  onCheckpoint,
}: ViewMenuProps) => (
  <nav className={`${PILL} ml-auto`} aria-label="Panels">
    <button
      type="button"
      onClick={onToggleFacility}
      aria-pressed={facilityOpen}
      className={`${BUTTON} aria-pressed:bg-zinc-100 dark:aria-pressed:bg-zinc-800`}
    >
      Facility
    </button>
    <button
      type="button"
      onClick={onToggleInspector}
      aria-pressed={inspectorOpen}
      className={`${BUTTON} aria-pressed:bg-zinc-100 dark:aria-pressed:bg-zinc-800`}
    >
      Inspector
    </button>
    <MoreMenu
      unknownCount={unknownCount}
      onOpenEvidence={onOpenEvidence}
      onCheckpoint={onCheckpoint}
    />
  </nav>
);
