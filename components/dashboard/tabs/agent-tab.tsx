"use client";

import type { AgentState, DeliberationResult } from "@/lib/agents/types";
import { ProvenanceBadge } from "../provenance-badge";

interface AgentTabProps {
  onSelectEntity: (id: string) => void;
  onSwitchTab: (tab: "commitment") => void;
  agents?: AgentState[];
  activeAgentId?: string;
  onSelectAgent?: (id: string) => void;
  onTriggerDeliberation?: (id?: string) => Promise<unknown>;
  isDeliberating?: boolean;
  lastDeliberation?: DeliberationResult | null;
}

export const AgentTab = ({
  onSelectEntity,
  onSwitchTab,
  agents = [],
  activeAgentId = "DRV-047",
  onSelectAgent,
  onTriggerDeliberation,
  isDeliberating = false,
  lastDeliberation,
}: AgentTabProps) => {
  const currentAgent = agents.find((a) => a.id === activeAgentId) ?? agents[0];

  const agentRole = currentAgent?.role ?? "driver";
  const agentName = currentAgent?.name ?? "Driver DRV-047";

  return (
    <div className="space-y-3 p-3 text-xs">
      {/* Agent Selector */}
      {agents.length > 0 && onSelectAgent && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {agents.map((ag) => (
            <button
              key={ag.id}
              type="button"
              onClick={() => onSelectAgent(ag.id)}
              className={`rounded px-2 py-1 font-mono text-[10px] font-medium transition-colors ${
                ag.id === activeAgentId
                  ? "bg-blue-600 text-white dark:bg-blue-500"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              {ag.id}
            </button>
          ))}
        </div>
      )}

      {/* Header Profile */}
      <section
        key={activeAgentId}
        className="animate-rise rounded-md border border-zinc-200 bg-zinc-50/50 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/30"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm">
              {agentName} ({agentRole})
            </div>
            <div className="text-zinc-500 text-[11px]">
              Assigned entity:{" "}
              <button
                type="button"
                onClick={() =>
                  onSelectEntity(currentAgent?.assignedEntityId ?? "T-2291")
                }
                className="font-mono text-blue-600 dark:text-blue-400 underline"
              >
                {currentAgent?.assignedEntityId ?? "T-2291"}
              </button>
            </div>
          </div>
          {lastDeliberation?.agentId === activeAgentId ? (
            <span
              className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
              title={`Model: ${lastDeliberation.modelUsed}`}
            >
              {lastDeliberation.isMock ? "offline fallback" : "NVIDIA model"}
            </span>
          ) : (
            <ProvenanceBadge kind="unk">not run</ProvenanceBadge>
          )}
        </div>
        <div className="text-zinc-500 mt-1 text-[11px]">
          Proposals reach the engine only through validated tool calls.
        </div>

        {/* Deliberate Action Button */}
        {onTriggerDeliberation && (
          <div className="mt-2.5">
            <button
              type="button"
              disabled={isDeliberating}
              onClick={() => onTriggerDeliberation(activeAgentId)}
              className="w-full flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:-translate-y-px hover:bg-blue-700 active:translate-y-0 active:duration-75 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:translate-y-0 disabled:opacity-50"
            >
              {isDeliberating ? (
                <>
                  <span className="size-2 animate-spin rounded-full border border-white border-t-transparent" />
                  <span>Deliberating…</span>
                </>
              ) : (
                <span>Run deliberation</span>
              )}
            </button>
          </div>
        )}
      </section>

      {/* Recent Model Thought / Deliberation */}
      {lastDeliberation && (
        <section
          key={`${lastDeliberation.agentId}:${lastDeliberation.thought}`}
          className="animate-rise rounded-md border border-blue-500/40 bg-blue-50/30 p-2.5 dark:border-blue-500/30 dark:bg-blue-950/20"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-800 dark:text-blue-300 mb-1 flex items-center justify-between">
            <span>Agent reasoning</span>
            <span className="font-mono text-[10px] font-normal normal-case tracking-normal text-zinc-500">
              {lastDeliberation.agentId} · {lastDeliberation.modelUsed}
            </span>
          </div>
          <p className="text-zinc-800 dark:text-zinc-200 text-xs leading-relaxed">
            {lastDeliberation.thought}
          </p>
          {lastDeliberation.toolCall && (
            <div className="mt-1.5 pt-1.5 border-t border-blue-200 dark:border-blue-900/50 flex items-center justify-between font-mono text-[11px]">
              <span className="text-blue-700 dark:text-blue-300 font-semibold">
                Tool: {lastDeliberation.toolCall.tool}
              </span>
              {lastDeliberation.toolResult?.success ? (
                <span className="text-emerald-600 font-medium">Accepted</span>
              ) : lastDeliberation.toolResult ? (
                <span
                  className="text-red-600 dark:text-red-400 font-medium"
                  title={lastDeliberation.toolResult.message}
                >
                  Rejected: {lastDeliberation.toolResult.reasonCode ?? "error"}
                </span>
              ) : (
                <span className="text-zinc-500 font-medium">Not executed</span>
              )}
            </div>
          )}
        </section>
      )}

      {/* Local Observations */}
      <section>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1 flex items-center justify-between">
          <span>Observations and memory</span>
          <ProvenanceBadge kind="ill">illus→sim</ProvenanceBadge>
        </div>
        <ul className="space-y-1 text-zinc-700 dark:text-zinc-300 text-xs">
          {currentAgent && currentAgent.memory.length > 0 ? (
            currentAgent.memory.slice(-4).map((m) => (
              <li key={m.id} className="flex items-baseline gap-1.5">
                <span className="font-mono text-zinc-400 text-[10px]">
                  {m.type}
                </span>
                <span>{m.summary}</span>
              </li>
            ))
          ) : (
            <>
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
            </>
          )}
        </ul>
      </section>

      {/* Agent Inbox */}
      <section>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
          Inbox
        </div>
        <div className="space-y-1.5">
          {currentAgent && currentAgent.inbox.length > 0 ? (
            currentAgent.inbox.map((msg) => (
              <div
                key={msg.id}
                className="rounded-md border border-blue-500/50 bg-blue-50/20 p-2 dark:border-blue-500/30 dark:bg-blue-950/20"
              >
                <div className="flex justify-between items-baseline font-medium">
                  <span>
                    {msg.purpose.toUpperCase()} from {msg.fromAgentId}
                  </span>
                  <span className="font-mono text-[11px] text-zinc-400">
                    {msg.id}
                  </span>
                </div>
                <dl className="mt-0.5 grid grid-cols-[auto_1fr] gap-x-2 text-zinc-700 dark:text-zinc-300">
                  {Object.entries(msg.payload).map(([key, value]) => (
                    <div key={key} className="contents">
                      <dt className="text-zinc-500">{key}</dt>
                      <dd className="font-mono text-[11px]">
                        {typeof value === "string"
                          ? value
                          : JSON.stringify(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))
          ) : (
            <div className="rounded-md border border-zinc-200 p-2 text-zinc-500 dark:border-zinc-800">
              No pending messages.
            </div>
          )}
        </div>
      </section>

      {/* Obligations */}
      <section>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
          Obligations
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
    </div>
  );
};
