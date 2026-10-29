/** src: published spec (S1) · eng: engine/scenario values of a run · drv · hyp · unk · ill. */
export type ProvenanceKind = "src" | "eng" | "drv" | "hyp" | "unk" | "ill";

export type TabKey = "agent" | "commitment" | "calls" | "evidence" | "entities";

export type EntityFilter = "doors" | "stalls" | "trailers" | "equipment";

export interface Dependency {
  door: string;
  trailer: string;
  shipment: string;
  heldBy: string | null;
  reason: string;
}

export type TimelineEventType =
  | "disruption"
  | "engine"
  | "stale"
  | "offer"
  | "accept"
  | "commit"
  | "action"
  | "scheduled";

export interface TimelineEvent {
  id: string;
  time: string;
  source: string;
  title: string;
  type: TimelineEventType;
  tag?: string;
  isLLM?: boolean;
}

export interface EvidenceRecord {
  id: string;
  title: string;
  kind: ProvenanceKind;
  scope: string;
  source: string;
  url?: string;
  dates?: string;
  table?: string;
  original?: string;
  formula?: string;
  qualifier?: string;
  crossCheck?: string;
}

export interface DashboardCounts {
  doorsOccupied: number;
  doorsServing: number;
  doorsBlocked: number;
  doorsFree: number;
  stallsOccupied: number;
  stallsFree: number;
  yardWaiting: number;
  gateQueue: number;
  outboundBlocked: number;
  trailersOnSite: number;
}
