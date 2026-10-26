"use client";

import { DEPENDENCIES, UNKNOWN_DFW_FIELDS } from "@/lib/dashboard/data";
import { S1 } from "@/lib/scene/facility";
import type { DashboardCounts } from "@/types/dashboard";
import { ProvenanceBadge } from "./provenance-badge";

interface FacilityPanelProps {
  isOpen: boolean;
  counts: DashboardCounts;
  onToggle: () => void;
  onSelectEntity: (id: string) => void;
  onOpenEvidence: () => void;
}

export const FacilityPanel = ({
  isOpen,
  counts,
  onToggle,
  onSelectEntity,
  onOpenEvidence,
}: FacilityPanelProps) => {
  if (!isOpen) {
    return (
      <aside className="w-10 shrink-0 flex flex-col items-center py-3 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-xs">
        <button
          type="button"
          onClick={onToggle}
          className="flex h-full w-full flex-col items-center gap-3 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          aria-label="Expand facility panel"
        >
          <span className="text-xs font-bold">»</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider [writing-mode:vertical-rl]">
            Facility
          </span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-72 shrink-0 flex flex-col rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-xs overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Facility Resources
        </span>
        <button
          type="button"
          onClick={onToggle}
          className="grid size-6 place-items-center rounded text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Collapse facility panel"
        >
          «
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
        {/* Published Capacity */}
        <details open className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between font-semibold uppercase tracking-wider text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="flex items-center gap-1">
              <span className="transition-transform group-open:rotate-90">
                ▸
              </span>
              Published Capacity
            </span>
            <ProvenanceBadge kind="src">S1</ProvenanceBadge>
          </summary>
          <div className="space-y-1 text-zinc-700 dark:text-zinc-300">
            <div className="flex justify-between">
              <span>Dock-high doors</span>
              <span className="font-mono font-medium">{S1.dockDoors}</span>
            </div>
            <div className="flex justify-between">
              <span>Ramp doors</span>
              <span className="font-mono font-medium">{S1.rampDoors}</span>
            </div>
            <div className="flex justify-between">
              <span>Trailer spaces</span>
              <span className="font-mono font-medium">{S1.trailerSpaces}</span>
            </div>
            <div className="flex justify-between">
              <span>Automobile spaces</span>
              <span className="font-mono font-medium">572</span>
            </div>
            <div className="flex justify-between">
              <span>Gross floor area</span>
              <span className="font-mono font-medium">1,000,584 sf</span>
            </div>
          </div>
        </details>

        {/* Workload Volume */}
        <details
          open
          className="group border-t border-zinc-100 dark:border-zinc-800/60 pt-2"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between font-semibold uppercase tracking-wider text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="flex items-center gap-1">
              <span className="transition-transform group-open:rotate-90">
                ▸
              </span>
              Workload Volume
            </span>
          </summary>
          <div className="space-y-1 text-zinc-700 dark:text-zinc-300">
            <div className="flex justify-between items-center">
              <span>DFW daily truck visits</span>
              <ProvenanceBadge kind="unk">unknown</ProvenanceBadge>
            </div>
            <div className="flex justify-between items-center">
              <span>Scenario visits/day</span>
              <span className="flex items-center gap-1 font-mono">
                ≈117
                <ProvenanceBadge
                  kind="drv"
                  onClick={onOpenEvidence}
                  title="Click to view derivation formula"
                >
                  derived ⓘ
                </ProvenanceBadge>
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 leading-tight">
              ITE/NAIOP high-cube study: 0.233 trip ends / 1,000 GSF × 1,000.584
              ÷ 2.
            </p>
            <div className="flex justify-between items-center">
              <span>Arrival times & service</span>
              <ProvenanceBadge kind="ill">illus→user</ProvenanceBadge>
            </div>
          </div>
        </details>

        {/* Occupancy Now */}
        <details
          open
          className="group border-t border-zinc-100 dark:border-zinc-800/60 pt-2"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between font-semibold uppercase tracking-wider text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="flex items-center gap-1">
              <span className="transition-transform group-open:rotate-90">
                ▸
              </span>
              Live Occupancy
            </span>
            <ProvenanceBadge kind="ill">illus→sim</ProvenanceBadge>
          </summary>
          <div className="space-y-1 text-zinc-700 dark:text-zinc-300">
            <div className="flex justify-between">
              <span>Doors occupied</span>
              <span className="font-mono font-medium">
                {counts.doorsOccupied} / {S1.dockDoors}
              </span>
            </div>
            <div className="flex justify-between text-zinc-500 dark:text-zinc-400 text-[11px]">
              <span>serving · blocked</span>
              <span className="font-mono">
                {counts.doorsServing} · {counts.doorsBlocked}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Closed · reserved</span>
              <span className="font-mono">
                <button
                  type="button"
                  onClick={() => onSelectEntity("D-108")}
                  className="text-amber-600 dark:text-amber-400 underline font-mono"
                >
                  D-108
                </button>{" "}
                ·{" "}
                <button
                  type="button"
                  onClick={() => onSelectEntity("D-112")}
                  className="text-blue-600 dark:text-blue-400 underline font-mono"
                >
                  D-112
                </button>
              </span>
            </div>
            <div className="flex justify-between">
              <span>Stalls occupied</span>
              <span className="font-mono font-medium">
                {counts.stallsOccupied} / {S1.trailerSpaces}
              </span>
            </div>
            <div className="flex justify-between items-center text-zinc-500">
              <span>Observed DFW occupancy</span>
              <ProvenanceBadge kind="unk">unknown</ProvenanceBadge>
            </div>
          </div>
        </details>

        {/* Queues & Dependencies */}
        <details
          open
          className="group border-t border-zinc-100 dark:border-zinc-800/60 pt-2"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between font-semibold uppercase tracking-wider text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="flex items-center gap-1">
              <span className="transition-transform group-open:rotate-90">
                ▸
              </span>
              Queues & Dependencies
            </span>
            <ProvenanceBadge kind="ill">illus→sim</ProvenanceBadge>
          </summary>
          <div className="space-y-1 text-zinc-700 dark:text-zinc-300">
            <div className="flex justify-between">
              <span>Gate queue</span>
              <span className="font-mono">{counts.gateQueue}</span>
            </div>
            <div className="flex justify-between">
              <span>Yard waiting for door</span>
              <span className="font-mono">{counts.yardWaiting}</span>
            </div>
            <div className="flex justify-between font-medium text-amber-700 dark:text-amber-400">
              <span>Outbound blocked freight</span>
              <span className="font-mono">{counts.outboundBlocked}</span>
            </div>

            <ul className="space-y-1 border-l-2 border-amber-400/50 pl-2 text-[11px] text-zinc-600 dark:text-zinc-400">
              {DEPENDENCIES.map((dep) => (
                <li key={dep.door} className="leading-snug">
                  <button
                    type="button"
                    onClick={() => onSelectEntity(dep.door)}
                    className="font-mono text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {dep.door}
                  </button>{" "}
                  needs {dep.shipment} · {dep.reason}
                </li>
              ))}
            </ul>
          </div>
        </details>

        {/* Missing DFW Evidence Register */}
        <details
          open
          className="group border-t border-zinc-100 dark:border-zinc-800/60 pt-2"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between font-semibold uppercase tracking-wider text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="flex items-center gap-1">
              <span className="transition-transform group-open:rotate-90">
                ▸
              </span>
              Missing DFW Evidence (14)
            </span>
          </summary>
          <div className="flex flex-wrap gap-1 mt-1">
            {UNKNOWN_DFW_FIELDS.map((field) => (
              <ProvenanceBadge key={field} kind="unk">
                {field}
              </ProvenanceBadge>
            ))}
          </div>
        </details>
      </div>
    </aside>
  );
};
