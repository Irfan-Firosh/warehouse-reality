"use client";

import { useState } from "react";
import { TIMELINE_EVENTS } from "@/lib/dashboard/data";
import type { TimelineEvent, TimelineEventType } from "@/types/dashboard";
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

interface CausalTimelineProps {
  events?: readonly TimelineEvent[];
}

/** The newest event that has happened; scheduled ones are still in the future. */
const latestOf = (
  events: readonly TimelineEvent[],
): TimelineEvent | undefined =>
  events.findLast((e) => e.type !== "scheduled") ?? events[0];

/**
 * One line with the latest event; it opens into the full causal chain on a
 * line of its own. Both are items of the parent flex-wrap row.
 */
export const CausalTimeline = ({
  events = TIMELINE_EVENTS,
}: CausalTimelineProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const latest = latestOf(events);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls="causal-timeline"
        className="pointer-events-auto order-last flex h-9 min-w-0 grow basis-full items-center gap-2 sm:order-none sm:basis-0 rounded-lg border border-zinc-200 bg-white/90 px-2.5 text-xs text-zinc-700 shadow-sm backdrop-blur-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        <span className="text-[10px]">{isOpen ? "▾" : "▸"}</span>
        {latest ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="font-mono text-[10px] text-zinc-500">
              {latest.time}
            </span>
            <span className="font-mono font-semibold">{latest.source}</span>
            <span className="truncate">{latest.title}</span>
          </span>
        ) : (
          <span>No events yet</span>
        )}
        <ProvenanceBadge kind="ill">illus→sim</ProvenanceBadge>
      </button>

      {isOpen && (
        <div
          id="causal-timeline"
          className="pointer-events-auto order-last min-w-0 basis-full rounded-lg border border-zinc-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95"
        >
          <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
            <span className="font-semibold uppercase tracking-wider">
              Causal timeline · Disruption H-1 → Commitment C-88
            </span>
            <span className="hidden font-mono sm:inline">
              Inference reported separately from logical time
            </span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2 pb-1 text-xs">
            {events.map((evt, idx) => (
              <div key={evt.id} className="flex shrink-0 items-center gap-1.5">
                <div
                  className={`flex min-w-36 flex-col gap-0.5 rounded-md border px-2.5 py-1.5 text-[11px] leading-tight ${CARD_STYLES[evt.type]}`}
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
                  <div className="font-mono text-[11px] font-semibold">
                    {evt.source}
                  </div>
                  <div className="max-w-44 truncate" title={evt.title}>
                    {evt.title}
                  </div>
                </div>
                {idx < events.length - 1 && (
                  <span className="select-none text-xs text-zinc-400">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
