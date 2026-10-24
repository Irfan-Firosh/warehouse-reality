// Turns a loaded glTF scene into flat instancing parts: world transforms baked
// into cloned geometry, long axis on z, front at +z, bottom at y = 0, fitted to
// an appearance-only proxy size. Geometry never sets capacity or timing.
import * as THREE from "three";

export interface ModelPart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  /** Whether instances of this part take the per-entity status color. */
  tint: boolean;
}

export interface FitOptions {
  /** [width, height, length] in ft. */
  size: readonly [number, number, number];
  /** Keep proportions and fit by length. */
  uniform?: boolean;
  /** Material name of a part to remove. */
  drop?: string;
  /** Material name whose centroid marks the front of the model. */
  front?: string;
  /** Material name to flat color. */
  recolor?: Readonly<Record<string, number>>;
  /** Material names that take the status color, or "all". */
  tint?: readonly string[] | "all";
}

interface NamedPart {
  name: string;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

const firstMaterial = (m: THREE.Material | THREE.Material[]): THREE.Material =>
  Array.isArray(m) ? m[0] : m;

const bakedParts = (root: THREE.Object3D): NamedPart[] => {
  root.updateMatrixWorld(true);
  const parts: NamedPart[] = [];
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const material = firstMaterial(o.material);
    parts.push({
      name: material.name,
      geometry: o.geometry.clone().applyMatrix4(o.matrixWorld),
      material,
    });
  });
  if (!parts.length) throw new Error("model has no meshes");
  return parts;
};

// A renamed or missing part must fail loudly so the caller falls back to
// primitives, instead of rendering the wrong facing or losing the status tint.
const requireNames = (parts: readonly NamedPart[], opts: FitOptions): void => {
  const names = new Set(parts.map((p) => p.name));
  const tint = opts.tint === "all" ? [] : (opts.tint ?? []);
  const wanted = [
    opts.front,
    opts.drop,
    ...Object.keys(opts.recolor ?? {}),
    ...tint,
  ];
  const missing = wanted.filter(
    (n): n is string => n !== undefined && !names.has(n),
  );
  if (missing.length) {
    throw new Error(
      `model has no material named ${missing.join(", ")} (has ${[...names].join(", ")})`,
    );
  }
};

const boundsOf = (parts: readonly NamedPart[]): THREE.Box3 =>
  parts.reduce((box, p) => {
    p.geometry.computeBoundingBox();
    return p.geometry.boundingBox ? box.union(p.geometry.boundingBox) : box;
  }, new THREE.Box3());

const transformAll = (
  parts: readonly NamedPart[],
  matrix: THREE.Matrix4,
): void => {
  for (const p of parts) p.geometry.applyMatrix4(matrix);
};

/** Clones geometry on every call, so call once per loaded scene. Throws on unknown names. */
export const fitModel = (
  root: THREE.Object3D,
  opts: FitOptions,
): ModelPart[] => {
  const all = bakedParts(root);
  requireNames(all, opts);
  const frontAt = opts.front
    ? boundsOf(all.filter((p) => p.name === opts.front)).getCenter(
        new THREE.Vector3(),
      )
    : null;
  const parts = all.filter((p) => p.name !== opts.drop);

  const raw = boundsOf(parts).getSize(new THREE.Vector3());
  if (raw.x > raw.z) {
    const turn = new THREE.Matrix4().makeRotationY(Math.PI / 2);
    transformAll(parts, turn);
    frontAt?.applyMatrix4(turn);
  }
  const box = boundsOf(parts);
  const center = box.getCenter(new THREE.Vector3());
  if (frontAt && frontAt.z < center.z) {
    const flip = new THREE.Matrix4().makeRotationY(Math.PI);
    transformAll(parts, flip);
    box.applyMatrix4(flip);
    box.getCenter(center);
  }
  transformAll(
    parts,
    new THREE.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z),
  );

  const ext = boundsOf(parts).getSize(new THREE.Vector3());
  const [w, h, l] = opts.size;
  const scale = opts.uniform
    ? new THREE.Vector3().setScalar(l / ext.z)
    : new THREE.Vector3(w / ext.x, h / ext.y, l / ext.z);
  transformAll(parts, new THREE.Matrix4().makeScale(scale.x, scale.y, scale.z));

  const recolor = opts.recolor ?? {};
  return parts.map((p) => ({
    geometry: p.geometry,
    material:
      p.name in recolor
        ? new THREE.MeshLambertMaterial({ color: recolor[p.name] })
        : p.material,
    tint: opts.tint === "all" || (opts.tint ?? []).includes(p.name),
  }));
};

/** A primitive box part with its bottom at y = 0, tinted per instance. */
export const boxPart = ([w, h, d]: readonly [
  number,
  number,
  number,
]): ModelPart[] => [
  {
    geometry: new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0),
    material: new THREE.MeshLambertMaterial(),
    tint: true,
  },
];
