# Nebius × NVIDIA submission plan

Based on the competition brief supplied by the team on October 26, 2026. The complete official rules, submission window, deadline, and eligibility details were not included. Confirm those on the event page before submission; this document does not invent them.

## Positioning

**Recommended track: Best Apps and Agents.** ShiftWorld is an operations decision-rehearsal application with multiple agents. Its strongest case is inspectable coordination under disruption. A 3D warehouse scene alone does not establish embodied control or robot-policy evaluation.

Physical AI is an alternative only if the finished system and demonstration substantiate that track's scope. The supplied brief permits a hardware-free demonstration of key modules and requires at least one minute of them in action. A working hosted demo is required for the other tracks. Serverless Endpoints and Jobs are encouraged by the brief, not mandatory.

## Requirements and evidence

| Requirement from supplied brief | Repository status / remaining evidence |
| --- | --- |
| Run on Nebius Token Factory or Nebius AI Cloud | Server client exists; demonstrate a successful real inference request, not fallback |
| Use at least one NVIDIA open source model | Default now selects NVIDIA Nemotron Super; confirm access and retain an actual run trace |
| Working project in a chosen track | Prototype exists; integrate dashboard, server inference and engine as described in the architecture |
| Working demo URL | Not established in this assessment; deploy and test the actual submission URL |
| Public video, at most three minutes, on YouTube | Record working interaction, NVIDIA model use and Nebius use; publishing remains outstanding |
| Public GitHub/GitLab/Bitbucket repository | Verify public accessibility without signing in before submission |
| Open source license visible at repository root | MIT LICENSE added; retain separate third-party asset notices |
| README with setup and run instructions | Added; verify from a clean clone and with judge credentials/configuration |
| Project description and technical explanation | Draft below; finalize against completed behavior |
| Explain NVIDIA/Nebius use and Token Factory impact | Record model ID, endpoint, measured latency, calls, failures and what inference enables |
| Feedback on Nebius and NVIDIA tools/models | Fill the feedback record with actual observations |
| Significant changes if project predates submission period | Establish the official start date and baseline commit; prepare an accurate change summary |
| IRL event city, if attended | Team must supply the actual attended city; do not infer it |

The optional Tavily award is relevant to the current disruption-search work. Demonstrate useful sourced information and its effect on a hypothetical decision; do not describe fixture articles or heuristic warehouse impacts as verified live incidents.

## Project-description draft

ShiftWorld lets an operations supervisor rehearse warehouse disruptions before acting. A dock closure can affect drivers, yard movements, cargo availability and outbound commitments. The application brings those dependencies into an inspectable 3D workspace, with distinct software agents responsible for local decisions and a deterministic engine responsible for physical constraints and resource reservations.

The planned inference path uses NVIDIA Nemotron through Nebius Token Factory to propose structured actions from role-specific observations. The engine validates the proposals and records accepted and rejected actions. Facility capacities are grounded in published property specifications; synthetic workloads and hypothetical interventions are labeled separately.

**Before submitting this copy:** complete the connected workflow and describe only the paths demonstrated by the release. Do not claim measured efficiency gains, durable replay, real operational accuracy, or fully autonomous negotiation until verified.

## Three-minute demo outline

| Time | Show |
| --- | --- |
| 0:00–0:20 | Operational question: what happens when a dock closes during a shift? |
| 0:20–0:45 | Warehouse, entity selection, sourced capacity and explicit synthetic workload |
| 0:45–1:25 | Inject D-108 closure; show dock lead offer, driver/yard responses and engine validation |
| 1:25–1:55 | Show accepted relocation and one rejected conflicting action, reflected in the same scene/timeline |
| 1:55–2:25 | Show real NVIDIA model ID, Nebius inference evidence, latency and fallback status |
| 2:25–2:45 | Show replay/comparison only if implemented; otherwise show recorded action evidence and limitations |
| 2:45–3:00 | Close with the working demo and public repository URLs |

This is a recording plan, not a claim these interactions already work. Rehearse the exact release build. Hide credentials in all recordings. Keep synthetic data visibly labeled throughout.

## Feedback record to complete after real usage

- Service, endpoint/region and exact model ID:
- Task and prompt/tool schema version:
- What worked, with an example run:
- Failed request or malformed output, with reproducible steps and redacted logs:
- Observed latency and token usage, including sample size:
- Documentation or onboarding friction:
- Suggested provider improvement and why it matters:

## Submission-period change record

- Official submission-period start/end and rules URL:
- Did the project exist before the start? Establish from repository history:
- Baseline commit at the start of the period:
- Final submitted commit:
- Significant new work during the period, with commits/PRs:
- Existing code/assets reused and their attribution:
- Team members and attended city, if applicable:

## Release gates

- [ ] The browser invokes the server-owned run and a real NVIDIA model on Nebius.
- [ ] A complete negotiation produces an engine-validated state change visible in the scene.
- [ ] Role permissions, conflicting allocation and malformed-output paths are exercised.
- [ ] Offline fallback and illustrative/Tavily evidence are accurately labeled.
- [ ] Fresh-install checks and production build pass; the hosted demo works from a new session.
- [ ] Public code, license, README, video URL, project description, feedback and change record are ready.
- [ ] Deadline and eligibility are verified against the complete official rules.
