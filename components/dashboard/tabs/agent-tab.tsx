"use client";

import { ProvenanceBadge } from "../provenance-badge";

interface AgentTabProps {
  onSelectEntity: (id: string) => void;
  onSwitchTab: (tab: "commitment") => void;
}

export const AgentTab = ({ onSelectEntity, onSwitchTab }: AgentTabProps) => {
  return (
    <div className="space-y-3 p-3 text-xs">
      <section className="rounded-md border border-zinc-200 bg-zinc-50/50 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/30">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm">Driver · DRV-047</div>
            <div className="text-zinc-500 text-[11px]">
              Visit V-047 · trailer{" "}
              <button
                type="button"
                onClick={() => onSelectEntity("T-2291")}
                className="font-mono text-blue-600 dark:text-blue-400 underline"
              >
                T-2291
              </button>{" "}
              · inbound, 22 pallets
            </div>
          </div>
          <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
            LLM decided
          </span>
        </div>
        <div className="text-zinc-500 mt-1 text-[11px]">
          Decision owner: LLM agent · Fallback: FCFS rules after 2 failed calls
        </div>
        <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
          <span className="rounded bg-zinc-200/80 px-1.5 py-0.5 dark:bg-zinc-800 font-mono">
            report ETA
          </span>
          <span className="rounded bg-zinc-200/80 px-1.5 py-0.5 dark:bg-zinc-800 font-mono">
            request appointment
          </span>
          <span className="rounded bg-zinc-200/80 px-1.5 py-0.5 dark:bg-zinc-800 font-mono">
            accept / decline offer
          </span>
        </div>
      </section>

      {/* Local Observations */}
      <section>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1 flex items-center justify-between">
          <span>Local Observations</span>
          <ProvenanceBadge kind="ill">illus→sim</ProvenanceBadge>
        </div>
        <ul className="space-y-1 text-zinc-700 dark:text-zinc-300 text-xs">
          <li className="flex items-baseline gap-1.5">
            <span className="font-mono text-zinc-400 text-[11px]">
              14:00:00
            </span>
            <span>
              Door{" "}
              <button
                type="button"
                onClick={() => onSelectEntity("D-108")}
                className="font-mono text-amber-600 underline"
              >
                D-108
              </button>{" "}
              closed, service paused{" "}
              <ProvenanceBadge kind="hyp">H-1</ProvenanceBadge>
            </span>
          </li>
          <li className="flex items-baseline gap-1.5">
            <span className="font-mono text-zinc-400 text-[11px]">
              14:00:00
            </span>
            <span>Own trailer at D-108, 9 of 22 pallets unloaded</span>
          </li>
          <li className="flex items-baseline gap-1.5">
            <span className="font-mono text-zinc-400 text-[11px]">
              14:02:10
            </span>
            <span>
              Departure target 15:30{" "}
              <ProvenanceBadge kind="ill">illus→user</ProvenanceBadge>
            </span>
          </li>
        </ul>
      </section>

      {/* Agent Inbox */}
      <section>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
          Agent Inbox (Offers)
        </div>
        <div className="space-y-1.5">
          <div className="rounded-md border border-blue-500/50 bg-blue-50/20 p-2 dark:border-blue-500/30 dark:bg-blue-950/20">
            <div className="flex justify-between items-baseline font-medium">
              <span>OFFER from DOCK-C</span>
              <span className="font-mono text-[11px] text-zinc-400">
                M-311 · 14:02:40
              </span>
            </div>
            <div className="text-zinc-700 dark:text-zinc-300">
              Relocate to{" "}
              <button
                type="button"
                onClick={() => onSelectEntity("D-112")}
                className="font-mono text-blue-600 underline"
              >
                D-112
              </button>
              , window 14:20–15:05
            </div>
            <div className="font-mono text-[10px] text-zinc-400">
              expires 14:12 · state v3812
            </div>
            <div className="mt-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              → accepted 14:04:40 (M-312)
            </div>
          </div>

          <div className="rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
            <div className="flex justify-between items-baseline font-medium text-zinc-600 dark:text-zinc-400">
              <span>OFFER from DOCK-D</span>
              <span className="font-mono text-[11px] text-zinc-400">
                M-308 · 14:01:50
              </span>
            </div>
            <div className="text-zinc-500">D-140, window 15:40–16:30</div>
            <div className="text-[11px] text-zinc-400 italic">
              → declined: misses departure target
            </div>
          </div>
        </div>
      </section>

      {/* Obligations */}
      <section>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
          Current Obligations
        </div>
        <button
          type="button"
          onClick={() => onSwitchTab("commitment")}
          className="w-full text-left rounded-md border border-zinc-200 bg-zinc-50 p-2 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-800 transition-colors"
        >
          <div className="flex justify-between items-baseline">
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              Commitment C-88 · committed
            </span>
            <span className="font-mono text-[10px] text-zinc-400">v3815</span>
          </div>
          <div className="text-zinc-700 dark:text-zinc-300">
            DRV-047, DOCK-C, YARD-1, CREW-3
          </div>
          <div className="font-mono text-[11px] text-zinc-500 mt-0.5">
            D-112 14:20–15:05 · YT-2 · crew CR-3
          </div>
        </button>
      </section>

      {/* Executed Actions */}
      <section>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
          Executed Actions
        </div>
        <ul className="space-y-1 text-zinc-700 dark:text-zinc-300">
          <li className="flex items-center gap-1.5">
            <span className="rounded bg-emerald-100 px-1 text-[10px] font-mono font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              OK
            </span>
            <span>accept_offer M-311</span>
            <span className="font-mono text-zinc-400 text-[10px]">A-899</span>
          </li>
          <li className="flex items-center gap-1.5">
            <span className="rounded bg-emerald-100 px-1 text-[10px] font-mono font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              OK
            </span>
            <span>decline_offer M-308</span>
            <span className="font-mono text-zinc-400 text-[10px]">A-897</span>
          </li>
        </ul>
      </section>
    </div>
  );
};
