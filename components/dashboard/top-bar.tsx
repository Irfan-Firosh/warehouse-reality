"use client";

import { ProvenanceBadge } from "./provenance-badge";

interface TopBarProps {
  logicalTime: string;
  isPaused: boolean;
  speed: 1 | 4 | 16;
  isDeliberating?: boolean;
  onTogglePause: () => void;
  onNextEvent: () => void;
  onChangeSpeed: (speed: 1 | 4 | 16) => void;
  onOpenEvidence: () => void;
  onOpenDisruptionModal: () => void;
  onCheckpoint: () => void;
  onBranch: () => void;
  onCompare: () => void;
  onToggleTheme: () => void;
}

const BTN =
  "inline-flex h-7 items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 text-xs font-medium transition hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700";

export const TopBar = ({
  logicalTime,
  isPaused,
  speed,
  isDeliberating = false,
  onTogglePause,
  onNextEvent,
  onChangeSpeed,
  onOpenEvidence,
  onOpenDisruptionModal,
  onCheckpoint,
  onBranch,
  onCompare,
  onToggleTheme,
}: TopBarProps) => {
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50">
      <div className="flex items-center gap-2">
        <div className="grid size-7 place-items-center rounded-md bg-blue-600 text-xs font-bold text-white">
          WS
        </div>
        <span className="font-semibold text-sm tracking-tight">
          Warehouse Sim
        </span>
      </div>

      <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />

      <div className="flex flex-col leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Profile
        </span>
        <span className="text-xs font-medium flex items-center gap-1.5">
          DFW Bldg I <ProvenanceBadge kind="src">v1 · S1</ProvenanceBadge>
        </span>
      </div>

      <div className="flex flex-col leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Workload
        </span>
        <span className="text-xs font-medium flex items-center gap-1">
          Demo Day v2 <ProvenanceBadge kind="drv">vol derived</ProvenanceBadge>
        </span>
      </div>

      <div className="flex flex-col leading-tight hidden md:flex">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Run mode
        </span>
        <span className="text-xs font-medium flex items-center gap-1">
          Distributed agents · FCFS fallback
        </span>
      </div>

      <div className="flex flex-col leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Logical time
        </span>
        <span className="font-mono tabular-nums text-xs font-semibold text-blue-600 dark:text-blue-400">
          Day 1 · {logicalTime}
        </span>
      </div>

      <div className="flex flex-col leading-tight hidden lg:flex">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Evidence
        </span>
        <div className="flex items-center gap-1">
          <ProvenanceBadge
            kind="unk"
            onClick={onOpenEvidence}
            title="Click to view 14 unknown DFW fields"
          >
            14 unknowns
          </ProvenanceBadge>
          <ProvenanceBadge
            kind="drv"
            onClick={onOpenEvidence}
            title="Click to view derived trip ends"
          >
            1 derived
          </ProvenanceBadge>
        </div>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <span className="mr-1 hidden xl:inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
          <span
            className={`size-1.5 rounded-full bg-blue-500 ${isDeliberating ? "animate-pulse" : ""}`}
          />
          {isDeliberating
            ? "Agent deliberating…"
            : isPaused
              ? "Time paused · agents standby"
              : "Simulation running"}
        </span>

        <button
          type="button"
          onClick={onTogglePause}
          className={BTN}
          title={isPaused ? "Resume simulation" : "Pause simulation"}
        >
          {isPaused ? "▶ Resume" : "❚❚ Pause"}
        </button>

        <button
          type="button"
          onClick={onNextEvent}
          className={BTN}
          title="Advance to next scheduled event"
        >
          Next event
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
              className={`h-7 px-2 text-xs font-medium tabular-nums transition-colors ${
                speed === s
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-white text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              {s}×
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onCheckpoint}
          className={`${BTN} hidden sm:inline-flex`}
        >
          Checkpoint
        </button>

        <button
          type="button"
          onClick={onBranch}
          className={`${BTN} hidden sm:inline-flex`}
        >
          Branch
        </button>

        <button
          type="button"
          onClick={onCompare}
          className={`${BTN} hidden md:inline-flex`}
        >
          Compare
        </button>

        <button
          type="button"
          onClick={onOpenDisruptionModal}
          className="group inline-flex h-7 items-center gap-1 rounded-md bg-amber-600 px-2.5 text-xs font-medium text-white transition hover:-translate-y-px hover:bg-amber-700 focus-visible:outline-2 focus-visible:outline-amber-500"
        >
          Inject disruption
          <span
            aria-hidden="true"
            className="transition-transform group-hover:translate-x-[3px]"
          >
            →
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          className={`${BTN} w-7 justify-center px-0`}
          title="Toggle color theme"
          aria-label="Toggle theme"
        >
          ◐
        </button>
      </div>
    </header>
  );
};
