// Mockup scene in React Three Fiber, at S1 scale (1 unit = 1 ft).
// Every pickable instance comes from scene-data.js, the same records the panels
// and the entity table read. Rendering never feeds back into state.

import { Canvas, useThree } from "@react-three/fiber";
import {
  Suspense,
  use,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { fitModel } from "./models.js";
import { ASSETS, Boundary, html, useOrbit } from "./r3f-deps.js";
import {
  ENTITIES,
  KIND_LABEL,
  S1,
  STATE,
  seeded,
  statusText,
} from "./scene-data.js";
import { HALF_D, HALF_L, LAYOUT } from "./scene-layout.js";
import { bus, getSelected, getView, sceneFailed, selectEntity } from "./ui.js";

const PALETTE = {
  light: {
    bg: 0xe4e4e7,
    ground: 0xd4d4d8,
    asphalt: 0xa1a1aa,
    wall: 0x9ca3af,
    roof: 0xb8b8c0,
    floor: 0xcfcfd4,
    trailer: 0xf4f4f5,
    chassis: 0x52525b,
    road: 0x3f3f46,
    yard: 0x475569,
    free: 0x71717a,
    stallFree: 0xe4e4e7,
    stallUsed: 0x8a8a93,
    staging: 0xbfc5d2,
    load: 0xc8a97e,
  },
  dark: {
    bg: 0x111113,
    ground: 0x18181b,
    asphalt: 0x3a3a41,
    wall: 0x52525b,
    roof: 0x5b5b63,
    floor: 0x2a2a2f,
    trailer: 0xd4d4d8,
    chassis: 0x27272a,
    road: 0x5b5b66,
    yard: 0x4b5d7a,
    free: 0x6b6b74,
    stallFree: 0x8b8b94,
    stallUsed: 0x27272a,
    staging: 0x3a4152,
    load: 0x9c8462,
  },
};
const STATUS = {
  serving: 0x10b981,
  blocked: 0xf59e0b,
  waiting: 0xf59e0b,
  gate: 0xf59e0b,
  closed: 0xef4444,
  failed: 0xef4444,
  reserved: 0x06b6d4,
  selected: 0x3b6ff0,
  unknown: 0xa78bfa,
};
const WHITE = 0xffffff;
const CLICK_SLOP_PX = 5;
const HOME = { pos: [-1250, 1150, 1550], target: [-160, 0, 60] };
const ORBIT = { enableDamping: true, maxPolarAngle: Math.PI * 0.47 };
const RUN_ONLY = new Set(["trailer", "tractor", "forklift"]);
const MESH_LABEL = {
  off: "Meshes: primitives",
  loading: "Meshes: loading models, primitives shown",
  loaded: "Meshes: free models (CC0/CC BY)",
  failed: "Meshes: models failed, primitives shown",
};

// Store glue: re-render on ui.js bus events
const useBus = (types) => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    for (const t of types) bus.addEventListener(t, bump);
    return () => {
      for (const t of types) bus.removeEventListener(t, bump);
    };
  }, []);
  return tick;
};
const palette = () =>
  document.documentElement.classList.contains("dark")
    ? PALETTE.dark
    : PALETTE.light;
const useDomButton = (id, onClick) => {
  useEffect(() => {
    const el = document.getElementById(id);
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [id, onClick]);
};

// Tooltip and selection handlers shared by every pickable mesh
const tip = document.getElementById("tip");
const hideTip = () => tip.classList.add("hidden");
const showTip = (ev, id) => {
  const entity = ENTITIES.get(id);
  if (!entity) return hideTip();
  const rect = ev.target.getBoundingClientRect();
  tip.innerHTML = `<b>${entity.id}</b> · ${KIND_LABEL[entity.kind]}<br>${statusText(entity, getView())}`;
  tip.style.left = `${ev.clientX - rect.left + 14}px`;
  tip.style.top = `${ev.clientY - rect.top + 14}px`;
  tip.classList.remove("hidden");
};
// Click vs orbit: a press whose pointer ever strays past the slop is a drag,
// even if it ends near where it started.
const press = { at: null, travel: 0 };
const trackPress = (el) => {
  el.addEventListener(
    "pointerdown",
    (ev) => Object.assign(press, { at: [ev.clientX, ev.clientY], travel: 0 }),
    true,
  );
  el.addEventListener(
    "pointermove",
    (ev) => {
      if (!press.at) return;
      const d = Math.hypot(ev.clientX - press.at[0], ev.clientY - press.at[1]);
      press.travel = Math.max(press.travel, d);
    },
    true,
  );
  el.addEventListener("pointerup", () => (press.at = null), true);
};
const pickHandlers = (idAt) => ({
  onPointerMove: (e) => {
    e.stopPropagation();
    showTip(e.nativeEvent, idAt(e));
  },
  onPointerOut: hideTip,
  onClick: (e) => {
    e.stopPropagation();
    if (press.travel <= CLICK_SLOP_PX) selectEntity(idAt(e));
  },
});
// Shell, ground and courts block picking of whatever is behind them
const BLOCK = pickHandlers(() => null);

// Instancing: one InstancedMesh per model part, sharing per-item matrices
const UP = new THREE.Vector3(0, 1, 0);
const matrixOf = (p) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(p.x, p.y, p.z),
    new THREE.Quaternion().setFromAxisAngle(UP, p.rotY ?? 0),
    new THREE.Vector3(1, 1, 1),
  );

const Instanced = ({ parts, items, colorOf, tick, ids }) => {
  const refs = useRef([]);
  useLayoutEffect(() => {
    for (const mesh of refs.current) {
      items.forEach((it, k) => mesh.setMatrixAt(k, matrixOf(it)));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [parts, items]);
  useLayoutEffect(() => {
    const c = new THREE.Color();
    refs.current.forEach((mesh, i) => {
      items.forEach((it, k) =>
        mesh.setColorAt(k, c.setHex(parts[i].tint ? colorOf(it) : WHITE)),
      );
      mesh.instanceColor.needsUpdate = true;
    });
  }, [parts, items, tick]);
  const handlers = ids ? pickHandlers((e) => ids[e.instanceId]) : {};
  return html`<group>${parts.map(
    (p, i) =>
      html`<instancedMesh key=${i} ref=${(m) => (refs.current[i] = m)} args=${[p.geometry, p.material, items.length]} ...${handlers} />`,
  )}</group>`;
};

// Primitive parts: a box with its bottom at y = 0, tinted per instance
const boxPart = ([w, h, d]) => [
  {
    geometry: new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0),
    material: new THREE.MeshLambertMaterial(),
    tint: true,
  },
];
const atBottom = (l, lift = 0) => ({
  x: l.x,
  y: l.y - l.size[1] / 2 + lift,
  z: l.z,
  rotY: l.rotY,
});

// Tractors face away from the trailer they pull
const tractorItem = (e) => {
  const l = LAYOUT.get(e.id);
  const t = LAYOUT.get(e.at);
  const rotY = t ? Math.atan2(l.x - t.x, l.z - t.z) : l.rotY;
  return { ...atBottom(l), rotY, id: e.id, e };
};

const statusColor = (e, p) => {
  const observed = getView() === "observed";
  if (observed && !RUN_ONLY.has(e.kind)) return STATUS.unknown;
  if (e.kind === "door" || e.kind === "ramp")
    return e.status === "free" ? p.free : STATUS[e.status];
  if (e.kind === "stall") return e.trailer ? p.stallUsed : p.stallFree;
  if (e.kind === "trailer")
    return e.status !== "serving" && STATUS[e.status]
      ? STATUS[e.status]
      : p.trailer;
  if (e.kind === "forklift")
    return e.status === "failed" ? STATUS.failed : WHITE;
  return e.role === "yard" ? p.yard : p.road;
};

// Vehicle proxies take their sizes from LAYOUT, so models, primitives and the
// selection highlight share one box. A trailer is a chassis at the bottom of
// its LAYOUT box with the body filling the rest.
const VEHICLE_SIZES = {
  tractor: LAYOUT.get("YT-2").size,
  trailer: LAYOUT.get("T-2291").size,
  forklift: LAYOUT.get("F-01").size,
};
const CHASSIS_H = 2;
const TRAILER_BODY = [
  VEHICLE_SIZES.trailer[0],
  VEHICLE_SIZES.trailer[1] - CHASSIS_H,
  VEHICLE_SIZES.trailer[2],
];
const CHASSIS = boxPart([7.5, CHASSIS_H, VEHICLE_SIZES.trailer[2] - 3]);
const PALLET_SIZE = [3.4, 0.55, 4];

// Free models (default) or primitives, bound to the same ids
const KIT_SPECS = {
  tractor: {
    asset: "semi",
    fit: {
      size: VEHICLE_SIZES.tractor,
      uniform: true,
      drop: "spike",
      front: "spike",
      recolor: { base: WHITE },
      tint: ["base"],
    },
  },
  trailerBody: {
    asset: "container",
    fit: { size: TRAILER_BODY, recolor: { Red: WHITE }, tint: ["Red"] },
  },
  forklift: {
    asset: "forklift",
    fit: { size: VEHICLE_SIZES.forklift, uniform: true, tint: "all" },
  },
  pallet: { asset: "pallet", fit: { size: PALLET_SIZE, uniform: true } },
};
const KIT_KEYS = Object.keys(KIT_SPECS);
const KIT_URLS = KIT_KEYS.map((k) => ASSETS[KIT_SPECS[k].asset].url);
const PRIMITIVES = Object.fromEntries(
  KIT_KEYS.map((k) => [k, boxPart(KIT_SPECS[k].fit.size)]),
);

// Load and fit once per page; remounts reuse the same geometry. A failed
// fetch or fit rejects the one promise, which `use` throws to the Boundary.
const loader = new GLTFLoader();
let kitPromise = null;
const loadKit = () =>
  (kitPromise ??= Promise.all(
    KIT_URLS.map((url) => loader.loadAsync(url)),
  ).then((gltfs) =>
    Object.fromEntries(
      KIT_KEYS.map((k, i) => [k, fitModel(gltfs[i].scene, KIT_SPECS[k].fit)]),
    ),
  ));

const Vehicles = ({ kit, tick }) => {
  const p = palette();
  const trailers = useMemo(
    () =>
      STATE.trailers.map((e) => ({
        ...atBottom(LAYOUT.get(e.id)),
        id: e.id,
        e,
      })),
    [],
  );
  const bodies = useMemo(
    () => trailers.map((t) => ({ ...t, y: t.y + CHASSIS_H })),
    [trailers],
  );
  const tractors = useMemo(() => STATE.tractors.map(tractorItem), []);
  const forklifts = useMemo(
    () =>
      STATE.forklifts.map((e) => ({
        ...atBottom(LAYOUT.get(e.id)),
        id: e.id,
        e,
      })),
    [],
  );
  const ids = (list) => list.map((it) => it.id);
  const color = (it) => statusColor(it.e, p);
  return html`<group>
    <${Instanced} parts=${CHASSIS} items=${trailers} colorOf=${() => p.chassis} tick=${tick} ids=${ids(trailers)} />
    <${Instanced} parts=${kit.trailerBody} items=${bodies} colorOf=${color} tick=${tick} ids=${ids(bodies)} />
    <${Instanced} parts=${kit.tractor} items=${tractors} colorOf=${color} tick=${tick} ids=${ids(tractors)} />
    <${Instanced} parts=${kit.forklift} items=${forklifts} colorOf=${color} tick=${tick} ids=${ids(forklifts)} />
  </group>`;
};

// Static facility geometry
const courtW = S1.courtDepth + S1.trailerParkDepth;
const Box = ({ size, pos, color, block }) =>
  html`<mesh position=${pos} ...${block ? BLOCK : {}}><boxGeometry args=${size} /><meshLambertMaterial color=${color} /></mesh>`;

const Site = ({ roof }) => {
  const p = palette();
  const wallH = S1.clearHeight + 4;
  const walls = [
    [
      [S1.length, wallH, 2],
      [0, wallH / 2, -HALF_D],
    ],
    [
      [S1.length, wallH, 2],
      [0, wallH / 2, HALF_D],
    ],
    [
      [2, wallH, S1.depth],
      [-HALF_L, wallH / 2, 0],
    ],
    [
      [2, wallH, S1.depth],
      [HALF_L, wallH / 2, 0],
    ],
  ];
  return html`<group>
    <${Box} size=${[S1.length + 900, 1, S1.depth + 2 * courtW + 500]} pos=${[0, -1, 0]} color=${p.ground} block />
    ${[-1, 1].map((s) => html`<${Box} key=${s} size=${[S1.length + 120, 0.5, courtW]} pos=${[0, 0, s * (HALF_D + courtW / 2)]} color=${p.asphalt} block />`)}
    <${Box} size=${[S1.length, 0.6, S1.depth]} pos=${[0, 0.4, 0]} color=${p.floor} block />
    ${walls.map(([size, pos], i) => html`<${Box} key=${i} size=${size} pos=${pos} color=${p.wall} block />`)}
    ${roof && html`<${Box} size=${[S1.length, 2, S1.depth]} pos=${[0, wallH + 1, 0]} color=${p.roof} block />`}
  </group>`;
};

// Staging lanes (schematic floor marks)
const LANES = Array.from({ length: 28 }, (_, i) => ({
  x: -HALF_L + 80 + (i >> 1) * 115,
  z: (i % 2 ? 1 : -1) * (HALF_D - 110),
}));
const StagingLanes = () => {
  const p = palette();
  return html`<group>${LANES.map((ln, i) => html`<${Box} key=${i} size=${[70, 0.4, 120]} pos=${[ln.x, 1, ln.z]} color=${p.staging} />`)}</group>`;
};

// Pallets with loads: decoration only, not cargo records. Shown in the run view
// only, and labeled as decoration in the legend.
const PALLET_ITEMS = (() => {
  const rand = seeded(5);
  return LANES.flatMap((ln) =>
    Array.from({ length: 18 }, (_, k) => ({
      x: ln.x - 24 + (k % 3) * 24,
      y: 1.2,
      z: ln.z - 50 + Math.floor(k / 3) * 20,
      rotY: 0,
    })).filter(() => rand() < 0.6),
  );
})();
const LOAD_ITEMS = PALLET_ITEMS.map((it) => ({
  ...it,
  y: it.y + PALLET_SIZE[1],
}));
const LOAD_PART = boxPart([3.6, 3.4, 3.1]);
const Pallets = ({ pallet, tick }) => {
  const p = palette();
  return html`<group>
    <${Instanced} parts=${pallet} items=${PALLET_ITEMS} colorOf=${() => WHITE} tick=${tick} />
    <${Instanced} parts=${LOAD_PART} items=${LOAD_ITEMS} colorOf=${() => p.load} tick=${tick} />
  </group>`;
};

// Everything that has a model or primitive variant; run view only
const Movables = ({ kit, tick }) =>
  getView() === "run"
    ? html`<group>
        <${Pallets} pallet=${kit.pallet} tick=${tick} />
        <${Vehicles} kit=${kit} tick=${tick} />
      </group>`
    : null;
const ModelMovables = ({ tick, onLoaded }) => {
  const kit = use(loadKit());
  useEffect(() => onLoaded(), []);
  return html`<${Movables} kit=${kit} tick=${tick} />`;
};

// Doors, ramps and stalls: S1 identities as primitives
const DOOR_MARKERS = STATE.doors.map((e) => {
  const l = LAYOUT.get(e.id);
  return { x: l.x, y: 4, z: l.z - Math.sign(l.z) * 6.4, id: e.id, e };
});
const APRONS = STATE.doors.map((e) => {
  const l = LAYOUT.get(e.id);
  return { x: l.x, y: 0.6, z: l.z + Math.sign(l.z), id: e.id, e };
});
const RAMPS = STATE.ramps.map((e) => ({
  ...atBottom(LAYOUT.get(e.id)),
  id: e.id,
  e,
}));
const STALLS = STATE.stalls.map((e) => ({
  ...atBottom(LAYOUT.get(e.id)),
  id: e.id,
  e,
}));
const DOOR_PARTS = {
  marker: boxPart([9, 10, 1.5]),
  apron: boxPart([13, 0.6, 16]),
  ramp: boxPart([1.5, 14, 12]),
  stall: boxPart(LAYOUT.get("P-001").size),
};

const Fixed = ({ tick }) => {
  const p = palette();
  const color = (it) => statusColor(it.e, p);
  const ids = (list) => list.map((it) => it.id);
  return html`<group>
    <${Instanced} parts=${DOOR_PARTS.marker} items=${DOOR_MARKERS} colorOf=${color} tick=${tick} ids=${ids(DOOR_MARKERS)} />
    <${Instanced} parts=${DOOR_PARTS.apron} items=${APRONS} colorOf=${color} tick=${tick} ids=${ids(APRONS)} />
    <${Instanced} parts=${DOOR_PARTS.ramp} items=${RAMPS} colorOf=${color} tick=${tick} ids=${ids(RAMPS)} />
    <${Instanced} parts=${DOOR_PARTS.stall} items=${STALLS} colorOf=${color} tick=${tick} ids=${ids(STALLS)} />
  </group>`;
};

// Selection highlight sized from LAYOUT; not pickable
const Highlight = () => {
  useBus(["select", "view"]);
  const id = getSelected();
  const l = id && LAYOUT.get(id);
  if (!l || (getView() === "observed" && RUN_ONLY.has(ENTITIES.get(id).kind)))
    return null;
  const scale = l.size.map((s) => s * 1.12 + 2);
  return html`<group position=${[l.x, l.y, l.z]} rotation=${[0, l.rotY, 0]} scale=${scale}>
    <mesh><boxGeometry /><meshBasicMaterial color=${STATUS.selected} transparent opacity=${0.28} depthWrite=${false} /></mesh>
    <lineSegments><edgesGeometry args=${[new THREE.BoxGeometry(1, 1, 1)]} /><lineBasicMaterial color=${STATUS.selected} /></lineSegments>
  </group>`;
};

// Camera: orbit, zoom, pan, reset and focus on the selection
const CameraRig = () => {
  const camera = useThree((s) => s.camera);
  const controls = useOrbit(ORBIT);
  const aim = (pos, target) => {
    camera.position.set(...pos);
    controls.target.set(...target);
    controls.update();
  };
  useDomButton("reset", () => aim(HOME.pos, HOME.target));
  useDomButton("focus", () => {
    const l = LAYOUT.get(getSelected());
    if (l)
      aim(
        [l.x - 160, 150, l.z + Math.sign(l.z || 1) * 190],
        [l.x + 10, 0, l.z],
      );
  });
  useEffect(() => aim(HOME.pos, HOME.target), [controls]);
  return null;
};

const setButton = (id, text) => {
  document.getElementById(id).textContent = text;
};
const credit = document.getElementById("model-credit");

const App = () => {
  const tick = useBus(["theme", "view"]);
  const [roof, setRoof] = useState(true);
  const [models, setModels] = useState(true);
  const [load, setLoad] = useState("loading");
  useDomButton("roof", () => setRoof((r) => !r));
  useDomButton("mesh", () => setModels((m) => !m));
  const meshState = models ? load : "off";
  const run = getView() === "run";
  useEffect(() => setButton("roof", `Roof: ${roof ? "on" : "off"}`), [roof]);
  useEffect(() => setButton("mesh", MESH_LABEL[meshState]), [meshState]);
  useEffect(() => {
    credit.hidden = !(run && meshState === "loaded");
  }, [run, meshState]);
  // Instances can unmount under the pointer without a pointer-out event
  useEffect(() => hideTip(), [tick, meshState]);
  const onFail = (err) => {
    console.error("Free models failed; showing primitives", err);
    setLoad("failed");
  };
  const primitives = html`<${Movables} kit=${PRIMITIVES} tick=${tick} />`;
  const p = palette();
  return html`
    <color attach="background" args=${[p.bg]} />
    <hemisphereLight args=${[0xffffff, 0x666670, 1.6]} />
    <directionalLight position=${[-600, 1200, 500]} intensity=${1.4} />
    <${Site} roof=${roof} />
    <${StagingLanes} />
    <${Fixed} tick=${tick} />
    ${
      meshState === "loading" || meshState === "loaded"
        ? html`<${Boundary} fallback=${primitives} onFail=${onFail}><${Suspense} fallback=${primitives}><${ModelMovables} tick=${tick} onLoaded=${() => setLoad("loaded")} /></${Suspense}></${Boundary}>`
        : primitives
    }
    <${Highlight} />
    <${CameraRig} />`;
};

// Mount. #scene-fallback holds the "not loaded" text until the canvas exists,
// and ui.js sceneFailed() brings it back with the reason if the scene dies.
const host = document.getElementById("scene");
const fallback = document.getElementById("scene-fallback");
host.addEventListener("pointerleave", hideTip);
trackPress(host);
const canvasProps = {
  camera: { fov: 38, near: 5, far: 20000, position: HOME.pos },
  dpr: [1, 2],
  onPointerMissed: hideTip,
  onCreated: ({ gl }) => {
    gl.domElement.setAttribute("role", "img");
    gl.domElement.setAttribute(
      "aria-label",
      "Schematic 3D view of the facility. The Entities tab lists the same doors, stalls, trailers and equipment as text.",
    );
    fallback.hidden = true;
  },
};
const onSceneFail = (err) => {
  console.error("3D scene failed", err);
  sceneFailed(`the 3D scene stopped (${err?.message ?? err})`);
};
const root = document.createElement("div");
root.className = "absolute inset-0";
host.appendChild(root);
createRoot(root).render(
  html`<${Boundary} fallback=${null} onFail=${onSceneFail}><${Canvas} ...${canvasProps}><${App} /></${Canvas}></${Boundary}>`,
);
