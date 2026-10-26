"use client";

import { useCallback, useState } from "react";
import { SceneLoader } from "@/components/scene/scene-loader";
import { calculateDashboardCounts, LOGICAL_TIME } from "@/lib/dashboard/data";
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
  const [isPaused, setIsPaused] = useState(true);
  const [speed, setSpeed] = useState<1 | 4 | 16>(4);
  const [disruptionModalOpen, setDisruptionModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const counts = calculateDashboardCounts();

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3000);
  }, []);

  const handleSelectEntity = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id) {
      // Ensure right inspector is open and switched to entities or agent
      setRightOpen(true);
    }
  }, []);

  const handleOpenEvidence = useCallback(() => {
    setRightOpen(true);
    setActiveTab("evidence");
  }, []);

  const handleToggleTheme = useCallback(() => {
    document.documentElement.classList.toggle("dark");
  }, []);

  return (
    <div className="flex h-dvh w-full flex-col gap-2 p-2 bg-zinc-100 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 font-sans antialiased overflow-hidden select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <output
          aria-live="polite"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-md bg-zinc-900/90 dark:bg-zinc-100/90 text-white dark:text-zinc-900 px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-xs transition-all"
        >
          {toastMessage}
        </output>
      )}

      {/* Disruption Modal */}
      <DisruptionModal
        isOpen={disruptionModalOpen}
        onClose={() => setDisruptionModalOpen(false)}
        onInject={(disruptionId) => {
          showToast(`Injected ${disruptionId} disruption into active branch`);
          if (disruptionId === "H-1") {
            handleSelectEntity("D-108");
          } else if (disruptionId === "H-2") {
            handleSelectEntity("F-07");
          }
        }}
      />

      {/* Disclaimer Banner and Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-md border border-dashed border-amber-500/60 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-1 text-[11px] text-amber-900 dark:text-amber-300">
        <span>
          Design preview: run state, IDs, times and counts are illustrative
          placeholders, not facility data or run results.
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
        logicalTime={LOGICAL_TIME}
        isPaused={isPaused}
        speed={speed}
        onTogglePause={() => {
          setIsPaused((p) => !p);
          showToast(isPaused ? "Simulation resumed" : "Simulation paused");
        }}
        onNextEvent={() => showToast("Advanced to next event (14:08:00)")}
        onChangeSpeed={setSpeed}
        onOpenEvidence={handleOpenEvidence}
        onOpenDisruptionModal={() => setDisruptionModalOpen(true)}
        onCheckpoint={() =>
          showToast("Saved checkpoint CP-1407 (state version v3815)")
        }
        onBranch={() => showToast("Created branch: 'FCFS Baseline Comparison'")}
        onCompare={() =>
          showToast("Comparing: Distributed Agents vs. FCFS Baseline")
        }
        onToggleTheme={handleToggleTheme}
      />

      {/* Main 3-Column Working Grid */}
      <main className="grid min-h-0 flex-1 grid-cols-[auto_1fr_auto] gap-2 overflow-hidden">
        {/* Left: Facility & Capacity */}
        <FacilityPanel
          isOpen={leftOpen}
          counts={counts}
          onToggle={() => setLeftOpen((o) => !o)}
          onSelectEntity={handleSelectEntity}
          onOpenEvidence={handleOpenEvidence}
        />

        {/* Center: 3D Scene Viewport */}
        <section className="relative min-h-0 flex-1 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-xs overflow-hidden">
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
        />
      </main>

      {/* Bottom: Causal Event Timeline */}
      <CausalTimeline />
    </div>
  );
};
