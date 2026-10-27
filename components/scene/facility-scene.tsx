"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import {
  type ComponentRef,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { exceptionOptions } from "@/lib/scene/exceptions";
import {
  CLOSED_DOOR,
  entitiesById,
  ILLUSTRATIVE_STATE,
  TARGET_DOOR,
} from "@/lib/scene/illustrative-state";
import { buildLayout } from "@/lib/scene/layout";
import { type CameraGoal, CameraRig, goalFrom } from "./camera-rig";
import { PRIMITIVE_KIT } from "./model-kit";
import { usePalette } from "./palette";
import { type MeshMode, SceneOverlay } from "./scene-overlay";
import { SelectionMarks } from "./selection-marks";
import { Fixtures, Shell } from "./site";
import { useGraphicsContext } from "./use-graphics-context";
import { useModelKit } from "./use-model-kit";
import { LANES, Vehicles } from "./vehicles";

const HOME = { position: [-1250, 1150, 1550], target: [-160, 0, 60] } as const;
const CLICK_SLOP_PX = 5;
// Focus keeps the home viewing angle but pulls in to this distance from the entity.
const FOCUS_DISTANCE = 650;
const VIEW_DIR = [
  HOME.position[0] - HOME.target[0],
  HOME.position[1] - HOME.target[1],
  HOME.position[2] - HOME.target[2],
] as const;
const VIEW_LEN = Math.hypot(...VIEW_DIR);
const STATE = ILLUSTRATIVE_STATE;
const ENTITIES = entitiesById(STATE);
const EXCEPTIONS = exceptionOptions(STATE);

export interface FacilitySceneProps {
  selectedId?: string | null;
  onSelectEntity?: (id: string | null) => void;
}

export const FacilityScene = ({
  selectedId,
  onSelectEntity,
}: FacilitySceneProps) => {
  const palette = usePalette();
  const layout = useMemo(
    () => buildLayout(STATE, [CLOSED_DOOR, TARGET_DOOR]),
    [],
  );
  const [hovered, setHovered] = useState<string | null>(null);
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const selected = selectedId !== undefined ? selectedId : internalSelected;
  const setSelected = onSelectEntity ?? setInternalSelected;
  const [roof, setRoof] = useState(true);
  const [modelsOn, setModelsOn] = useState(true);
  const models = useModelKit(modelsOn);
  const { graphics, canvasKey, onCreated } = useGraphicsContext();

  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const cameraGoal = useRef<CameraGoal | null>(null);
  // Selections made in the canvas keep the camera still; others glide to the entity.
  const selectedInCanvas = useRef(false);

  const meshes: MeshMode = !modelsOn
    ? "off"
    : models.state === "ready"
      ? "models"
      : models.state;
  const kit = modelsOn && models.state === "ready" ? models.kit : PRIMITIVE_KIT;

  // A drag that orbits the camera must not count as a click, even if it ends near its start.
  const travel = useRef({ x: 0, y: 0, max: 0 });
  const onPointerDown = (e: ReactPointerEvent) => {
    travel.current = { x: e.clientX, y: e.clientY, max: 0 };
    cameraGoal.current = null;
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (e.buttons === 0) return;
    const t = travel.current;
    travel.current = {
      ...t,
      max: Math.max(t.max, Math.hypot(e.clientX - t.x, e.clientY - t.y)),
    };
  };
  const pick = useMemo(
    () => ({
      onHover: setHovered,
      onSelect: (id: string | null) => {
        if (travel.current.max <= CLICK_SLOP_PX) {
          selectedInCanvas.current = true;
          setSelected(id);
        }
      },
    }),
    [setSelected],
  );
  const onPointerMissed = (e: MouseEvent) => {
    setHovered(null);
    if (e.type === "click") pick.onSelect(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSelected]);

  const resetCamera = useCallback(() => {
    cameraGoal.current = goalFrom(HOME.position, HOME.target);
  }, []);

  useEffect(() => {
    const fromCanvas = selectedInCanvas.current;
    selectedInCanvas.current = false;
    const at = selected ? layout.get(selected) : undefined;
    if (!at || fromCanvas) return;
    const k = FOCUS_DISTANCE / VIEW_LEN;
    cameraGoal.current = goalFrom(
      [at.x + VIEW_DIR[0] * k, at.y + VIEW_DIR[1] * k, at.z + VIEW_DIR[2] * k],
      [at.x, at.y, at.z],
    );
  }, [selected, layout]);

  const hoverEntity = hovered ? ENTITIES.get(hovered) : undefined;
  const hoverAt = hovered ? layout.get(hovered) : undefined;

  return (
    <div
      className="relative h-full w-full"
      onPointerDownCapture={onPointerDown}
      onPointerMoveCapture={onPointerMove}
    >
      <Canvas
        key={canvasKey}
        camera={{ fov: 38, near: 5, far: 20000, position: [...HOME.position] }}
        dpr={[1, 2]}
        onCreated={onCreated}
        onPointerMissed={onPointerMissed}
        role="img"
        aria-label="Schematic 3D view of DFW Commerce Center Building I with an illustrative run state"
      >
        <color attach="background" args={[palette.bg]} />
        <hemisphereLight args={[0xffffff, 0x666670, 1.6]} />
        <directionalLight position={[-600, 1200, 500]} intensity={1.4} />
        <Shell palette={palette} roof={roof} pick={pick} />
        {LANES.map((lane) => (
          <mesh key={`${lane.x},${lane.z}`} position={[lane.x, 1, lane.z]}>
            <boxGeometry args={[70, 0.4, 120]} />
            <meshLambertMaterial color={palette.staging} />
          </mesh>
        ))}
        <Fixtures state={STATE} layout={layout} palette={palette} pick={pick} />
        <Vehicles
          kit={kit}
          state={STATE}
          layout={layout}
          palette={palette}
          pick={pick}
        />
        <SelectionMarks
          selected={selected ? layout.get(selected) : undefined}
          hovered={
            hoverEntity && hoverAt
              ? { entity: hoverEntity, at: hoverAt }
              : undefined
          }
        />
        <OrbitControls
          ref={controls}
          makeDefault
          enableDamping
          maxPolarAngle={Math.PI * 0.47}
          target={[...HOME.target]}
        />
        <CameraRig controls={controls} goal={cameraGoal} />
      </Canvas>
      <SceneOverlay
        roof={roof}
        meshes={meshes}
        graphicsLost={graphics === "lost"}
        exceptions={EXCEPTIONS}
        selected={selected ? ENTITIES.get(selected) : undefined}
        onSelect={setSelected}
        onToggleRoof={() => setRoof((r) => !r)}
        onToggleMeshes={() => setModelsOn((on) => !on)}
        onReset={resetCamera}
      />
    </div>
  );
};
