# Hackathon Final Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the existing engine, agents and dashboard into one server-owned run where Nemotron agents on Nebius Token Factory negotiate the D-108 closure, the engine referees every action, the UI shows the result, and a recorded run replays for judges.

**Architecture:** A run registry in the Next.js server owns one `SimulationEngine` and the agent states per `runId`. An orchestrator wakes the affected agents and asks a `Deliberator` (Nemotron, the FCFS baseline, or a recorded replay) for one tool call per turn. It checks role authorization, adapts the call to engine types, executes it, and appends `RunEvent` and `ModelCall` records. The browser only creates, steps and disrupts runs through `/api/runs/**`, and renders a `RunSnapshot`.

**Tech Stack:** Next.js 16.4.3 App Router, React 19, TypeScript strict, Zod, Vitest, React Three Fiber 9.8.1, Nebius Token Factory (OpenAI-compatible), Node 24.

**Spec:** `docs/superpowers/specs/2026-10-27-hackathon-final-design.md` (read it first). The gap numbers below refer to `docs/architecture.md`.

## Global Constraints

- Deadline: Fri Oct 30, 10:00 PT. Internal freeze Thu Oct 29, 22:00 ET. Submit by Fri 09:00 PT.
- The engine stays pure TypeScript in `lib/engine` with no React imports. All server code in `lib/run` and `lib/agents` stays server-only (no `"use client"`).
- The model key lives on the server only. Never prefix it with `NEXT_PUBLIC_`. The browser never calls Token Factory.
- Every `ModelCall` records `model`, `tier`, `isFallback`, `latencyMs` and token usage. A fallback is never displayed as Nemotron.
- Per-run budget cap: **60 model calls, 150 000 tokens**. When either is reached, remaining turns use the FCFS baseline and are labeled `provenance: "baseline"`.
- Model tiers (overridable by env `NEBIUS_MODEL_NANO|SUPER|ULTRA`):
  - nano: `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` (driver)
  - super: `nvidia/nemotron-3-super-120b-a12b` (dock_lead, yard_controller)
  - ultra: `nvidia/Nemotron-3-Ultra-550b-a55b` (supervisor)
- Scenario numbers are labeled `scenario`, operator injections `hypothetical`, and Tavily items `external_search` with source URLs. Never invent operational numbers; unknown stays unknown (CLAUDE.md).
- Run `pnpm check` (Biome + typecheck + Vitest) before every commit. Use conventional commit titles.
- File ownership: Person A owns `lib/engine/**`, `lib/run/**`, `app/api/runs/**` and `scripts/record-run.ts`. Person B owns `lib/agents/**`, `lib/external/**`, `lib/dashboard/**`, `lib/scene/from-engine.ts`, `components/**`, `app/page.tsx`, deployment, and the submission docs. `types/run.ts` is shared: change it only after telling the other person.

## Review Focus

1. **Nemotron replies with text only, malformed JSON, or an unknown tool.** Expected: the turn is recorded as a fallback with `fallbackReason: "malformed_tool_call"`, no engine mutation is attributed to Nemotron, and the run continues. *Test lives in B2.*
2. **The budget cap is hit in the middle of a negotiation.** Expected: the remaining turns use the baseline, `budget.exhausted` is true, and an `escalation` RunEvent says why. *Test lives in A6.*
3. **Two agents claim D-112 for overlapping windows.** Expected: the second commit is rejected with `RESOURCE_UNAVAILABLE`, the rejection is a visible RunEvent, and there is no double booking. *Test lives in A6.*
4. **Double-click on Step: two step requests arrive for the same run at once.** Expected: the second gets HTTP 409 `RUN_BUSY` and the state is stepped once. *Test lives in A7.*
5. **Unknown or expired `runId`, for example after a server restart wiped the in-memory registry.** Expected: HTTP 404 `RUN_NOT_FOUND`, and the UI offers "Start new run" or "Watch recorded run". *Tests live in A7 (API) and B3 (hook).*

---

## Schedule and checkpoints

| When (ET) | Person A | Person B | Checkpoint |
|---|---|---|---|
| Tue morning | Task 0 (together) → A1, A2 | Task 0 (together) → B1 | Contract merged |
| Tue afternoon | A3, A4 | B2, B3 | **Tue 18:00:** B's hook creates and steps a run against A's API using `ScriptedDeliberator` |
| Wed | A5, A6, A7 | B4, B5, B6 | **Wed 20:00:** the D-108 loop runs live on Nemotron (if a key exists) and shows in the scene |
| Thu | A8, A9, A10 | B7, B8 | **Thu 20:00:** real Nebius run recorded. **22:00 freeze** |
| Fri ≤ 09:00 PT | Help B | B9 submission | Submitted |

Key blocker: there is no `NEBIUS_API_KEY` yet. Person B chases it Tuesday morning (approval, event-code credits, Builders Program credits). Until it arrives, everything runs on `ScriptedDeliberator` or the labeled fallback.

---

## Task 0 (both, Tue first hour): shared run contract

**Files:**
- Create: `types/run.ts`
- Create: `lib/run/api-schemas.ts`
- Test: `lib/run/api-schemas.test.ts`

**Interfaces:**
- Produces, in `types/run.ts` (all later tasks import from here):
  - `type ModelTier = "nano" | "super" | "ultra"`
  - `type Provenance = "engine" | "nemotron" | "fallback" | "baseline" | "operator" | "external_search" | "replay"`
  - `interface ModelCall { id: string; agentId: string; role: AgentRole; tier: ModelTier; model: string; isFallback: boolean; fallbackReason?: "no_api_key" | "http_error" | "timeout" | "malformed_tool_call" | "budget_exhausted"; latencyMs: number; promptTokens: number | null; completionTokens: number | null; logicalTime: number; stateVersion: number; toolName?: AgentToolCall["tool"]; outcome: "accepted" | "rejected" | "no_tool"; reasonCode?: string }`
  - `interface RunEvent { seq: number; logicalTime: number; stateVersion: number; kind: "engine" | "message" | "model_call" | "disruption" | "escalation"; type: string; actorId?: string; affectedIds: string[]; summary: string; causationId?: string; provenance: Provenance; sources?: { title: string; url: string }[] }`
  - `interface RunBudget { calls: number; tokens: number; capCalls: 60; capTokens: 150000; exhausted: boolean }`
  - `interface RunSnapshot { runId: string; mode: "live" | "baseline" | "replay"; scenarioId: "d108"; status: "idle" | "deliberating" | "done" | "error"; logicalTime: number; stateVersion: number; engine: EngineSnapshot; agents: AgentState[]; events: RunEvent[]; modelCalls: ModelCall[]; budget: RunBudget }`
  - `interface StepResult { snapshot: RunSnapshot; newEvents: RunEvent[] }`
  - `interface TurnInput { agent: AgentState; tier: ModelTier; observation: Record<string, unknown>; inbox: AgentMessage[]; stateVersion: number; logicalTime: number }`
  - `interface TurnDecision { thought: string; toolCall?: AgentToolCall; call: Omit<ModelCall, "id" | "outcome" | "reasonCode" | "toolName"> }`
  - `interface Deliberator { readonly kind: "nemotron" | "baseline" | "scripted" | "replay"; decide(input: TurnInput): Promise<TurnDecision> }`
- Produces, in `lib/run/api-schemas.ts` (Zod):
  - `CreateRunBody = { scenarioId: "d108"; mode: "live" | "baseline" }`
  - `StepBody = { maxTurns: int 1–8, default 4 }`
  - `DisruptionBody = { type: "dock_closure" | "equipment_failure" | "external_delay"; targetId: string; sources?: { title, url }[] }`

- [ ] **Step 1: Write failing tests**

```ts
it("rejects maxTurns above 8", () => expect(StepBody.safeParse({ maxTurns: 9 }).success).toBe(false));
it("defaults maxTurns to 4", () => expect(StepBody.parse({}).maxTurns).toBe(4));
it("rejects unknown disruption types", () => expect(DisruptionBody.safeParse({ type: "fire", targetId: "D-108" }).success).toBe(false));
it("requires source URLs to be URLs", () =>
  expect(DisruptionBody.safeParse({ type: "external_delay", targetId: "T-2291", sources: [{ title: "x", url: "nope" }] }).success).toBe(false));
```

- [ ] **Step 2: Run `pnpm vitest run lib/run/api-schemas.test.ts`.** Expected: FAIL (module missing).
- [ ] **Step 3: Write `types/run.ts` and `lib/run/api-schemas.ts`** exactly as in the Interfaces block. Type-only imports from `lib/engine/types` and `lib/agents/types`.
- [ ] **Step 4: Run `pnpm check`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: add shared run contract`

---

# Person A: Run & Engine

### Task A1 (Tue): D-108 scenario seed

**Files:** Create `lib/run/scenarios/d108.ts`. Test `lib/run/scenarios/d108.test.ts`.

**Interfaces:**
- Produces: `seedD108(engine: SimulationEngine): void` and `D108 = { closedDock: "D-108", targetDock: "D-112", trailer: "T-2291", shipment: "SH-5512", contender: "T-3061" } as const`

- [ ] **Step 1: Write failing tests:**
  - `seeds T-2291 at D-108 with SH-5512 22 pallets, 9 transferred`
  - `leaves D-112 free`
  - `YT-2 is an idle yard tractor and F-07 a working forklift`
  - `contender T-3061 waits in stall P-061`
  - `all seeded values are scenario values (no DFW claim)`: `seedD108` sets `payload.provenance === "scenario"` on its setup event
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement `seedD108`** with the existing `addTrailer`, `addTractor`, `addEquipment`, `addWorker` and `addShipment`. Represent "9 done" as `transferredQuantity: 9`. Emit one `scenario_seeded` event.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: seed the D-108 scenario`

### Task A2 (Tue): clock stepping and an atomic engine snapshot (gaps 6, 7)

**Files:** Modify `lib/engine/engine.ts` (`step`, `createCheckpoint`, `restoreCheckpoint`). Test `lib/engine/engine.test.ts`.

**Interfaces:**
- Produces: `engine.advanceUntil(t: number): EngineEvent[]` (consumes queued events up to `t` in order, sets `logicalTime = t`). `createCheckpoint()` now includes `eventQueue`, `processedRequests` and `sequenceCounter`, and `restoreCheckpoint` restores them. `EngineSnapshot` gains `queue: EngineEvent[]; processed: [string, ToolResult][]; sequence: number`.

- [ ] **Step 1: Failing tests:**
  - `advanceUntil consumes queued events in time order and never moves time backwards`
  - `advanceUntil with an empty queue still sets logicalTime`
  - `restore(checkpoint) then the same commit requestId returns the stored result` (C04 across restore)
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement**, keeping `step()` behavior.
- [ ] **Step 4: Run `pnpm check`.** Expected: PASS.
- [ ] **Step 5: Commit** `fix: advance the engine clock and capture full checkpoints`

### Task A3 (Tue): proposal adapter (gap 2)

**Files:** Create `lib/run/proposal-adapter.ts`. Test `lib/run/proposal-adapter.test.ts`.

**Interfaces:**
- Consumes: `ProposeToolSchema` input type (`z.infer`) from `lib/agents/schemas.ts`, and `CommitmentProposal` from `lib/engine/commitments.ts`.
- Produces: `toCommitmentProposal(input: ProposeInput, ctx: { logicalTime: number; nextId: () => string }): { ok: true; proposal: CommitmentProposal } | { ok: false; reasonCode: "OFFER_EXPIRED" | "INVARIANT_VIOLATION"; message: string }`

- [ ] **Step 1: Failing tests:**
  - `assigns a stable id from nextId`: `nextId` returns `"C-1"` → `proposal.id === "C-1"`
  - `converts expiresAt to expiresInSeconds`: `logicalTime 50400, expiresAt 50700` → `300`
  - `rejects expiresAt at or before now with OFFER_EXPIRED`
  - `rejects a reservation with endWindow <= startWindow with INVARIANT_VIOLATION`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Make it a pure function with no casts.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `fix: adapt model proposals to engine commitments`

### Task A4 (Tue): role authorization (gap 3)

**Files:** Create `lib/run/authorize.ts`. Modify `lib/engine/types.ts` (add `"PERMISSION_DENIED"` to `ReasonCode`). Test `lib/run/authorize.test.ts`.

**Interfaces:**
- Produces: `authorize(agent: AgentState, call: AgentToolCall, state: EngineSnapshot): { ok: true } | { ok: false; reasonCode: "PERMISSION_DENIED"; message: string }`
- Permission matrix (the spec's role table, PRD §8.1):

| Tool | driver | dock_lead | yard_controller | supervisor |
|---|---|---|---|---|
| propose | own trailer only | docks only | stalls, yard tractors | any |
| accept | as itself only | as itself only | as itself only | as itself only |
| commit | ✗ | if participant | if participant | any |
| executeMove | ✗ | ✗ | with a committed yard tractor | ✗ |
| executeUnload | ✗ | at its docks | ✗ | ✗ |
| cancel | own commitments | own commitments | own commitments | any |
| escalate, observe | ✓ | ✓ | ✓ | ✓ |
| injectDisruption | ✗ | ✗ | ✗ | ✗ (operator API only) |

- [ ] **Step 1: Failing tests:** one test per ✗ cell above, plus `driver may accept for itself but not for DOCK-C`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** a lookup table plus ownership checks against `state`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: enforce role permissions on agent tool calls`

### Task A5 (Wed): real cancel, escalate and observe (gap 3)

**Files:** Modify `lib/engine/engine.ts` and `lib/engine/commitments.ts`. Test `lib/engine/engine.test.ts`.

**Interfaces:**
- Produces: `engine.cancel(commitmentId: string, requestId: string, reason: string): ToolResult` (before execution: releases every reservation, status `cancelled`; during execution: status `cancelled` with partial work kept). The `observe` role union now includes `"supervisor"`.

- [ ] **Step 1: Failing tests:**
  - `cancel before execution frees D-112 and the yard tractor`
  - `cancel with a repeated requestId returns the first result`
  - `cancel during unload keeps transferredQuantity`
  - `supervisor observe lists open commitments and the last 10 events`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Escalation is not an engine mutation; A6 records it as a `RunEvent` and delivers a message to `SUP-1`.
- [ ] **Step 4: Run `pnpm check`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: release reservations on cancel and add supervisor observation`

### Task A6 (Wed): Run and orchestrator

**Files:** Create `lib/run/run.ts` (the `Run` class; split out a `lib/run/turns.ts` helper if it passes 200 lines) and `lib/run/scripted-deliberator.ts` (a test double that B also uses). Test `lib/run/run.test.ts`.

**Interfaces:**
- Consumes: A1–A5, `types/run.ts`, `AgentRunner` agent registry (`getAllAgents`, `getAgent`, `sendMessage`) from `lib/agents/agent-runner.ts`.
- Produces:
  - `class Run { constructor(opts: { runId: string; mode: "live" | "baseline" | "replay"; deliberator: Deliberator; fallbackDeliberator: Deliberator; tierFor: (role: AgentRole) => ModelTier }); snapshot(): RunSnapshot; step(maxTurns: number): Promise<StepResult>; injectDisruption(body: DisruptionBody): StepResult; get busy(): boolean }` (`fallbackDeliberator` takes over when the budget is exhausted: the `BaselineDeliberator` from A8 in production, a `ScriptedDeliberator` in tests until A8 lands)
  - `class ScriptedDeliberator implements Deliberator` (constructor takes `TurnDecision[]` per agentId and replays them in order)
- Wake rule: a disruption wakes the dock lead of the affected dock and the driver of the affected trailer. A delivered message wakes its recipient. An `escalate` wakes `SUP-1`. Each turn runs: `observe` → `deliberator.decide` → `authorize` → (`propose` goes through the adapter) → engine tool → append a `ModelCall` with `outcome`, and `RunEvent`s with provenance from `deliberator.kind`. Before each turn, if `budget.calls >= 60 || budget.tokens >= 150000`, the run sets `exhausted`, appends one `escalation` event ("budget reached, baseline takes over") and uses `fallbackDeliberator` for the rest.

- [ ] **Step 1: Failing tests** (with `ScriptedDeliberator`):
  - `D-108 loop: closure → offer D-112 → driver accepts → yard commits YT-2 → move executes → unload resumes from 9`: final T-2291 location is `{ kind: "dock", dockId: "D-112" }`, `SH-5512.transferredQuantity` ≥ 9, and the events include `commitment_committed`
  - `contender T-3061 committing D-112 for an overlapping window is rejected with RESOURCE_UNAVAILABLE and recorded` (Review Focus 3)
  - `unauthorized call is recorded as rejected PERMISSION_DENIED and does not mutate state`
  - `budget cap switches to baseline and records one escalation` (Review Focus 2: seed `budget.calls = 59`, step 2 turns)
  - `model calls carry tier from tierFor(role)`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Keep the turn function pure apart from engine calls.
- [ ] **Step 4: Run `pnpm check`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: orchestrate agent turns in a server-owned run`

### Task A7 (Wed): registry and `/api/runs` routes

**Files:** Create `lib/run/registry.ts`, `app/api/runs/route.ts` (POST), `app/api/runs/[runId]/route.ts` (GET), `app/api/runs/[runId]/step/route.ts` (POST) and `app/api/runs/[runId]/disruptions/route.ts` (POST). Test `lib/run/registry.test.ts`. Read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` first (Next 16 dynamic params are async).

**Interfaces:**
- Consumes: `Run`, `api-schemas`, and `createNemotronDeliberator()` from B2 for `mode: "live"` (use `ScriptedDeliberator` until B2 merges), plus `BaselineDeliberator` from A8 for `mode: "baseline"`.
- Produces: `createRun(body: CreateRunBody): Run`, `getRun(runId: string): Run | undefined`. Responses are a `RunSnapshot` or `StepResult` as JSON. Errors are `{ error: "RUN_NOT_FOUND" }` 404, `{ error: "RUN_BUSY" }` 409, and `{ error: "INVALID_BODY", details }` 400.

- [ ] **Step 1: Failing tests:**
  - `getRun of an unknown id is undefined` (the route maps it to 404, Review Focus 5)
  - `concurrent step on a busy run is refused` (Review Focus 4: start `step` without awaiting, call again, expect a `RUN_BUSY` rejection)
  - `registry keeps at most 20 runs, evicting the oldest`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the registry and four thin route handlers (validate → registry → JSON). Use `export const runtime = "nodejs"`.
- [ ] **Step 4: Run `pnpm check`, then `curl -X POST localhost:3000/api/runs -d '{"scenarioId":"d108","mode":"live"}'`.** Expected: a JSON `RunSnapshot` with `status: "idle"`.
- [ ] **Step 5: Commit** `feat: expose server-owned runs over /api/runs`

### Task A8 (Thu, P1): FCFS baseline and metrics

**Files:** Create `lib/run/baseline-deliberator.ts` and `lib/run/metrics.ts`. Test `lib/run/metrics.test.ts`.

**Interfaces:**
- Produces: `class BaselineDeliberator implements Deliberator` (`kind: "baseline"`: offers the first free compatible dock by ID order, accepts the earliest feasible window, never calls a model). Also `computeMetrics(snapshot: RunSnapshot): RunMetrics`, where `RunMetrics = { driverWaitingSec: number; departureLatenessSec: number | "unknown"; doorHoursLost: number; invalidProposals: number; modelCalls: number; tokens: number | "unknown" }` (definitions per PRD §15; lateness is `"unknown"` when no departure target exists).

- [ ] **Step 1: Failing tests:**
  - `baseline completes the D-108 relocation with zero model calls`
  - `metrics on identical inputs are deterministic`
  - `lateness is "unknown" without a target`
  - `invalidProposals counts rejected outcomes only`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `pnpm check`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: add FCFS baseline and run metrics`

### Task A9 (Thu): export and replay

**Files:** Create `lib/run/recording.ts` (`exportRun`, `ReplayDeliberator`) and `scripts/record-run.ts`. Test `lib/run/recording.test.ts`.

**Interfaces:**
- Produces: `exportRun(run: Run): RecordedRun`, where `RecordedRun = { version: 1; scenarioId: "d108"; recordedAt: string; decisions: { agentId: string; decision: TurnDecision }[]; disruptions: DisruptionBody[]; finalStateVersion: number }`. `class ReplayDeliberator implements Deliberator` (`kind: "replay"`: returns the recorded decisions in order and never calls a model). The script writes `public/runs/d108-nebius.json` from a live run on the dev server (POST create → disrupt D-108 → step until `done` → GET export).
- Add route `GET /api/runs/[runId]/export` → `RecordedRun`.

- [ ] **Step 1: Failing tests:**
  - `replaying a recorded run reproduces the final engine snapshot exactly` (deep-equal `engine.state`)
  - `replay makes zero network calls` (stub `fetch` to throw)
  - `recorded model calls keep the original model id and isFallback flags`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `pnpm check`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: export runs and replay them without model calls`

### Task A10 (Thu, before freeze): remove the parallel engines

**Files:** Delete `app/api/agents/deliberate/route.ts` and the browser engine and runner in `lib/dashboard/use-simulation.ts` (only after B3 and B5 merge). Update `docs/architecture.md`.

- [ ] **Step 1:** `grep -rn "new SimulationEngine\|new AgentRunner" app components lib/dashboard` → expect only `lib/run/**`.
- [ ] **Step 2:** Delete the legacy files and update the architecture doc's runtime diagram.
- [ ] **Step 3: Run `pnpm check` and `pnpm build`.** Expected: PASS.
- [ ] **Step 4: Commit** `refactor: make the server-owned run the only engine`

---

# Person B: Models & Product

### Task B1 (Tue, first): Token Factory smoke test and model tiers

**Files:** Create `scripts/smoke-token-factory.ts` and `lib/agents/models.ts`. Test `lib/agents/models.test.ts`.

**Interfaces:**
- Produces: `MODEL_BY_TIER: Record<ModelTier, string>` (Global Constraints values; env overrides). `tierForRole(role: AgentRole): ModelTier` (driver → nano; dock_lead, yard_controller → super; supervisor → ultra). `modelFor(tier: ModelTier): string`.

- [ ] **Step 1: Failing tests:**
  - `tierForRole maps driver to nano and supervisor to ultra`
  - `NEBIUS_MODEL_ULTRA overrides the ultra id`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement `models.ts`.** Write the script, run as `node scripts/smoke-token-factory.ts` (Node 24 strips types; relative imports only). It runs `GET {base}/models`, then for each tier sends one chat completion with a single `make_offer` tool and `tool_choice: "auto"`. It prints `model | listed? | tool_call? | latencyMs | usage`.
- [ ] **Step 4: Run tests: PASS.** Once a key exists, run the script and paste its output into `docs/hackathon.md` under "Feedback record". If a tier fails the tool call, set its env override to the super model and note it.
- [ ] **Step 5: Commit** `feat: add Nemotron model tiers and a Token Factory smoke test`

### Task B2 (Tue): Nemotron deliberator

**Files:** Modify `lib/agents/nebius-client.ts` to take `model` as a parameter, parse `usage.prompt_tokens`/`completion_tokens`, and return `fallbackReason`. Create `lib/agents/nemotron-deliberator.ts`. Test `lib/agents/nemotron-deliberator.test.ts`.

**Interfaces:**
- Consumes: `Deliberator`, `TurnInput`, `TurnDecision` (Task 0), `modelFor` (B1), `AgentToolCallSchema` and the prompts.
- Produces: `createNemotronDeliberator(): Deliberator` (`kind: "nemotron"`). Every decision's `call` is filled in; `isFallback` is true whenever the reply did not come from Nemotron.

- [ ] **Step 1: Failing tests** (mock `fetch`):
  - `captures usage tokens and the requested model id`
  - `text-only reply → isFallback true, fallbackReason "malformed_tool_call", no toolCall` (Review Focus 1)
  - `invalid tool arguments failing AgentToolCallSchema → same as above`
  - `HTTP 429 → fallbackReason "http_error"`; `timeout after 20 s → "timeout"`
  - `missing NEBIUS_API_KEY → fallbackReason "no_api_key"`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Keep `fallbackLocalDeliberation` as the fallback body. Never put the key in thrown messages.
- [ ] **Step 4: Run `pnpm check`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: decide agent turns with tiered Nemotron and honest fallback`

### Task B3 (Tue): client run hook and projection

**Files:** Create `lib/dashboard/project-run.ts` and `lib/dashboard/use-run.ts`. Test `lib/dashboard/project-run.test.ts`.

**Interfaces:**
- Consumes: `RunSnapshot` and the `/api/runs` responses (A7).
- Produces: `projectRun(s: RunSnapshot): DashboardView`, where `DashboardView = { clock: string; counts: DashboardCounts; timeline: TimelineEvent[]; commitments: CommitmentEntity[]; agents: AgentState[]; lastCalls: ModelCall[]; budget: RunBudget; provenanceSummary: { nemotron: number; fallback: number; baseline: number } }`. Also `useRun(): { view: DashboardView | null; status: "none" | "loading" | "ready" | "missing" | "error"; start(mode): Promise<void>; step(): Promise<void>; disrupt(body): Promise<void>; replay(url: string): Promise<void> }`.

- [ ] **Step 1: Failing tests:**
  - `counts come from the engine snapshot, not ILLUSTRATIVE_STATE` (a closed D-108 counts as closed)
  - `timeline marks fallback calls as "fallback", never "nemotron"`
  - `rejected outcomes appear in the timeline with their reasonCode`
  - `a 404 from step sets status "missing"` (Review Focus 5; test the pure reducer `nextStatus(httpStatus)`)
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** The hook calls only `/api/runs/**` and disables Step while a request is in flight.
- [ ] **Step 4: Run `pnpm check`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: project server runs into dashboard state`

### Task B4 (Wed): scene from the engine snapshot (gap 5)

**Files:** Create `lib/scene/from-engine.ts`. Modify `components/scene/facility-scene.tsx` to accept a `state: SceneState` prop, defaulting to `ILLUSTRATIVE_STATE` only when there is no run. Test `lib/scene/from-engine.test.ts`.

**Interfaces:**
- Produces: `sceneStateFromEngine(s: EngineSnapshot): SceneState`. It keeps the 182/4/235 identities and overlays the engine's statuses onto them.

- [ ] **Step 1: Failing tests:**
  - `D-108 closed in the engine renders status "closed"`
  - `T-2291 in_transit renders as a moving trailer`
  - `door count stays 182 for any snapshot`
  - `a door the engine doesn't mention keeps status "free"`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement**, reusing `lib/scene/layout.ts` placements.
- [ ] **Step 4: Run `pnpm check`, then load `/` and check the closed door turns red after the disruption.** Expected: PASS, and visibly correct.
- [ ] **Step 5: Commit** `feat: render the scene from the run's engine snapshot`

### Task B5 (Wed): dashboard on the run, guided flow, provenance

**Files:** Modify `components/dashboard/dashboard-layout.tsx`, `top-bar.tsx`, `causal-timeline.tsx`, `inspector-panel.tsx` and `provenance-badge.tsx` to read `DashboardView` from `useRun`. Create `components/dashboard/guided-demo.tsx`.

**Interfaces:**
- Consumes: `useRun`, `projectRun` (B3), `sceneStateFromEngine` (B4).
- Produces: `<GuidedDemo />`, a single button labeled "Run the D-108 scenario" that runs start → disrupt `{ type: "dock_closure", targetId: "D-108" }` → step until `done`, with a status line per step. Every model call's badge shows `model`, tier, latency, tokens and a `FALLBACK` tag when applicable. The budget meter shows calls/60 and tokens/150k.

- [ ] **Step 1:** Remove every import of `use-simulation` from components (`grep -rn use-simulation components app` → empty).
- [ ] **Step 2:** Wire the panels and the scene to `view`. Rejected outcomes render in the timeline with their reason.
- [ ] **Step 3: Run `pnpm check`, then click through in the browser in both themes.** Expected: the D-108 flow completes. The console has no errors (the THREE.Clock warning is accepted).
- [ ] **Step 4: Commit** `feat: drive the dashboard from the server run with a guided D-108 demo`

### Task B6 (Wed, P1): merge Tavily onto the run API

**Files:** Merge `origin/feat/polish-ui` (Tavily client, provenance and UI polish). Resolve conflicts in favor of `useRun`. Modify the Tavily route so a chosen result calls `POST /api/runs/:id/disruptions` with `{ type: "external_delay", targetId, sources }`.

- [ ] **Step 1:** `git merge origin/feat/polish-ui` and resolve conflicts. Run `pnpm check` → PASS.
- [ ] **Step 2: Failing test** in `lib/external/tavily-client.test.ts`: `fixture results are labeled "illustrative", never "external_search"`, and `live results carry source URLs into DisruptionBody.sources`.
- [ ] **Step 3: Implement the fix.** Run → PASS.
- [ ] **Step 4:** In the browser, inject a Tavily-sourced hypothetical. The timeline shows `external_search` with clickable sources and a "hypothetical" label.
- [ ] **Step 5: Commit** `feat: inject Tavily-sourced hypothetical disruptions into runs`

### Task B7 (Thu, P1): comparison view

**Files:** Create `components/dashboard/compare-panel.tsx` (a collapsible panel).

**Interfaces:**
- Consumes: `computeMetrics` (A8), and two runs (live and baseline) created with the same scenario and the same disruption script.
- Produces: a table of agents vs FCFS with every `RunMetrics` field. `"unknown"` renders as the word *unknown*, and both runs' model IDs are shown. If either run hit its budget cap, the table is labeled "partly baseline".

- [ ] **Step 1:** Add a "Compare with first-come rules" button that creates the baseline run, replays the live run's disruptions, and steps to `done`.
- [ ] **Step 2: Run `pnpm check` and check in the browser.** Expected: both columns are filled and no column claims "better" without numbers.
- [ ] **Step 3: Commit** `feat: compare agent and FCFS runs on identical inputs`

### Task B8 (Thu): replay mode and deployment

**Files:** Create `components/dashboard/replay-banner.tsx`, `Dockerfile` and `docs/deploy.md`. Modify `app/page.tsx` (`?replay=d108` loads `/runs/d108-nebius.json`).

- [ ] **Step 1:** Replay mode uses `useRun().replay(url)`. A banner reads "Recorded run on Nebius Token Factory, <model ids>, <date>. Replay makes no model calls."
- [ ] **Step 2:** Deploy the live app as one long-lived container. First choice: a Nebius Serverless Endpoint (check the current Nebius docs for container deploy). Fallback: any single-instance host. Set `NEBIUS_API_KEY` and `TAVILY_API_KEY` as server env vars. Write the exact steps in `docs/deploy.md`.
- [ ] **Step 3: Verify from a fresh browser profile:** `/?replay=d108` works with no key, and the live D-108 flow works on the hosted URL. Then run `curl -s <url>/api/runs/does-not-exist` → 404 `RUN_NOT_FOUND`.
- [ ] **Step 4: Commit** `feat: replay the recorded Nebius run and document deployment`

### Task B9 (Thu night → Fri 09:00 PT): submission

**Files:** Modify `README.md` (demo URL, replay URL, setup, how Nemotron and Token Factory are used, model tiering) and `docs/hackathon.md` (fill in the feedback record, change record and release gates).

- [ ] **Step 1:** Person A runs `scripts/record-run.ts` against the live key and commits `public/runs/d108-nebius.json`.
- [ ] **Step 2:** Record the video (3 minutes or less) following the outline in `docs/hackathon.md`. Show the real model IDs and token and latency badges, one rejected proposal, the comparison, and the Tavily scout if B6 shipped. Upload it as a public YouTube video.
- [ ] **Step 3:** Fill in the Devpost form:
  - Track: **Best Apps and Agents**
  - Project description: the spec intent plus measured numbers only
  - Highlight model tiering and Token Factory
  - Feedback record, with real observations (this is eligible for the $100 feedback prizes)
  - Change record: the period started Aug 26; this project began Oct 10 (repo history)
  - Tavily usage, for the Tavily prize
- [ ] **Step 4:** Check the repo is public with the MIT license visible at the top, and the hosted URL and replay URL work logged out. Submit by **09:00 PT Friday**.

---

## Self-review notes

Every spec goal maps to a task:
- P0-1 → A6/A7
- P0-2 → A2/A3/A4/A5/A6
- P0-3 → A1/A6
- P0-4 → B1/B2
- P0-5 → B3/B4/B5
- P0-6 → A9/B8
- P0-7 → B8/B9
- P1-8 → A8/B7
- P1-9 → B6
- P1-10: deferred inside A1. The demo uses the fixed D-108 seed plus T-3061; the generator is stretch only if Wed finishes early.

Names checked across tasks: `Deliberator.decide`, `TurnDecision.call`, `RunSnapshot.budget`, `computeMetrics`, `sceneStateFromEngine`, `tierForRole`, `modelFor`.
