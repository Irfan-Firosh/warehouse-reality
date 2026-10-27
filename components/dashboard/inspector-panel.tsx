"use client";

import type { AgentState, DeliberationResult } from "@/lib/agents/types";
import type { CommitmentEntity } from "@/lib/engine/types";
import type { TabKey } from "@/types/dashboard";
import { AgentTab } from "./tabs/agent-tab";
import { CommitmentTab } from "./tabs/commitment-tab";
import { EntitiesTab } from "./tabs/entities-tab";
import { EvidenceTab } from "./tabs/evidence-tab";

interface InspectorPanelProps {
  isOpen: boolean;
  activeTab: TabKey;
  selectedId: string | null;
  onToggle: () => void;
  onSelectTab: (tab: TabKey) => void;
  onSelectEntity: (id: string) => void;
  agents?: AgentState[];
  activeAgentId?: string;
  onSelectAgent?: (id: string) => void;
  onTriggerDeliberation?: (id?: string) => Promise<unknown>;
  isDeliberating?: boolean;
  lastDeliberation?: DeliberationResult | null;
  commitments?: CommitmentEntity[];
}

export const InspectorPanel = ({
  isOpen,
  activeTab,
  selectedId,
  onToggle,
  onSelectTab,
  onSelectEntity,
  agents,
  activeAgentId,
  onSelectAgent,
  onTriggerDeliberation,
  isDeliberating,
  lastDeliberation,
}: InspectorPanelProps) => {
  if (!isOpen) {
    return (
      <aside className="w-10 shrink-0 flex flex-col items-center py-3 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <button
          type="button"
          onClick={onToggle}
          className="flex h-full w-full flex-col items-center gap-3 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          aria-label="Expand inspector panel"
        >
          <span className="text-xs font-bold">«</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider [writing-mode:vertical-rl]">
            Inspector
          </span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-full max-h-[70vh] lg:max-h-none lg:w-80 shrink-0 flex flex-col rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
      {/* Tab Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20">
        <div role="tablist" className="flex flex-1 text-xs">
          {(
            [
              { key: "agent", label: "Agent" },
              { key: "commitment", label: "Commitment" },
              { key: "evidence", label: "Evidence" },
              { key: "entities", label: "Entities" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeTab === key}
              onClick={() => onSelectTab(key)}
              className={`px-3 py-2 font-medium transition-colors border-b-2 ${
                activeTab === key
                  ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="mr-2 grid size-6 place-items-center rounded text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Collapse inspector panel"
        >
          »
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === "agent" && (
          <AgentTab
            onSelectEntity={onSelectEntity}
            onSwitchTab={() => onSelectTab("commitment")}
            agents={agents}
            activeAgentId={activeAgentId}
            onSelectAgent={onSelectAgent}
            onTriggerDeliberation={onTriggerDeliberation}
            isDeliberating={isDeliberating}
            lastDeliberation={lastDeliberation}
          />
        )}
        {activeTab === "commitment" && (
          <CommitmentTab onSelectEntity={onSelectEntity} />
        )}
        {activeTab === "evidence" && <EvidenceTab />}
        {activeTab === "entities" && (
          <EntitiesTab
            selectedId={selectedId}
            onSelectEntity={onSelectEntity}
          />
        )}
      </div>
    </aside>
  );
};
