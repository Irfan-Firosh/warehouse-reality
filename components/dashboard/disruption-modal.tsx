"use client";

import { useState } from "react";
import {
  DEFAULT_QUERY,
  type ExternalDisruptionConfig,
  type ExternalSearchResult,
  externalSearchResultSchema,
} from "@/lib/external/disruption-types";
import { ProvenanceBadge } from "./provenance-badge";

interface DisruptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInject: (
    disruptionId: string,
    externalConfig?: ExternalDisruptionConfig,
  ) => void;
}

export const DisruptionModal = ({
  isOpen,
  onClose,
  onInject,
}: DisruptionModalProps) => {
  const [activeTab, setActiveTab] = useState<"hypothetical" | "tavily">(
    "hypothetical",
  );
  const [searchQuery, setSearchQuery] = useState(DEFAULT_QUERY);
  const [searchResult, setSearchResult] = useState<ExternalSearchResult | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  if (!isOpen) return null;

  const liveIncidents = searchResult?.disruptions ?? [];
  const isFixture = searchResult?.source === "fixture";

  const handleFetchLiveIncidents = async () => {
    setIsLoading(true);
    setSearchError(null);
    try {
      const res = await fetch("/api/disruptions/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: searchQuery }),
      });
      const parsed = externalSearchResultSchema.safeParse(await res.json());
      if (res.ok && parsed.success) {
        setSearchResult(parsed.data);
      } else {
        setSearchError("Failed to retrieve external incidents");
      }
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : "Network error contacting Tavily",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="disruption-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-amber-500 font-bold">⚡</span>
            <h2 id="disruption-title" className="font-semibold text-sm">
              Simulation Disruption Injector
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("hypothetical")}
            className={`px-3 py-1.5 font-medium border-b-2 transition-colors ${
              activeTab === "hypothetical"
                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            Preset Scenarios (H-1, H-2, H-3)
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("tavily");
              if (!searchResult) {
                handleFetchLiveIncidents();
              }
            }}
            className={`px-3 py-1.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === "tavily"
                ? "border-sky-500 text-sky-600 dark:text-sky-400"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <span>External Incidents</span>
            <span className="rounded bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 px-1 py-0.2 text-[9px] font-mono">
              Tavily
            </span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="overflow-y-auto space-y-3 flex-1 pr-1 text-xs">
          {activeTab === "hypothetical" ? (
            <>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-[11px]">
                Preset hypothetical disruptions test whether autonomous
                operational agents detect capacity conflicts and negotiate
                feasible alternatives through the authoritative engine.
              </p>

              <div className="space-y-2">
                {/* H-1 */}
                <div className="rounded-md border border-amber-500/40 bg-amber-50/50 p-2.5 dark:bg-amber-950/20 text-xs">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="font-semibold text-amber-900 dark:text-amber-200">
                      Dock Door Closure (H-1)
                    </span>
                    <ProvenanceBadge kind="hyp">injected</ProvenanceBadge>
                  </div>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mb-2">
                    Close dock door D-108 for 2 hours (14:00–16:00). Pauses
                    active unloading on trailer T-2291, forcing agents to
                    negotiate reassignment.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onInject("H-1");
                      onClose();
                    }}
                    className="w-full rounded bg-amber-600 py-1 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
                  >
                    Apply H-1 Disruption
                  </button>
                </div>

                {/* H-2 */}
                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/40 text-xs">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="font-semibold">
                      Equipment Outage (H-2)
                    </span>
                    <ProvenanceBadge kind="hyp">ready</ProvenanceBadge>
                  </div>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mb-2">
                    Declare forklift F-07 hydraulic fault. Releases active
                    pallet task and requires crew lead reassignment.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onInject("H-2");
                      onClose();
                    }}
                    className="w-full rounded border border-zinc-300 bg-white py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Apply H-2 Disruption
                  </button>
                </div>

                {/* H-3 */}
                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/40 text-xs">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="font-semibold">Driver Delay (H-3)</span>
                    <ProvenanceBadge kind="hyp">ready</ProvenanceBadge>
                  </div>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mb-2">
                    Driver DRV-047 reports 45 min highway delay; triggers slot
                    swap proposal with waiting carrier.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onInject("H-3");
                      onClose();
                    }}
                    className="w-full rounded border border-zinc-300 bg-white py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Apply H-3 Disruption
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-[11px]">
                Search the past week of news for corridor and weather incidents
                near the facility. Each result is mapped to a hypothetical
                disruption; a news report is not evidence that this facility was
                affected.
              </p>

              {/* Search Bar */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. I-35 Dallas lane closure, DFW hail warning..."
                  className="flex-1 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleFetchLiveIncidents}
                  className="rounded bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white px-3 py-1 font-medium text-xs transition-colors shrink-0"
                >
                  {isLoading ? "Searching..." : "Search Web"}
                </button>
              </div>

              {searchError && (
                <div className="rounded p-2 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs">
                  {searchError}
                </div>
              )}

              {isFixture && (
                <div className="rounded p-2 bg-zinc-500/10 border border-dashed border-zinc-400 text-zinc-600 dark:text-zinc-400 text-[11px]">
                  Showing synthetic examples, not search results.{" "}
                  {searchResult?.fallbackReason}
                </div>
              )}

              {/* Results List */}
              <div className="space-y-2">
                {liveIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="rounded-md border border-sky-500/30 bg-sky-50/40 dark:bg-sky-950/20 p-2.5 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs line-clamp-1">
                          {incident.title}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className="uppercase font-mono px-1 py-0.2 rounded bg-sky-200 dark:bg-sky-800/60 text-sky-900 dark:text-sky-200 font-bold">
                            {incident.category}
                          </span>
                          {incident.url && (
                            <>
                              <span className="text-zinc-400">·</span>
                              <a
                                href={incident.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sky-600 dark:text-sky-400 hover:underline truncate max-w-[200px]"
                              >
                                Source Article ↗
                              </a>
                            </>
                          )}
                          {incident.publishedDate && (
                            <span className="text-zinc-400">
                              {incident.publishedDate.slice(0, 16)}
                            </span>
                          )}
                        </div>
                      </div>
                      {isFixture ? (
                        <ProvenanceBadge kind="ill">synthetic</ProvenanceBadge>
                      ) : (
                        <ProvenanceBadge kind="src">web</ProvenanceBadge>
                      )}
                    </div>

                    <p className="text-[11px] text-zinc-600 dark:text-zinc-300 line-clamp-2">
                      {incident.summary}
                    </p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">
                      {incident.suggestedAction.impactHypothesis}
                    </p>

                    <div className="pt-1 flex items-center justify-between border-t border-sky-500/15">
                      <span className="text-[10px] text-zinc-500">
                        Target:{" "}
                        <strong className="text-zinc-700 dark:text-zinc-300 font-mono">
                          {incident.suggestedAction.targetEntityId}
                        </strong>{" "}
                        ({incident.suggestedAction.disruptionType})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onInject(incident.id, {
                            title: incident.title,
                            type: incident.suggestedAction.disruptionType,
                            targetId: incident.suggestedAction.targetEntityId,
                            directive:
                              incident.suggestedAction.suggestedDirective,
                            source: isFixture ? "fixture" : "tavily",
                            url: incident.url,
                          });
                          onClose();
                        }}
                        className="rounded bg-sky-600 py-1 px-2.5 text-[11px] font-medium text-white hover:bg-sky-700 transition-colors"
                      >
                        Inject as Hypothesis
                      </button>
                    </div>
                  </div>
                ))}

                {liveIncidents.length === 0 && !isLoading && (
                  <p className="text-center py-4 text-zinc-400 text-xs">
                    Click "Search Web" to search recent news with Tavily.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-1 border-t border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
