// Shared React Three Fiber setup for the mockup pages (no bundler: import map + htm).

import { useFrame, useThree } from "@react-three/fiber";
import htm from "htm";
import React, { Component, useEffect, useMemo } from "react";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export const html = htm.bind(React.createElement);

// Renders `fallback` instead of children once a child throws, and reports it.
export class Boundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    this.props.onFail?.(error);
  }
  render() {
    return this.state.error ? this.props.fallback : this.props.children;
  }
}

// Orbit controls on the current camera; damping needs an update every frame.
export const useOrbit = (options) => {
  const camera = useThree((s) => s.camera);
  const dom = useThree((s) => s.gl.domElement);
  const controls = useMemo(() => {
    const c = new OrbitControls(camera, dom);
    Object.assign(c, options);
    return c;
  }, [camera, dom]);
  useEffect(() => () => controls.dispose(), [controls]);
  useFrame(() => controls.update());
  return controls;
};

const LICENSE_URL = {
  "CC0 1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
  "CC BY 3.0": "https://creativecommons.org/licenses/by/3.0/",
};

// Every bundled third-party model. Licenses verified on the listing 2026-10-11;
// see assets/ATTRIBUTION.md and assets/licenses/. Geometry is appearance-only
// and never sets capacity, speed or service duration.
const asset = (a) => ({ ...a, licenseUrl: LICENSE_URL[a.license] });
export const ASSETS = {
  semi: asset({
    url: "./assets/polypizza/semi-williwam.glb",
    title: "Basic Semi-truck with spikes",
    author: "WilliWam",
    license: "CC0 1.0",
    source: "https://poly.pizza/m/kGA4N3G7Jv",
    use: "Tractors. Spike mesh dropped, base recolored, rescaled.",
  }),
  container: asset({
    url: "./assets/polypizza/container-quaternius.glb",
    title: "Shipping Container",
    author: "Quaternius",
    license: "CC0 1.0",
    source: "https://poly.pizza/m/dQXRtm5GbO",
    use: "Trailer body. Stretched to 53 ft, red panels recolored.",
  }),
  forklift: asset({
    url: "./assets/polypizza/forklift-kolos.glb",
    title: "Forklift",
    author: "KolosStudios",
    license: "CC BY 3.0",
    source: "https://poly.pizza/m/DTQBuenKJY",
    use: "Forklifts. Modified: re-oriented, rescaled, tinted at runtime.",
  }),
  palletTruck: asset({
    url: "./assets/polypizza/pallettruck-kolos.glb",
    title: "Pallet Truck",
    author: "KolosStudios",
    license: "CC BY 3.0",
    source: "https://poly.pizza/m/snDq7v3GRO",
    use: "Gallery only. Shown unmodified.",
  }),
  pallet: asset({
    url: "./assets/polypizza/pallet-quaternius.glb",
    title: "Pallet",
    author: "Quaternius",
    license: "CC0 1.0",
    source: "https://poly.pizza/m/cUAsYHDqfD",
    use: "Decorative pallets in staging lanes, not cargo records.",
  }),
};
