# Free 3D assets: research and recommendation

Retrieved 2026-10-11. The "License" column says where each license was checked; only rows marked **verified** were checked by us on that date. Re-check and archive the license text at download time before shipping anything (PRD L01).

## Bottom line

**Vehicles and equipment use free low-poly models. The facility is procedural.** The R3F mockup (`docs/mockups/dashboard.html`) ships this split, with a toggle back to primitives behind the same entity bindings (PRD §12).

1. **Procedural:** the building shell, the 182 dock-high doors, the 4 ramp doors and the 235 trailer spaces. They must follow sourced dimensions and counts (S1). No free warehouse model matches them, and an asset's own door count or footprint must not be adopted.
2. **Free models, all inspected visually in `docs/mockups/assets.html`:** tractors use the WilliWam semi (CC0, spikes dropped). Trailers use the Quaternius shipping container (CC0) stretched to 53 ft on a primitive chassis. Forklifts use KolosStudios (CC BY 3.0, credited on screen and in `docs/mockups/assets/ATTRIBUTION.md`). Staging-lane pallets use Quaternius (CC0); they are decoration, not cargo records. Vehicle triangles: about 333k for the mockup's illustrative state (207 trailers, 13 tractors, 24 forklifts), and about 562k for trailers alone if all 182 doors and 235 stalls held one (1,348 triangles each). Frame time is not yet profiled on a recorded device (PRD §16).
3. **Rejected after inspection:** Kenney `truck.glb` (it's a pickup) and Quaternius "Truck" (it's a delivery van). Neither ships.

## Candidates checked

| Role | Candidate | License | Size | Verdict |
|---|---|---|---|---|
| Semi tractor | WilliWam "Basic Semi-truck with spikes" ([poly.pizza/m/kGA4N3G7Jv](https://poly.pizza/m/kGA4N3G7Jv)) | **CC0 1.0, verified**: listing page data `"Licence":"CC0 1.0"`, shown as "Public Domain (CC0)" | **2,258 triangles** (listing; our count of the GLB matches). One mesh, five flat-color materials, no texture files | **Best semi candidate.** Tags "Semi Truck", "Low Poly". 1,048 of the 2,258 triangles are a separate `spike` primitive, which can be dropped at load. Approximate length:width 3.3:1, so scale it as an appearance-only proxy, not as a measured vehicle. Inspected visually (front grille spikes dropped) and bundled in `docs/mockups/assets/polypizza/`. **In use.** |
| Tractor proxy | Kenney Car Kit 3.1, `truck.glb` / `delivery.glb` ([kenney.nl/assets/car-kit](https://kenney.nl/assets/car-kit)) | **CC0 1.0, verified** from the bundled `License.txt` | ~2.1k / ~2.5k triangles, GLB | **Usable now**, but only as a generic vehicle proxy: `truck.glb` is a **pickup truck** and `delivery.glb` is a **delivery van**; neither is a semi tractor. Both GLBs reference an **external texture**, `Textures/colormap.png` (12 KB), which must ship next to them (or be embedded with `gltf-transform copy`); GLTFLoader resolves the model even when the texture is missing, so any loader that ships these must check that every mesh has its map after load (requirement only; no such check exists, because these models aren't loaded). **Not shipped.**  |
| Semi tractor | rudransh17feb "American Semi Truck" (PRD S6) | CC BY, verified via the Sketchfab API | **926,663 faces** | **Reject.** Not low-poly; it would dominate the frame budget at 100+ instances. |
| Box trailer | Artbor "Semi Trailer Low poly Animated" (PRD S7) | CC BY, verified via the Sketchfab API | 26,316 faces | Not used: Sketchfab downloads need an account, and at 26k faces × 400 trailers it is about 20× the container's cost. |
| Trailer body | Quaternius "Shipping Container" ([poly.pizza/m/dQXRtm5GbO](https://poly.pizza/m/dQXRtm5GbO)) | **CC0 1.0, verified** (listing data) | 1,336 triangles, no textures | **In use** as the box-trailer body, stretched to 53 ft on a primitive chassis. No CC0 or CC BY semi trailer exists on poly.pizza (searched "trailer", "semi trailer", "truck trailer"). |
| Pallet | Quaternius "Pallet" ([poly.pizza/m/cUAsYHDqfD](https://poly.pizza/m/cUAsYHDqfD)) | **CC0 1.0, verified** (listing data) | 176 triangles | **In use** as decoration in the staging lanes. |
| Box truck | Quaternius "Truck" ([poly.pizza/m/cXw6oiFtZ8](https://poly.pizza/m/cXw6oiFtZ8)) | CC0 1.0, verified (listing data) | 7,474 triangles | Rejected after inspection: it's a delivery van. |
| Forklift | tasraven "Forklift" (PRD S8) | CC BY, verified via the Sketchfab API | 34,376 faces | Heavy for a background object; attribution required. |
| Forklift | KolosStudios "Forklift" ([poly.pizza/m/DTQBuenKJY](https://poly.pizza/m/DTQBuenKJY)) | **CC BY 3.0, verified** on the listing | not stated; FBX/glTF | **In use** (1,590 triangles, no textures). Attribution required and given. A pallet truck from the same author ([snDq7v3GRO](https://poly.pizza/m/snDq7v3GRO), CC BY 3.0, 788 triangles) appears in the asset gallery only. |
| Warehouse | Nicholas01 "Warehouse FBX Model Free" (PRD S5) | CC BY, verified via the Sketchfab API | 11,106 faces | **Reject** as a facility mesh: arbitrary footprint and door count. |
| Industrial props | Kenney Conveyor Kit / Factory Kit / City Kit (Industrial) | CC0 per Kenney's site-wide terms; **not verified** file by file | small | Optional interior or background dressing only. |
| Textures / HDRI | Poly Haven Asphalt 02, Concrete Floor, Industrial HDRIs (PRD S10–S12) | CC0 per the PRD research; **not re-verified** | large | **Skip.** Flat colors are the design target, and textures add load and cleanup work. |

Sketchfab facts come from `api.sketchfab.com/v3/models/{uid}` (name, author, `license.label`, `faceCount`), queried 2026-10-11. The WilliWam facts come from the poly.pizza listing data and the GLB it serves (`static.poly.pizza/73505a44-c468-4ba1-8210-07175610e32e.glb`), inspected 2026-10-11; the poly.pizza models in use were downloaded the same day.

## Recommendation

- **Rendering stack:** React Three Fiber, with three's `GLTFLoader` (one load promise read through React's `use`) and three's `OrbitControls`, all pinned in the import map; drei isn't used. The models are normalized at load by `docs/mockups/models.js`, which bakes the node transforms, puts the long axis on z with the front at +z and the bottom at y = 0, and fits the proxy size. Each part is drawn as an `InstancedMesh` keyed by entity ID, so the scene and the tables pick the same identity (V02).
- **Shipped models:** the semi, container, forklift and pallet above, with license and attribution in `docs/mockups/assets/ATTRIBUTION.md`, and the license texts, listing snapshots and file hashes archived in `docs/mockups/assets/licenses/`. The CC BY credit is visible on screen whenever the models are shown.
- **Fallback:** the "Meshes" toggle switches to primitives bound to the same IDs. If a model fails to load, the scene falls back to primitives and the button says so; the failure is never silent.
- **Fixed dimensions:** doors are 9 × 10 ft openings (S1). Stalls are 50 ft deep, the S1 trailer-parking depth. Stall width is an appearance-only schematic pitch (S1 building length ÷ stalls per side ≈ 13.9 ft), not a sourced width.
- **Still unresolved (from the PRD):** a verified free, low-poly **terminal yard tractor**. Yard tractors reuse the over-the-road semi in a different color, as a labeled proxy.

The mockup pages (`dashboard.html`, `assets.html`) use ES modules and fetch GLB files, so serve them over HTTP with `python3 docs/mockups/serve.py`, which disables caching. Plain `http.server` lets browsers reuse stale modules after an edit. The dashboard shows a visible notice if the scene cannot load.

Vehicle and forklift geometry never affects capacity, speed or service duration (PRD §12).
