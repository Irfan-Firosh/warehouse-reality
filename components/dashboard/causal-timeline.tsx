"use client";

import { useState } from "react";
import { TIMELINE_EVENTS } from "@/lib/dashboard/data";
import type { TimelineEventType } from "@/types/dashboard";
import { ProvenanceBadge } from "./provenance-badge";

const CARD_STYLES: Record<TimelineEventType, string> = {
  disruption:
    "border-amber-500/60 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200",
  engine:
    "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200",
  stale:
    "border-red-400/60 bg-red-50/50 dark:bg-red-950/20 text-red-900 dark:text-red-300",
  offer:
    "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200",
  accept:
    "border-blue-400/60 bg-blue-50/30 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200",
  commit:
    "border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 font-medium",
  action:
    "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200",
  scheduled:
    "border-dashed border-zinc-400 dark:border-zinc-700 bg-zinc-50/40 dark:bg-zinc-950/20 text-zinc-500",
};

export const CausalTimeline = () => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <footer className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 px-3 py-2 text-zinc-950 dark:text-zinc-50 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <span className="text-[10px]">{isOpen ? "▾" : "▸"}</span>
          <span>Causal Timeline · Disruption H-1 → Commitment C-88</span>
          <ProvenanceBadge kind="ill">illus→sim</ProvenanceBadge>
        </button>
        <span className="text-[11px] text-zinc-500 font-mono hidden sm:inline">
          Inference: 2 calls · 1.8 s · reported separately from logical time
        </span>
      </div>

      {isOpen && (
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 pb-1 text-xs">
          {TIMELINE_EVENTS.map((evt, idx) => (
            <div key={evt.id} className="flex items-center gap-1.5 shrink-0">
              <div
                className={`flex flex-col gap-0.5 rounded-md border px-2.5 py-1.5 text-[11px] leading-tight min-w-36 ${CARD_STYLES[evt.type]}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-[10px] opacity-75">
                    {evt.time}
                  </span>
                  {evt.tag && (
                    <ProvenanceBadge kind="hyp">{evt.tag}</ProvenanceBadge>
                  )}
                  {evt.isLLM && (
                    <span className="rounded bg-blue-100 px-1 text-[9px] font-semibold text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                      LLM
                    </span>
                  )}
                </div>
                <div className="font-semibold text-[11px] font-mono">
                  {evt.source}
                </div>
                <div className="truncate max-w-44" title={evt.title}>
                  {evt.title}
                </div>
              </div>
              {idx < TIMELINE_EVENTS.length - 1 && (
                <span className="text-zinc-400 select-none text-xs">→</span>
              )}
            </div>
          ))}
        </div>
      )}
    </footer>
  );
};
