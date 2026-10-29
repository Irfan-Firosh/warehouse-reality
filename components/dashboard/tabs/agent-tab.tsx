"use client";

import { callProvenance } from "@/lib/dashboard/model-call-format";
import type { DashboardView } from "@/lib/dashboard/project-run";
import type { ModelCall } from "@/types/run";
import { ModelCallBadge } from "../model-call-badge";

interface AgentTabProps {
  /** The run's view; null before a run exists. */
  view: DashboardView | null;
  /** Every model call of the run, to find each agent's latest. */
  calls: readonly ModelCall[];
  activeAgentId: string | null;
  onSelectAgent: (id: string) => void;
  onSelectEntity: (id: string) => void;
  onSwitchTab: (tab: "commitment") => void;
}

const SECTION =
  "text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1";
const EMPTY =
  "rounded-md border border-zinc-200 p-2 text-zinc-400 italic dark:border-zinc-800";

/** One agent of the run: its latest model call, memory, inbox and obligations. */
export const AgentTab = ({
  view,
  calls,
  activeAgentId,
  onSelectAgent,
  onSelectEntity,
  onSwitchTab,
}: AgentTabProps) => {
  if (!view) {
    return (
      <div className="p-3 text-xs text-zinc-500">
        No run yet. Run the D-108 scenario to see each agent, its latest model
        call and its inbox.
      </div>
    );
  }
  const agents = view.agents;
  const agent = agents.find((a) => a.id === activeAgentId) ?? agents[0];
  if (!agent) {
    return (
      <div className="p-3 text-xs text-zinc-500">The run has no agents.</div>
    );
  }
  const lastCall = calls.findLast((c) => c.agentId === agent.id);

  return (
    <div className="space-y-3 p-3 text-xs">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {agents.map((ag) => (
          <button
            key={ag.id}
            type="button"
            onClick={() => onSelectAgent(ag.id)}
            aria-pressed={ag.id === agent.id}
            className={`rounded px-2 py-1 font-mono text-[10px] font-medium transition-colors ${
              ag.id === agent.id
                ? "bg-blue-600 text-white dark:bg-blue-500"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            {ag.id}
          </button>
        ))}
      </div>

      <section className="rounded-md border border-zinc-200 bg-zinc-50/50 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/30">
        <div className="font-semibold text-sm">
          {agent.name} ({agent.role})
        </div>
        <div className="text-[11px] text-zinc-500">
          Assigned entity:{" "}
          <button
            type="button"
            onClick={() => onSelectEntity(agent.assignedEntityId)}
            className="font-mono text-blue-600 underline dark:text-blue-400"
          >
            {agent.assignedEntityId}
          </button>
        </div>
        <div className="mt-1 text-[11px] text-zinc-500">
          Acts only through engine tool calls; the engine validates every one.
        </div>
      </section>

      <section>
        <div className={SECTION}>Latest model call</div>
        {lastCall ? (
          <ModelCallBadge
            call={lastCall}
            provenance={callProvenance(view, lastCall)}
          />
        ) : (
          <div className={EMPTY}>No turns yet</div>
        )}
      </section>

      <section>
        <div className={SECTION}>Memory</div>
        {agent.memory.length > 0 ? (
          <ul className="space-y-1 text-zinc-700 dark:text-zinc-300">
            {agent.memory.slice(-4).map((m) => (
              <li key={m.id} className="flex items-baseline gap-1.5">
                <span className="font-mono text-[10px] text-zinc-400">
                  {m.type}
                </span>
                <span>{m.summary}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className={EMPTY}>No memory items yet</div>
        )}
      </section>

      <section>
        <div className={SECTION}>Inbox (offers and messages)</div>
        <div className="space-y-1.5">
          {agent.inbox.length > 0 ? (
            agent.inbox.map((msg) => (
              <div
                key={msg.id}
                className="rounded-md border border-blue-500/50 bg-blue-50/20 p-2 dark:border-blue-500/30 dark:bg-blue-950/20"
              >
                <div className="flex items-baseline justify-between font-medium">
                  <span>
                    {msg.purpose.toUpperCase()} from {msg.fromAgentId}
                  </span>
                  <span className="font-mono text-[11px] text-zinc-400">
                    {msg.id}
                  </span>
                </div>
                <div className="mt-0.5 break-all font-mono text-[10px] text-zinc-700 dark:text-zinc-300">
                  {JSON.stringify(msg.payload)}
                </div>
              </div>
            ))
          ) : (
            <div className={EMPTY}>No messages in inbox</div>
          )}
        </div>
      </section>

      <section>
        <div className={SECTION}>Obligations</div>
        {agent.obligations.length > 0 ? (
          <ul className="space-y-1">
            {agent.obligations.map((o) => (
              <li key={`${o.commitmentId}-${o.role}`}>
                <button
                  type="button"
                  onClick={() => onSwitchTab("commitment")}
                  className="w-full rounded-md border border-zinc-200 bg-zinc-50 p-2 text-left transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-800"
                >
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    {o.commitmentId} · {o.status}
                  </span>
                  <span className="block text-zinc-700 dark:text-zinc-300">
                    {o.task}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className={EMPTY}>No obligations</div>
        )}
      </section>
    </div>
  );
};
