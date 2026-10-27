# Scene settings pane, follow mode and ambient motion

Date: 2026-10-27 · Bead: ws-2ab.11 (lane B) · Builds on PR "minimal full-bleed dashboard and tilt-shift scene" (ws-2ab.10).

## Why

The scene is a frozen snapshot: nothing moves, so the tilt-shift miniature reads as a still photo, and there is no way to watch one truck's story. The roof/models/lens toggles also sit on the scene. The user wants: trucks that move, a way to follow a truck, and a settings pane on the right.

## Goals

1. **Settings pane.** A ⚙ button in the top-right pill opens a compact panel below it (right side). Sections:
   - View: Roof, Models, Lens, Lens strength (slider), Shadows.
   - Camera: Reset view, Follow selected, Top-down.
   - Motion: Ambient motion on/off.
   Bottom-right keeps only the selection readout and the Exceptions picker. The panel closes on Escape and on outside click.
2. **Ambient motion (illustrative).** Decorative movement so the miniature feels alive: yard tractors shuttle along the move lanes, the gate queue creeps forward and resets, forklifts roam inside. Deterministic from a display clock (seeded, no `Math.random`), never written to the engine. The provenance chip says "Ambient motion: illustrative" while it is on. Default on.
3. **Time-lapse stepping.** Display speed 1× is smooth; at 4× and 16× moving things update at 8 Hz and hold between steps (the tilt-shift "wind-up toy" look). The camera stays smooth every frame.
4. **Follow mode.** Select a truck (tractor or trailer), then Follow (readout button, settings pane, or `F`). The camera drops to a 35° pitch about 250 ft from the truck and eases along with it each frame; OrbitControls stay usable around the truck. The tilt-shift band locks on the truck and narrows. A dashed route line on the ground shows where it is heading. `[` / `]` cycle through moving trucks. Escape, Reset or selecting a non-truck stops following and returns to the fitted view.

## Non-goals

- Engine-driven motion. The engine moves trailers in discrete jumps with no travel time, and its clock does not run on ▶ (ws-vee.4). When it does, engine moves are tweened over the commitment's time window; that is a later bead.
- Inventing operational numbers: ambient motion has no speeds, counts or durations shown anywhere as data. Its pacing is visual only.

## Anti-goals

- Ambient motion that looks like engine output (it must be labelled and switchable).
- The camera fighting the user: refitting on resize must not interrupt follow mode or a manual orbit.

## Decisions

- **Settings state lives in `DashboardLayout`** (a `ViewSettings` object passed to the scene) so the pane can sit in the top-right pill.
- **Pure motion module** `lib/scene/ambient-motion.ts`: `ambientPose(id, t): Placement | undefined` for every animated entity, plus `quantize(t, speed)` for the stepping. Tested for determinism, staying inside `layoutBounds`, and stepping.
- **Live poses**: one `Map<id, Placement>` ref updated in a single `useFrame` before consumers; vehicles, selection marks, the lens focus, follow camera and route line all read it. Static entities keep their layout placement.
- **Animated instances**: `InstancedParts` gains an optional per-frame matrix update for the moving subset; picking keeps working on the moving instances.
- **Follow camera**: pure `chasePose(target, heading, view)` in `lib/scene/camera-fit.ts`, tested; a `FollowRig` eases position and target toward it each frame.

## Left to the builder

Exact shuttle paths and pacing, the chase easing constant, the route line styling, and the pane's visual layout (TextureButton style).
