"use client";

import {
  Ellipsis,
  PanelLeft,
  PanelRight,
  Pause,
  Play,
  SkipForward,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TextureButton } from "@/components/ui/texture-button";

const PILL =
  "pointer-events-auto flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-zinc-200 bg-white/90 p-1 text-zinc-950 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-50";
const ICON = "size-5 p-0.5";
const MENU_ITEM =
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
      <TextureButton
        variant="icon"
        size="icon"
        onClick={onTogglePause}
        aria-label={isPaused ? "Resume simulation" : "Pause simulation"}
      >
        {isPaused ? <Play className={ICON} /> : <Pause className={ICON} />}
      </TextureButton>
      <TextureButton
        variant="icon"
        size="icon"
        onClick={onNextEvent}
        aria-label="Advance to the next scheduled event"
        title="Next event"
      >
        <SkipForward className={ICON} />
      </TextureButton>
      <div
        className="flex gap-0.5"
        title="Display pacing only; never changes simulation outcomes"
      >
        {([1, 4, 16] as const).map((s) => (
          <TextureButton
            key={s}
            variant={speed === s ? "primary" : "minimal"}
            size="sm"
            className="w-auto"
            onClick={() => onChangeSpeed(s)}
            aria-pressed={speed === s}
          >
            {s}×
          </TextureButton>
        ))}
      </div>
      <TextureButton
        variant="destructive"
        size="sm"
        className="w-auto"
        onClick={onOpenDisruptionModal}
        aria-label="Inject a disruption"
      >
        <Zap className="size-3.5" />
        <span className="hidden sm:inline">Disruption</span>
      </TextureButton>
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
      <TextureButton
        ref={trigger}
        variant="icon"
        size="icon"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="more-actions"
        aria-label="More actions"
      >
        <Ellipsis className={ICON} />
      </TextureButton>
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
            className={MENU_ITEM}
          >
            Evidence · {unknownCount} unknowns
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={pick(onCheckpoint)}
            className={MENU_ITEM}
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
    <TextureButton
      variant={facilityOpen ? "primary" : "minimal"}
      size="sm"
      className="w-auto"
      onClick={onToggleFacility}
      aria-pressed={facilityOpen}
    >
      <PanelLeft className="size-3.5" />
      Facility
    </TextureButton>
    <TextureButton
      variant={inspectorOpen ? "primary" : "minimal"}
      size="sm"
      className="w-auto"
      onClick={onToggleInspector}
      aria-pressed={inspectorOpen}
    >
      <PanelRight className="size-3.5" />
      Inspector
    </TextureButton>
    <MoreMenu
      unknownCount={unknownCount}
      onOpenEvidence={onOpenEvidence}
      onCheckpoint={onCheckpoint}
    />
  </nav>
);
