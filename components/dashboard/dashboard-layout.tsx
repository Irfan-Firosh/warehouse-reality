"use client";

import { useCallback, useState } from "react";
import { SceneLoader } from "@/components/scene/scene-loader";
import { UNKNOWN_DFW_FIELDS } from "@/lib/dashboard/data";
import { useSimulation } from "@/lib/dashboard/use-simulation";
import type { TabKey } from "@/types/dashboard";
import { CausalTimeline } from "./causal-timeline";
import { DisruptionModal } from "./disruption-modal";
import { FacilityPanel } from "./facility-panel";
import { InspectorPanel } from "./inspector-panel";
import { TopBar, ViewMenu } from "./top-bar";

export const DashboardLayout = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
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

  const handleInjectDisruption = useCallback(
    async (disruptionId: string) => {
      showToast(
        `Injected ${disruptionId} disruption into authoritative engine`,
      );
      await injectDisruption(disruptionId);

      if (disruptionId === "H-1") {
        handleSelectEntity("D-108");
        setActiveAgentId("DOCK-C");
        setActiveTab("agent");
      } else if (disruptionId === "H-2") {
        handleSelectEntity("F-07");
        setActiveAgentId("SUP-1");
        setActiveTab("agent");
      }
    },
    [handleSelectEntity, injectDisruption, setActiveAgentId, showToast],
  );

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-zinc-100 font-sans text-zinc-950 antialiased select-none dark:bg-zinc-950 dark:text-zinc-50">
      {/* The 3D scene fills the window; everything else floats over it. */}
      <section className="absolute inset-0">
        <SceneLoader
          selectedId={selectedId}
          onSelectEntity={handleSelectEntity}
          speed={speed}
        />
      </section>

      {toastMessage && (
        <output
          aria-live="polite"
          className="fixed top-16 left-1/2 z-50 -translate-x-1/2 rounded-md bg-zinc-900/90 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-xs transition-all dark:bg-zinc-100/90 dark:text-zinc-900"
        >
          {toastMessage}
        </output>
      )}

      <DisruptionModal
        isOpen={disruptionModalOpen}
        onClose={() => setDisruptionModalOpen(false)}
        onInject={handleInjectDisruption}
      />

      {/* Drawers sit below the top row at whatever height it wraps or expands to. */}
      <div className="pointer-events-none absolute inset-x-3 top-3 bottom-16 z-20 flex flex-col gap-2">
        <div className="flex flex-wrap items-start gap-2">
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
            onOpenDisruptionModal={() => setDisruptionModalOpen(true)}
          />
          <CausalTimeline events={timelineEvents} />
          <ViewMenu
            facilityOpen={leftOpen}
            inspectorOpen={rightOpen}
            unknownCount={UNKNOWN_DFW_FIELDS.length}
            onToggleFacility={() => setLeftOpen((o) => !o)}
            onToggleInspector={() => setRightOpen((o) => !o)}
            onOpenEvidence={handleOpenEvidence}
            onCheckpoint={() => showToast(createCheckpoint())}
          />
        </div>

        <div className="relative min-h-0 flex-1">
          <FacilityPanel
            isOpen={leftOpen}
            counts={counts}
            stateVersion={stateVersion}
            onToggle={() => setLeftOpen((o) => !o)}
            onSelectEntity={handleSelectEntity}
            onOpenEvidence={handleOpenEvidence}
          />

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
        </div>
      </div>
    </div>
  );
};
