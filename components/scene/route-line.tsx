"use client";

import { Line } from "@react-three/drei";
import { useMemo } from "react";
import type { Point } from "@/lib/scene/ambient-motion";
import { STATUS } from "./palette";

/** Just above the asphalt so the dashes never z-fight with it. */
const LIFT = 1.5;

interface RouteLineProps {
  route: readonly Point[];
}

/** The followed truck's path, dashed on the ground. */
export const RouteLine = ({ route }: RouteLineProps) => {
  // A new points array rebuilds the line geometry, so only build one per route.
  const points = useMemo(
    () => route.map(([x, z]) => [x, LIFT, z] as const),
    [route],
  );
  return (
    <Line
      points={points}
      color={STATUS.selected}
      lineWidth={3}
      dashed
      dashSize={12}
      gapSize={8}
    />
  );
};
