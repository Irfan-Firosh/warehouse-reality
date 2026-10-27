# Scene motion, follow mode and engine snapshot: implementation plan

**Goal:** Trucks visibly move (illustrative ambient motion), a truck can be followed, view settings move into a pane, and the scene can draw from an engine snapshot.

**Spec:** `docs/superpowers/specs/2026-10-27-scene-motion-follow-design.md`. Beads: ws-2ab.11 (motion, follow, pane) and the pure part of ws-2ab.4 (scene from engine). Lane B files only: `lib/scene/**`, `components/**`. Never edit `lib/engine/**`.

**Architecture:** Pure, tested modules in `lib/scene/` decide every pose; React Three Fiber components only read them. Moving poses live in one `Map<id, Placement>` ref written once per frame (negative `useFrame` priority) and read by instances, selection marks, the lens and the follow camera.

## Global constraints
- Ambient motion is illustrative: deterministic (seeded by entity id, no `Math.random`), never written to the engine, labelled "Ambient motion: illustrative" in the provenance chip while on, and switchable. Default on.
- No speeds, durations or counts from ambient motion are shown as data.
- Rendering never decides outcomes; `sceneStateFromEngine` is read-only over the snapshot.
- Unknown stays unknown: an engine location the scene cannot place is left out of the scene, never placed at a guessed spot.

## Review focus
1. Selecting, hovering and picking a moving truck must hit where it is drawn now, not its rest pose.
2. A resize, a manual orbit or a drawer opening must not break follow mode; Escape and Reset must always return to the fitted view.
3. Ambient off must restore every entity to its exact layout pose.
4. Time-lapse stepping (4×, 16×) must step motion only; camera and band stay smooth.
5. An engine snapshot with no trailers, an unknown dock id, or a coupled trailer must render without throwing.

---

### Task 1: pure logic (one commit)

**Files:** Create `lib/scene/ambient-motion.ts`, `lib/scene/from-engine.ts` and their tests. Modify `lib/scene/camera-fit.ts` (+ test), `lib/scene/types.ts` (forklift `idle`), `lib/scene/status-text.ts` (moving text from `at`, idle forklift), `lib/scene/layout.ts` (`movingPair`).

**Interfaces (produces):**
- `quantize(t: number, speed: 1 | 4 | 16): number`: identity at 1×; otherwise floors `t` to steps of `speed / 8` display seconds (8 Hz wall-clock steps).
- `interface AmbientMotion { ids: ReadonlySet<string>; poseAt(id: string, t: number): Placement | undefined; route(id: string): readonly (readonly [number, number])[] | undefined }`
- `createAmbientMotion(state: SceneState, layout: ReadonlyMap<string, Placement>): AmbientMotion`. Animates: the moving trailer and its coupled tractor along door A → move lane → door B; idle yard tractors shuttling on the move lane; gate-queue trailers and their tractors creeping north-to-south as a conveyor; working forklifts on small loops inside the building. Failed forklifts, parked/served trailers and fixtures are not in `ids`.
- `chasePose(target: Placement, distance?: number, pitch?: number): CameraPose` in `camera-fit.ts`; defaults 250 ft and 35°; the camera sits behind the model's forward vector `(sin rotY, 0, cos rotY)`.
- `sceneStateFromEngine(s: EngineSnapshot): SceneState`: 182 doors, 4 ramps, 235 stalls always; engine statuses overlaid (`occupied`→`serving`, others same); trailers at a known door or stall, `in_transit` as `moving` with `at` = `from→to`, `gate` with its `queueIndex`; trailers in `coupled`, `yard_lane` or at unknown ids are left out; tractors and forklift equipment keep engine ids; yard tractors without a trailer get park indexes in id order.
- `movingPair(state: SceneState): readonly [string, string] | undefined`: the first moving trailer's `from→to` when both are door ids.

**Tests:** quantize identity and 8 Hz steps; poses deterministic for equal `t`; every pose inside `layoutBounds(layout)` over a sampled minute; failed forklift and parked trailers not animated; tractor stays hitched to its trailer (distance ≈ hitch); route starts at door A and ends at door B; chasePose pitch 35° ± 0.5°, distance 250 ± 1, camera behind the heading; from-engine keeps 182/4/235, D-108 closed renders closed, T-2291 in transit renders moving, unmentioned door stays free, coupled and unknown-dock trailers are left out, empty snapshot works.

### Task 2: live motion in the scene (one commit)

**Files:** Create `components/scene/motion-clock.tsx`. Modify `instanced-parts.tsx` (optional per-frame pose for a moving subset), `vehicles.tsx`, `selection-marks.tsx` (follow live pose), `miniature-lens.tsx` (focus by id from the live map; `strength` sets the tilt-shift blend opacity), `facility-scene.tsx` (`state` prop defaulting to `ILLUSTRATIVE_STATE`, `ambient` and `speed` props).
- `MotionClock` advances a display clock by `delta * speed`, applies `quantize`, and writes `motion.poseAt` into the live map (layout pose when ambient is off).

### Task 3: settings pane and follow mode (one commit)

**Files:** Create `components/dashboard/settings-pane.tsx`, `components/scene/follow-rig.tsx`, `components/scene/route-line.tsx`, `lib/scene/view-settings.ts` (`ViewSettings` type and defaults). Modify `top-bar.tsx` (⚙ in the right pill), `dashboard-layout.tsx` (owns `ViewSettings`, `followId`), `scene-overlay.tsx` (only readout, Follow button for trucks, Exceptions; chip shows ambient label and model load state), `camera-rig.tsx` (`paused` while following; `TOP_VIEW` when top-down).
- `ViewSettings = { roof, models, lens, lensStrength (0–1, default 1), shadows, ambient, topDown }`.
- Follow: on start, ease the camera to `chasePose`; after that, translate camera and orbit target by the truck's per-frame movement so orbiting still works. `F` toggles follow on a selected truck, `[` / `]` cycle animated trucks, Escape or Reset stops and refits. A dashed `RouteLine` draws `motion.route(id)`.
