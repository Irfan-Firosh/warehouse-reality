# Feature split: Person A and Person B

Deadline: Fri Oct 30, 10:00 PT. We submit by 09:00 PT. Every feature has exactly one owner, and no file is edited by both people. Details for each feature (signatures, tests) are in `docs/superpowers/plans/2026-10-27-hackathon-final.md`.

## Person A: Run & Engine

Owns `lib/engine/**`, `lib/run/**`, `app/api/runs/**`, `app/api/agents/**`, `types/run.ts` and `scripts/record-run.ts`.

1. **Shared run contract.** Writes `types/run.ts` and `lib/run/api-schemas.ts` (RunSnapshot, RunEvent, ModelCall, Deliberator, API bodies). B reviews it by Tue 11:00 ET. After that, A changes it only after telling B.
2. **D-108 scenario seed.** T-2291 sits at D-108 with 9 of 22 pallets unloaded, D-112 is free, yard tractor YT-2 is idle, forklift F-07 is working, and a contender T-3061 waits in P-061.
3. **Engine clock and full checkpoints.** Stepping advances logical time. Checkpoints include the event queue, processed request IDs and the sequence counter.
4. **Proposal adapter.** Turns a model's `propose` call into an engine commitment with a stable ID and a valid expiry.
5. **Role permissions.** Enforces which agent may propose, accept, commit, move, unload or cancel what.
6. **Real cancel, escalate and observe.** Cancel releases reservations, escalate reaches the supervisor, and the supervisor can observe.
7. **Run orchestrator.** Wakes the affected agents, runs one turn each (decide, check permission, adapt, execute), records events and model calls, and enforces the budget cap (60 calls or 150k tokens, then first-come rules take over).
8. **`/api/runs` API.** Create, get, step and disrupt runs. Returns 404 for an unknown run and 409 for a busy one.
9. **First-come baseline and metrics.** A no-model controller plus driver waiting, lateness, door-hours lost, invalid proposals, calls and tokens.
10. **Export and replay.** Exports a run and replays it with no model calls. A record script writes `public/runs/d108-nebius.json`.
11. **Retire the old server route.** Deletes `app/api/agents/deliberate` once B's dashboard uses `/api/runs`.

## Person B: Models & Product

Owns `lib/agents/**`, `lib/external/**`, `lib/dashboard/**`, `lib/scene/**`, `components/**`, `app/page.tsx`, deployment and the submission material.

1. **Nebius access and model tiers.** Gets the API key or hackathon credits first. Maps Nano to the driver, Super to the dock lead and yard controller, and Ultra to the supervisor. A smoke test checks tool calling on each tier.
2. **Nemotron deliberator.** One agent turn through Token Factory, recording model ID, latency and tokens. A labeled fallback covers a missing key, an error, a timeout or a malformed reply.
3. **Client run hook.** Talks only to `/api/runs`, and turns a run snapshot into what the dashboard shows.
4. **Scene from the engine.** The 3D scene renders the run's real state. The 182 doors, 4 ramps and 235 stalls stay.
5. **Dashboard on the run.**
   - Panels, timeline and inspector read the run.
   - One "Run the D-108 scenario" button drives the demo.
   - A badge on every model call shows model, latency, tokens and fallback.
   - Rejected moves stay visible.
   - Deletes the old browser engine (`lib/dashboard/use-simulation.ts`).
6. **Tavily scout.** Merges `feat/polish-ui` and turns sourced search results into hypothetical disruptions with links.
7. **Comparison view.** Agents vs first-come rules on the same inputs. Unknown values are shown as "unknown".
8. **Replay mode and deployment.** `/?replay=d108` plays the recorded run with no key. The live app is hosted on one long-lived container.
9. **Submission.** Video (3 minutes or less), README, Devpost text, the Nebius and NVIDIA feedback, and the change record.

## Handoffs

| B needs from A | When | Until then |
|---|---|---|
| Shared contract (A1) | Tue 11:00 ET | B reviews the draft |
| `/api/runs` (A8) | Wed | B develops against a scripted deliberator |
| Metrics (A9) | Thu | B lays out the comparison view with placeholders |
| Recorded run file (A10) | Thu 20:00 ET | B builds replay against a short test recording |

| A needs from B | When | Until then |
|---|---|---|
| Nemotron deliberator (B2) | Wed | A tests with the scripted deliberator |

## Checkpoints

| When (ET) | What works |
|---|---|
| Tue 18:00 | B's dashboard creates and steps a run through A's API |
| Wed 20:00 | The D-108 negotiation runs on Nemotron and shows in the scene |
| Thu 20:00 | A real Nebius run is recorded |
| Thu 22:00 | Freeze. Bug fixes only after this |
| Fri 09:00 PT | Submitted |
