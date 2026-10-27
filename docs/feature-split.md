# Feature split: Person A and Person B

Deadline: Fri Oct 30, 10:00 PT. We submit by 09:00 PT. Every feature has exactly one owner, and no file is edited by both people.

- **Status** lives in Beads; see `docs/beads.md`. Each feature below names its bead.
- **Exact signatures and tests** for each feature are in `docs/superpowers/plans/2026-10-27-hackathon-final.md`, under the plan task listed.

**Done** means all three of:
- the feature's checks below pass;
- `pnpm check` passes;
- the commit is on `main`, and its bead is closed.

## Ownership

| | Person A: Run & Engine | Person B: Models & Product |
|---|---|---|
| Owns | `lib/engine/**`, `lib/run/**`, `app/api/runs/**`, `app/api/agents/**`, `types/run.ts`, `scripts/record-run.ts`, `public/runs/**` | `lib/agents/**`, `lib/external/**`, `lib/dashboard/**`, `lib/scene/**`, `components/**`, `app/page.tsx`, `README.md`, `docs/hackathon.md`, deployment files |
| Epic | `ws-vee` | `ws-2ab` |
| Never edits | anything in B's column | anything in A's column |

If you need a change in the other person's files, ask them. Don't edit around it.

---

## Person A: Run & Engine

### A1. Shared run contract · `ws-vee.2` · Plan Task 0

- **Builds:** `types/run.ts` holds the types both lanes code against: `RunSnapshot`, `RunEvent`, `ModelCall`, `RunBudget`, `StepResult`, `TurnInput`, `TurnDecision` and the `Deliberator` interface. `lib/run/api-schemas.ts` holds the Zod bodies for the API: create run, step with `maxTurns` 1–8 (default 4), and disruption.
- **Done when:** schema tests reject `maxTurns` 9 and unknown disruption types. B has reviewed the types (by Tue 11:00 ET).
- **Unblocks:** A7, B2, B3.

### A2. Seed the D-108 scenario · `ws-vee.3` · Plan A1

- **Builds:** `seedD108(engine)` in `lib/run/scenarios/d108.ts`. T-2291 sits at D-108 carrying SH-5512, 22 pallets with 9 already unloaded. D-112 is free, yard tractor YT-2 is idle, forklift F-07 is working, and the contender T-3061 waits in stall P-061. The setup event is labeled `scenario`.
- **Done when:** tests confirm each of those facts.
- **Unblocks:** A7.

### A3. Engine clock and full checkpoints · `ws-vee.4` · Plan A2

- **Builds:** `engine.advanceUntil(t)` consumes queued events in time order and moves logical time forward. Checkpoints now also save the event queue, the processed request IDs and the sequence counter.
- **Done when:** time never moves backwards, and a repeated `requestId` after restoring a checkpoint returns the stored result.
- **Unblocks:** A7.

### A4. Proposal adapter · `ws-vee.5` · Plan A3

- **Builds:** `toCommitmentProposal()` in `lib/run/proposal-adapter.ts`. It turns a model's `propose` call into an engine commitment with a stable ID (`C-1`, `C-2`, …) and converts `expiresAt` into `expiresInSeconds`.
- **Done when:** an expiry in the past is rejected with `OFFER_EXPIRED`, and a reservation that ends before it starts is rejected with `INVARIANT_VIOLATION`.
- **Unblocks:** A7.

### A5. Role permissions · `ws-vee.6` · Plan A4

- **Builds:** `authorize()` in `lib/run/authorize.ts`, plus a new `PERMISSION_DENIED` reason code.
  - Drivers propose only for their own trailer.
  - Dock leads propose only docks.
  - Yard controllers propose stalls and yard tractors, and execute moves.
  - Everyone accepts only as themselves.
  - No agent can inject a disruption; only the operator API can.
- **Done when:** there is one test per forbidden action in the plan's permission matrix.
- **Unblocks:** A7.

### A6. Real cancel, escalate and supervisor observe · `ws-vee.7` · Plan A5

- **Builds:**
  - `engine.cancel(id, requestId, reason)`. Before work starts, it frees every reservation. During work, it keeps the pallets already moved.
  - Supervisor observation lists open commitments and the last 10 events.
- **Done when:** cancelling frees D-112 and YT-2, a repeated cancel is idempotent, and a cancel mid-unload keeps progress.
- **Unblocks:** A7.

### A7. Run orchestrator with budget cap · `ws-vee.8` · Plan A6

- **Builds:** the `Run` class in `lib/run/run.ts`, plus a `ScriptedDeliberator` for tests.
  - **Wake rules:** a disruption wakes the dock lead and the affected driver, a message wakes its recipient, and an escalation wakes SUP-1.
  - **Each turn:** observe, decide, check permission, adapt, execute, then record a `ModelCall` and its `RunEvent`s.
  - **Budget:** at 60 calls or 150k tokens, a fallback deliberator takes over, and one escalation event says so.
- **Done when:** the full D-108 loop completes in a test. T-2291 ends at D-112 with the unload resumed from 9. A contender claiming D-112 is rejected with `RESOURCE_UNAVAILABLE`, an unauthorized call is rejected with `PERMISSION_DENIED`, and the budget switch fires.
- **Needs:** A1–A6. **Unblocks:** A8, A9.

### A8. `/api/runs` API and registry · `ws-vee.9` · Plan A7

- **Builds:** `POST /api/runs`, `GET /api/runs/[runId]`, `POST /api/runs/[runId]/step` and `POST /api/runs/[runId]/disruptions`. The in-memory registry keeps up to 20 runs.
- **Done when:**
  - An unknown run returns 404 `RUN_NOT_FOUND`.
  - A step on a busy run returns 409 `RUN_BUSY`.
  - A bad body returns 400 `INVALID_BODY`.
  - `curl` creates a run.
- **Needs:** A7. **Unblocks:** A10, B5, B6.

### A9. First-come baseline and metrics · `ws-vee.10` · Plan A8 · P1

- **Builds:** `BaselineDeliberator`, which takes the first free compatible dock and never calls a model. Also `computeMetrics(snapshot)`, which measures driver waiting, departure lateness (`"unknown"` when there is no target), door-hours lost, invalid proposals, model calls and tokens.
- **Done when:** the baseline completes D-108 with 0 model calls, and the metrics come out identical on identical inputs.
- **Needs:** A7. **Unblocks:** B7.

### A10. Export, replay and record script · `ws-vee.11` · Plan A9

- **Builds:**
  - `exportRun()`, plus `GET /api/runs/[runId]/export`.
  - `ReplayDeliberator`, which plays back recorded decisions.
  - `scripts/record-run.ts`, which records a real Nebius run into `public/runs/d108-nebius.json`.
- **Done when:** a replay reproduces the final engine state exactly, makes zero network calls, and keeps the original model IDs and fallback flags.
- **Needs:** A8, B2. **Unblocks:** B8.

### A11. Retire the old deliberation route · `ws-vee.12` · Plan A10

- **Builds:** deletes `app/api/agents/deliberate`.
- **Done when:** `grep -rn "new SimulationEngine" app` finds nothing, and `pnpm build` passes.
- **Needs:** B5.

---

## Person B: Models & Product

### B1. Nebius access, model tiers, smoke test · `ws-2ab.1` · Plan B1

- **Builds:**
  - **Nebius access, first thing Tuesday:** the API key, or the hackathon event credits plus Builders Program credits.
  - **Model tiers** in `lib/agents/models.ts`: Nano for the driver, Super for the dock lead and yard controller, Ultra for the supervisor. Environment variables can override each tier.
  - **Smoke test** `scripts/smoke-token-factory.ts`: lists the models, then tests one tool call per tier.
- **Done when:** the tier tests pass. Once a key exists, the smoke-test output goes into `docs/hackathon.md`, and a failing tier is rerouted to Super.
- **Unblocks:** B2.

### B2. Nemotron deliberator · `ws-2ab.2` · Plan B2

- **Builds:** `createNemotronDeliberator()`. It sends one agent turn to Token Factory and records the model, latency and token usage. On a missing key, an HTTP error, a timeout after 20 s or a malformed reply, it uses a labeled fallback and records the reason.
- **Done when:** mocked tests cover usage capture and each fallback reason. A text-only reply never counts as Nemotron output.
- **Needs:** A1, B1. **Unblocks:** A10.

### B3. Client run hook and projection · `ws-2ab.3` · Plan B3

- **Builds:**
  - `projectRun(snapshot)` turns a run snapshot into the dashboard view: clock, counts, timeline, commitments, agents, recent model calls and budget.
  - `useRun()` talks only to `/api/runs` and disables Step while a request is in flight.
- **Done when:** counts come from the engine, not illustrative data. Fallback calls are labeled "fallback", rejections show their reason, and a 404 sets status `missing`.
- **Needs:** A1. **Unblocks:** B4, B5.

### B4. Scene from the engine · `ws-2ab.4` · Plan B4

- **Builds:** `sceneStateFromEngine()` in `lib/scene/from-engine.ts`. The scene takes a `state` prop, and it falls back to the illustrative state only when no run exists.
- **Done when:** the door count stays 182, a closed D-108 renders as closed, and T-2291 in transit renders as moving. The door visibly turns red after the disruption.
- **Needs:** B3. **Unblocks:** B5.

### B5. Dashboard on the run · `ws-2ab.5` · Plan B5

- **Builds:**
  - The panels, timeline, inspector and scene all read `useRun`.
  - A single "Run the D-108 scenario" button runs start, disrupt, then steps until done.
  - Each model call shows a badge: model, tier, latency, tokens, and FALLBACK when it applies.
  - A budget meter.
  - Rejected moves stay visible in the timeline.
  - The old `lib/dashboard/use-simulation.ts` is deleted.
- **Done when:** the D-108 flow completes in the browser in both themes with no console errors, and `use-simulation` is gone.
- **Needs:** B3, B4, A8. **Unblocks:** A11, B7, B8.

### B6. Tavily scout · `ws-2ab.6` · Plan B6 · P1

- **Builds:** merges `origin/feat/polish-ui`. A chosen search result becomes a hypothetical `external_delay` disruption that carries its source links.
- **Done when:** fixture results are labeled "illustrative", live results carry their URLs, and the timeline shows the sources with a "hypothetical" label.
- **Needs:** A8.

### B7. Comparison view · `ws-2ab.7` · Plan B7 · P1

- **Builds:** a collapsible panel comparing agents against first-come rules on the same scenario and the same disruptions. It shows every metric, displays "unknown" as unknown, shows both runs' model IDs, and marks a run "partly baseline" if it hit the budget cap.
- **Done when:** both columns fill in the browser, and no "better" claim appears without numbers behind it.
- **Needs:** A9, B5.

### B8. Replay mode and deployment · `ws-2ab.8` · Plan B8

- **Builds:**
  - `/?replay=d108` plays the recorded run, with a banner naming the models and date and stating it makes no model calls.
  - A `Dockerfile` and `docs/deploy.md` for the live app, which runs on one long-lived container: a Nebius Serverless Endpoint first, any single-instance host as the fallback.
- **Done when:** in a fresh browser profile, replay works with no key, the live D-108 flow works on the hosted URL, and an unknown run returns 404.
- **Needs:** A10, B5. **Unblocks:** B9.

### B9. Submission · `ws-2ab.9` · Plan B9

- **Builds:**
  - A demo video of 3 minutes or less, public on YouTube. It shows the model IDs, a rejected move, the comparison, and the Tavily scout if it shipped.
  - The README: demo URL, replay URL, setup, and how the models are tiered.
  - The Devpost entry: Best Apps and Agents track, measured numbers only.
  - The feedback record and the change record (the project started Oct 10, inside the Aug 26 to Oct 30 period).
- **Done when:** the repo is public with its MIT license visible, both URLs work while logged out, and the entry is submitted by Fri 09:00 PT.
- **Needs:** B8.

---

## Handoffs between lanes

| Waiting | On | Expected | Until then |
|---|---|---|---|
| B2, B3 | A1 contract | Tue 11:00 ET | B reviews the draft |
| B5, B6 | A8 `/api/runs` | Wed | B develops against `ScriptedDeliberator` |
| A10 | B2 Nemotron deliberator | Wed | A tests replay with scripted decisions |
| B7 | A9 metrics | Thu | B lays out the panel with placeholders |
| B8 | A10 recorded run | Thu 20:00 ET | B builds replay against a short test recording |
| A11 | B5 dashboard on the run | Wed night | The old route stays |

## Checkpoints

| When (ET) | What works |
|---|---|
| Tue 18:00 | B's dashboard creates and steps a run through A's API |
| Wed 20:00 | The D-108 negotiation runs on Nemotron and shows in the scene |
| Thu 20:00 | A real Nebius run is recorded (A10) |
| Thu 22:00 | Freeze. Bug fixes only after this |
| Fri 09:00 PT | Submitted |
