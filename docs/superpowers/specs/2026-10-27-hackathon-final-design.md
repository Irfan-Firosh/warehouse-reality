# Warehouse Sim: final hackathon design (Nebius × NVIDIA)

Date: 2026-10-27. Deadline: **Fri Oct 30, 10:00 PT (13:00 ET)**. Internal freeze: Thu Oct 29, 22:00 ET. Submit by Fri 09:00 PT.
Team: two interchangeable full-stack builders, near full-time. Sources: [overview](https://nebiusglobalaihackathon.devpost.com/), [rules](https://nebiusglobalaihackathon.devpost.com/rules), `docs/architecture.md` (gap list), `docs/hackathon.md` (submission checklist).

## Intent

Win the **Best Apps and Agents** track and compete for the grand prize. The pitch in one line: *Nemotron agents negotiate a warehouse disruption, and a deterministic engine referees every promise.* A supervisor closes a dock door. A driver agent, a dock lead agent and a yard controller agent negotiate a relocation through Nemotron tool calls on Nebius Token Factory. The engine accepts or rejects each move with a reason. The 3D yard shows the result, and a comparison shows how the agents did against a first-come-first-served baseline on the same inputs.

## How the judging maps to the build (4 criteria, equally weighted; stage 1 is a pass/fail track fit)

| Criterion | What earns it here |
|---|---|
| Technical implementation | Real Token Factory calls with **model tiering** (Nano for routine turns, Super for negotiation, Ultra for supervisor escalations and the after-action report). Tool calls are schema-validated and engine-validated. Latency, tokens and model ID are shown per call. |
| Design | One connected flow from scenario to disruption to negotiation to result to comparison. The scene, panels and timeline all come from one run snapshot. A guided "Run the D-108 scenario" button drives it. |
| Potential impact | A real audience (yard and dock supervisors) and a real cost: driver detention costs carriers an estimated $1.1–1.3B a year (DOT OIG, 2018). Measured waiting and lateness for agents vs FCFS on identical inputs. |
| Quality of idea | "LLMs propose, physics disposes": agents can negotiate freely but cannot cheat the engine. Rejected proposals are shown, not hidden. Evidence honesty: every number is labeled sourced, derived, scenario or hypothetical. |

## Goals (P0, must ship)

1. **One server-owned run.** A run registry in the Next.js server holds the engine, agents and event log per `runId`. The routes are `POST /api/runs`, `GET /api/runs/:id`, `POST /api/runs/:id/step` and `POST /api/runs/:id/disruptions`. The browser never calls the model or holds a key. This replaces the separate engines in `use-simulation.ts` and `/api/agents/deliberate`.
2. **The complete negotiation loop on the engine.** Fix the proposal adapter (architecture gap 2), role authorization and real `cancel`/`escalate`/`observe` (gap 3), and the automatic request → offer → accept → commit → execute cycle (gap 4). Stepping advances the clock (gap 6).
3. **The D-108 scenario end to end.** D-108 closes, T-2291 is paused with 9 of 22 pallets done, the dock lead offers D-112, the driver accepts, the yard controller commits YT-2, the engine executes the move, and the unload resumes from 9. One conflicting proposal is rejected with a reason and stays visible.
4. **Real Nemotron on Token Factory with tiered routing.** Provenance (model ID, latency, tokens, fallback flag) is recorded on every turn and shown in the UI. The deterministic fallback stays for development but is labeled "fallback" everywhere.
5. **The UI reads only the run snapshot.** The scene, facility panel, inspector and timeline read the run, not `ILLUSTRATIVE_STATE` (gap 5). Illustrative data survives only in the scene, outside the run, and keeps its label.
6. **Recorded-run replay.** Export the event log and model-call log of one real Nebius run to `public/runs/d108-nebius.json`. The hosted demo can replay it with no key and no credits. Replay never calls the model.
7. **Hosted demo and submission.** A public URL, a public repo with an MIT license (already present), a public YouTube video of 3 minutes or less, the Devpost write-up, feedback, and the change record. See `docs/hackathon.md`.

## Should (P1)

8. **FCFS baseline and comparison.** A deterministic controller runs the same scenario seed. The panel compares driver waiting, departure lateness, door-hours lost, invalid proposals, LLM calls and tokens.
9. **Tavily disruption scout.** Merge `feat/polish-ui` (Tavily search with honest provenance). Search results can propose a *hypothetical* disruption with cited sources; they never claim a real DFW incident. This also makes us eligible for the $3k Best Use of Tavily prize.
10. **Small scenario generator.** A seeded generator produces a few hours of visits (live and drop-and-hook) from labeled scenario parameters. My call: keep it to about 12–20 visits so the demo stays legible and the credits last.

## Stretch (P2)

After-action report by Nemotron Ultra. Baseline batch runs as Nebius Serverless Jobs. Crew-absence disruption.

## Non-goals and anti-goals

- **Non-goals:** the full 117-visit day, durable SQLite storage, multi-user isolation, import UI, more roles, and real-world calibration claims.
- **Anti-goals (a failure even if it "works"):**
  - an animation or toast that implies an engine transition that never happened
  - a fallback answer presented as Nemotron output
  - Tavily articles presented as verified DFW incidents
  - invented operational numbers
  - the browser holding a model key

## Constraints and decisions

- **Stack:** Next.js 16 + React Three Fiber (unchanged). Pure TypeScript engine in `lib/engine` (unchanged rule). Zod at every boundary.
- **Models (my call; verify IDs with `GET /v1/models` on day 1):**
  - `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` for driver turns
  - `nvidia/nemotron-3-super-120b-a12b` for dock and yard negotiation
  - `nvidia/Nemotron-3-Ultra-550b-a55b` for the supervisor and the report

  Base URL from `.env.example`. If one model fails the tool-call smoke test, route its role to Super.
- **Credentials risk:** there is no `NEBIUS_API_KEY` locally yet. Today: chase approval, or redeem the hackathon event-code credits ($25) plus the Builders Program credits ($25). The submission requires real Nemotron calls, so a key is a hard blocker by Thursday noon. Until then, develop against the labeled deterministic fallback.
- **Hosting (my call):** a single long-lived Node instance, because the run registry is in memory. First choice: a Nebius Serverless Endpoint (container), which judges will appreciate. Fallback: any single-instance container host. The recorded-run replay works on any static host, including Vercel. Do not host the live run on multi-instance serverless.
- **Credit budget (my call):** a hard per-run cap of 60 model calls and 150k tokens, enforced in the server. When the cap is hit, the run escalates to the FCFS fallback and the UI labels it.

## Team split (my call; split by area so the two of you rarely touch the same files)

- **Person A, "Run & Engine":** the run registry and API, the stepping clock, the proposal adapter, authorization, the negotiation cycle, the scenario seeding, the baseline and metrics, export and replay. Files: `lib/engine/**`, `lib/run/**`, `app/api/runs/**`.
- **Person B, "Models & Product":** the Token Factory client and tiered routing, provenance, prompts and tool schemas, the UI projection from the snapshot, the guided demo flow, merging Tavily, deployment, and the video and Devpost write-up. Files: `lib/agents/**`, `lib/external/**`, `components/**`, `app/page.tsx`, `lib/dashboard/**`.
- **The shared contract is written first and together** (`types/run.ts`: `RunSnapshot`, `RunEvent`, `ModelCall`, `StepResult`, API payloads). After that, each person changes it only by telling the other.

## Left to the builder

Prompt wording, exact panel layout and copy, metric formulas beyond the definitions in PRD §15, and the visual polish details.
