import type { Entity } from "./types";

export const KIND_LABEL: Readonly<Record<Entity["kind"], string>> = {
  door: "dock-high door 9×10 ft (S1)",
  ramp: "ramp door 12×14 ft (S1)",
  stall: "trailer space (S1 count)",
  trailer: "53 ft trailer (proxy)",
  tractor: "tractor (appearance proxy)",
  forklift: "forklift (illustrative resource)",
};

/** Status in words, so it never depends on color alone (PRD §12). */
export const statusText = (e: Entity): string => {
  switch (e.kind) {
    case "door":
      if (e.status === "closed") return "closed 14:00–16:00 · hypothetical";
      if (e.status === "reserved") return "free now · reserved 14:20–15:05";
      if (e.status === "blocked")
        return `${e.trailer} waiting for outbound freight`;
      if (e.status === "serving") return `serving ${e.trailer}`;
      return "free";
    case "ramp":
      return "free · no workload assigned";
    case "stall":
      return e.trailer ? `occupied by ${e.trailer}` : "free";
    case "trailer":
      if (e.status === "moving") return "moving D-108 → D-112";
      if (e.status === "gate") return "outside the gate, waiting for check-in";
      if (e.status === "waiting") return `in ${e.at}, waiting for a door`;
      if (e.status === "parked") return `parked in ${e.at}`;
      if (e.status === "blocked")
        return `at ${e.at}, waiting for outbound freight`;
      return `at ${e.at}, being served`;
    case "tractor":
      if (e.status === "idle") return "yard tractor, idle";
      return `${e.role} tractor, ${e.status === "moving" ? "moving" : "coupled to"} ${e.at}`;
    case "forklift":
      return e.status === "failed" ? "failed 13:52 · hypothetical" : "working";
  }
};
