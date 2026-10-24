// Turns a loaded glTF scene into flat instancing parts: world transforms baked
// into cloned geometry, long axis on z, front at +z, bottom at y = 0, fitted to
// an appearance-only proxy size. Geometry never sets capacity or timing.
import * as THREE from "three";

const bakedParts = (root) => {
  root.updateMatrixWorld(true);
  const parts = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    parts.push({
      name: o.material?.name ?? "",
      geometry: o.geometry.clone().applyMatrix4(o.matrixWorld),
      material: o.material,
    });
  });
  if (!parts.length) throw new Error("model has no meshes");
  return parts;
};

// Every material name an option refers to must exist, so a renamed or missing
// part fails loudly (the caller falls back to primitives) instead of rendering
// the wrong facing or losing the status tint.
const requireNames = (parts, opts) => {
  const names = new Set(parts.map((p) => p.name));
  const tint = opts.tint === "all" ? [] : (opts.tint ?? []);
  const wanted = [
    opts.front,
    opts.drop,
    ...Object.keys(opts.recolor ?? {}),
    ...tint,
  ];
  const missing = wanted.filter((n) => n !== undefined && !names.has(n));
  if (missing.length)
    throw new Error(
      `model has no material named ${missing.join(", ")} (has ${[...names].join(", ")})`,
    );
};

const boundsOf = (parts) =>
  parts.reduce((box, p) => {
    p.geometry.computeBoundingBox();
    return box.union(p.geometry.boundingBox);
  }, new THREE.Box3());

const transformAll = (parts, matrix) => {
  for (const p of parts) p.geometry.applyMatrix4(matrix);
};

/**
 * Throws when a named material is missing. Call once per loaded scene: every
 * call clones the geometry.
 * @param {THREE.Object3D} root loaded glTF scene (not mutated)
 * @param {{size: number[], uniform?: boolean, drop?: string, front?: string,
 *          recolor?: Record<string, number>, tint?: string[]}} opts
 *   size: [width, height, length] in ft; uniform keeps proportions (fit by length);
 *   drop: material name to remove; front: material name whose centroid marks the front;
 *   recolor: material name -> flat color; tint: material names (or "all") that take status color.
 */
export const fitModel = (root, opts) => {
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
  const s = opts.uniform
    ? new THREE.Vector3().setScalar(l / ext.z)
    : new THREE.Vector3(w / ext.x, h / ext.y, l / ext.z);
  transformAll(parts, new THREE.Matrix4().makeScale(s.x, s.y, s.z));

  return parts.map((p) => ({
    geometry: p.geometry,
    material:
      p.name in (opts.recolor ?? {})
        ? new THREE.MeshLambertMaterial({ color: opts.recolor[p.name] })
        : p.material,
    tint: opts.tint === "all" || (opts.tint ?? []).includes(p.name),
  }));
};
