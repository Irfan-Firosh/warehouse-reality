"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { layoutBounds, MINIATURE_VIEW as VIEW } from "@/lib/scene/camera-fit";
import { exceptionOptions } from "@/lib/scene/exceptions";
import {
  CLOSED_DOOR,
  entitiesById,
  ILLUSTRATIVE_STATE,
  TARGET_DOOR,
} from "@/lib/scene/illustrative-state";
import { buildLayout } from "@/lib/scene/layout";
import { CameraRig } from "./camera-rig";
import { MiniatureLens } from "./miniature-lens";
import { PRIMITIVE_KIT } from "./model-kit";
import { usePalette } from "./palette";
import { type MeshMode, SceneOverlay } from "./scene-overlay";
import { SelectionMarks } from "./selection-marks";
import { Fixtures, Shell } from "./site";
import { useGraphicsContext } from "./use-graphics-context";
import { useModelKit } from "./use-model-kit";
import { LANES, Vehicles } from "./vehicles";

const DEG = Math.PI / 180;
const CLICK_SLOP_PX = 5;
/** Sun from the south-west, high enough that dock faces stay lit. */
const SUN_AT = [-700, 1500, 900] as const;
const SHADOW_EXTENT = 1300;
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
  const bounds = useMemo(() => layoutBounds(layout.values()), [layout]);
  const [lens, setLens] = useState(true);
  const [homeSignal, setHomeSignal] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const selected = selectedId !== undefined ? selectedId : internalSelected;
  const setSelected = onSelectEntity ?? setInternalSelected;
  const [roof, setRoof] = useState(true);
  const [modelsOn, setModelsOn] = useState(true);
  const models = useModelKit(modelsOn);
  const { graphics, canvasKey, onCreated } = useGraphicsContext();

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
        if (travel.current.max <= CLICK_SLOP_PX) setSelected(id);
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
        camera={{ fov: VIEW.fovY / DEG, near: 5, far: 20000 }}
        dpr={[1, 1.5]}
        shadows="percentage"
        onCreated={onCreated}
        onPointerMissed={onPointerMissed}
        role="img"
        aria-label="Schematic 3D view of DFW Commerce Center Building I with an illustrative run state"
      >
        <color attach="background" args={[palette.bg]} />
        <hemisphereLight
          args={[palette.sky, palette.bounce, palette.skyIntensity]}
        />
        <directionalLight
          position={[...SUN_AT]}
          color={palette.sun}
          intensity={palette.sunIntensity}
          castShadow
          shadow-mapSize={[4096, 4096]}
          shadow-bias={-0.0004}
          shadow-camera-left={-SHADOW_EXTENT}
          shadow-camera-right={SHADOW_EXTENT}
          shadow-camera-top={SHADOW_EXTENT}
          shadow-camera-bottom={-SHADOW_EXTENT}
          shadow-camera-near={100}
          shadow-camera-far={5000}
        />
        <Shell bounds={bounds} palette={palette} roof={roof} pick={pick} />
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
          makeDefault
          enableDamping
          maxPolarAngle={Math.PI * 0.47}
        />
        <CameraRig bounds={bounds} view={VIEW} homeSignal={homeSignal} />
        {lens && (
          <MiniatureLens
            focus={selected ? layout.get(selected) : undefined}
            saturation={palette.saturation}
          />
        )}
      </Canvas>
      <SceneOverlay
        roof={roof}
        lens={lens}
        meshes={meshes}
        graphicsLost={graphics === "lost"}
        exceptions={EXCEPTIONS}
        selected={selected ? ENTITIES.get(selected) : undefined}
        onSelect={setSelected}
        onToggleRoof={() => setRoof((r) => !r)}
        onToggleMeshes={() => setModelsOn((on) => !on)}
        onToggleLens={() => setLens((on) => !on)}
        onReset={() => setHomeSignal((n) => n + 1)}
      />
    </div>
  );
};
