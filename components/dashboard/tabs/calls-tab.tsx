"use client";

import {
  callProvenance,
  callsWithoutUsage,
} from "@/lib/dashboard/model-call-format";
import type { DashboardView } from "@/lib/dashboard/project-run";
import type { ModelCall } from "@/types/run";
import { BudgetMeter } from "../budget-meter";
import { ModelCallBadge } from "../model-call-badge";

interface CallsTabProps {
  view: DashboardView | null;
  /** Every model call of the run. */
  calls: readonly ModelCall[];
}

const SECTION =
  "text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1";

/** Budget, calls by provenance, and every model call with its badge, newest first. */
export const CallsTab = ({ view, calls }: CallsTabProps) => {
  if (!view) {
    return (
      <div className="p-3 text-xs text-zinc-500">
        No run yet, so no model calls.
      </div>
    );
  }
  const s = view.provenanceSummary;
  const newestFirst = [...calls].reverse();
  return (
    <div className="space-y-3 p-3 text-xs">
      <section>
        <div className={SECTION}>Run budget</div>
        <BudgetMeter
          budget={view.budget}
          unreportedCalls={callsWithoutUsage(view, calls)}
        />
      </section>
      <section>
        <div className={SECTION}>Calls by provenance</div>
        <dl className="grid grid-cols-4 gap-1 text-center font-mono text-[10px]">
          {(
            [
              ["Nemotron", s.nemotron],
              ["fallback", s.fallback],
              ["baseline", s.baseline],
              ["other", s.other],
            ] as const
          ).map(([label, n]) => (
            <div
              key={label}
              className="rounded border border-zinc-200 py-1 dark:border-zinc-800"
            >
              <dt className="text-zinc-500">{label}</dt>
              <dd className="text-sm font-semibold">{n}</dd>
            </div>
          ))}
        </dl>
        {s.other > 0 && (
          <p className="mt-1 text-[10px] text-zinc-500">
            Other: replayed or scripted decisions, no live model call.
          </p>
        )}
      </section>
      <section>
        <div className={SECTION}>All {calls.length} calls · newest first</div>
        {newestFirst.length === 0 ? (
          <p className="rounded-md border border-zinc-200 p-2 italic text-zinc-400 dark:border-zinc-800">
            No model calls yet
          </p>
        ) : (
          <ul className="space-y-1.5">
            {newestFirst.map((c) => (
              <li key={c.id}>
                <ModelCallBadge call={c} provenance={callProvenance(view, c)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
