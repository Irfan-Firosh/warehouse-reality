"use client";

import { useCallback, useEffect, useState } from "react";
import { SceneLoader } from "@/components/scene/scene-loader";
import { useSimulation } from "@/lib/dashboard/use-simulation";
import type { ExternalDisruptionConfig } from "@/lib/external/disruption-types";
import type { TabKey } from "@/types/dashboard";
import { CausalTimeline } from "./causal-timeline";
import { DisruptionModal } from "./disruption-modal";
import { FacilityPanel } from "./facility-panel";
import { InspectorPanel } from "./inspector-panel";
import { ProvenanceBadge } from "./provenance-badge";
import { TopBar } from "./top-bar";

export const DashboardLayout = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("agent");
  const [disruptionModalOpen, setDisruptionModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Authoritative simulation & agent integration
  const {
    logicalTime,
    stateVersion,
    isPaused,
    speed,
    isDeliberating,
    activeAgentId,
    agents,
    commitments,
    timelineEvents,
    counts,
    lastDeliberation,
    togglePause,
    setSpeed,
    setActiveAgentId,
    nextStep,
    injectDisruption,
    triggerAgentDeliberation,
    createCheckpoint,
  } = useSimulation();

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3500);
  }, []);

  const handleSelectEntity = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id) {
      setRightOpen(true);
    }
  }, []);

  const handleOpenEvidence = useCallback(() => {
    setRightOpen(true);
    setActiveTab("evidence");
  }, []);

  // Start from the OS preference; the toggle overrides it for this session.
  useEffect(() => {
    document.documentElement.classList.toggle(
      "dark",
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
  }, []);

  const handleToggleTheme = useCallback(() => {
    document.documentElement.classList.toggle("dark");
  }, []);

  const handleInjectDisruption = useCallback(
    async (disruptionId: string, externalConfig?: ExternalDisruptionConfig) => {
      showToast(
        externalConfig?.source === "fixture"
          ? `Injected synthetic ${disruptionId} disruption into authoritative engine`
          : `Injected ${disruptionId} disruption into authoritative engine`,
      );
      await injectDisruption(disruptionId, externalConfig);

      if (disruptionId === "H-1" || externalConfig?.targetId === "D-108") {
        handleSelectEntity("D-108");
        setActiveAgentId("DOCK-C");
        setActiveTab("agent");
      } else if (
        disruptionId === "H-2" ||
        externalConfig?.targetId === "F-07"
      ) {
        handleSelectEntity("F-07");
        setActiveAgentId("SUP-1");
        setActiveTab("agent");
      } else if (externalConfig?.targetId === "DRV-047") {
        handleSelectEntity("T-2291");
        setActiveAgentId("DRV-047");
        setActiveTab("agent");
      }
    },
    [handleSelectEntity, injectDisruption, setActiveAgentId, showToast],
  );

  return (
    <div className="flex min-h-dvh w-full flex-col gap-2 p-2 lg:h-dvh lg:overflow-hidden select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <output
          aria-live="polite"
          className="fixed top-4 left-1/2 z-50 -translate-x-1/2"
        >
          <span className="block animate-rise rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            {toastMessage}
          </span>
        </output>
      )}

      {/* Disruption Modal */}
      <DisruptionModal
        isOpen={disruptionModalOpen}
        onClose={() => setDisruptionModalOpen(false)}
        onInject={handleInjectDisruption}
      />

      {/* Disclaimer Banner and Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-md border border-dashed border-amber-500/60 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-1 text-[11px] text-amber-900 dark:text-amber-300">
        <span>
          Prototype · engine state v{stateVersion} · scene and summary counts
          are illustrative.
        </span>
        <span className="text-zinc-400">·</span>
        <span className="flex items-center gap-1">
          <ProvenanceBadge kind="src">S1</ProvenanceBadge>
          <span className="text-zinc-500">published spec</span>
        </span>
        <span className="flex items-center gap-1">
          <ProvenanceBadge kind="drv">derived</ProvenanceBadge>
          <span className="text-zinc-500">derived conversion</span>
        </span>
        <span className="flex items-center gap-1">
          <ProvenanceBadge kind="hyp">hypothetical</ProvenanceBadge>
          <span className="text-zinc-500">injected</span>
        </span>
        <span className="flex items-center gap-1">
          <ProvenanceBadge kind="unk">unknown</ProvenanceBadge>
          <span className="text-zinc-500">no evidence</span>
        </span>
        <span className="flex items-center gap-1">
          <ProvenanceBadge kind="ill">illus→sim</ProvenanceBadge>
          <span className="text-zinc-500">placeholder</span>
        </span>
      </div>

      {/* Top Bar */}
      <TopBar
        logicalTime={logicalTime}
        isPaused={isPaused}
        speed={speed}
        isDeliberating={isDeliberating}
        onTogglePause={() => {
          togglePause();
          showToast(isPaused ? "Simulation resumed" : "Simulation paused");
        }}
        onNextEvent={async () => {
          showToast("Advancing engine clock & stepping agent deliberation");
          await nextStep();
        }}
        onChangeSpeed={setSpeed}
        onOpenEvidence={handleOpenEvidence}
        onOpenDisruptionModal={() => setDisruptionModalOpen(true)}
        onCheckpoint={() => {
          const msg = createCheckpoint();
          showToast(msg);
        }}
        onBranch={() => showToast("Created branch: 'FCFS Baseline Comparison'")}
        onCompare={() =>
          showToast("Comparing: Distributed Agents vs. FCFS Baseline")
        }
        onToggleTheme={handleToggleTheme}
      />

      {/* Main 3-Column Working Grid */}
      <main className="flex min-h-0 flex-1 flex-col gap-2 lg:grid lg:grid-cols-[auto_1fr_auto] lg:overflow-hidden">
        {/* Left: Facility & Capacity */}
        <FacilityPanel
          isOpen={leftOpen}
          counts={counts}
          onToggle={() => setLeftOpen((o) => !o)}
          onSelectEntity={handleSelectEntity}
          onOpenEvidence={handleOpenEvidence}
        />

        {/* Center: 3D Scene Viewport */}
        <section className="relative order-first h-[60vh] min-h-0 overflow-hidden rounded-lg border border-zinc-200 bg-white lg:order-none lg:h-auto dark:border-zinc-800 dark:bg-zinc-900">
          <SceneLoader
            selectedId={selectedId}
            onSelectEntity={handleSelectEntity}
          />
        </section>

        {/* Right: Inspector Tabs */}
        <InspectorPanel
          isOpen={rightOpen}
          activeTab={activeTab}
          selectedId={selectedId}
          onToggle={() => setRightOpen((o) => !o)}
          onSelectTab={setActiveTab}
          onSelectEntity={handleSelectEntity}
          agents={agents}
          activeAgentId={activeAgentId}
          onSelectAgent={setActiveAgentId}
          onTriggerDeliberation={triggerAgentDeliberation}
          isDeliberating={isDeliberating}
          lastDeliberation={lastDeliberation}
          commitments={commitments}
        />
      </main>

      {/* Bottom: Causal Event Timeline */}
      <CausalTimeline events={timelineEvents} />
    </div>
  );
};
