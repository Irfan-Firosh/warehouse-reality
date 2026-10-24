# Third-party 3D models in this app

Downloaded 2026-10-11 from poly.pizza (the GLB each listing serves). Licenses were read from each listing's page data on that date. All models are appearance-only proxies. They don't establish what equipment DFW Building I actually uses, and their geometry never sets capacity, speed or service duration.

| File | Model | Author | License | Source | Used as |
|---|---|---|---|---|---|
| `semi-williwam.glb` | Basic Semi-truck with spikes | WilliWam | CC0 1.0 | https://poly.pizza/m/kGA4N3G7Jv | Road and yard tractors. The `spike` primitive is dropped at load. Base color is overridden. |
| `container-quaternius.glb` | Shipping Container | Quaternius | CC0 1.0 | https://poly.pizza/m/dQXRtm5GbO | Box-trailer body, stretched to 53 ft. The red panels are recolored to show status. |
| `forklift-kolos.glb` | Forklift | KolosStudios | **CC BY 3.0** | https://poly.pizza/m/DTQBuenKJY | Forklifts |
| `pallet-quaternius.glb` | Pallet | Quaternius | CC0 1.0 | https://poly.pizza/m/cUAsYHDqfD | Decorative pallets in staging lanes (not cargo records) |

## Required attribution (CC BY 3.0)

- "Forklift" by KolosStudios, https://poly.pizza/m/DTQBuenKJY, licensed under CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/). Modified: re-oriented, rescaled and tinted at runtime.

The CC0 models need no attribution. They are credited above anyway.

## Archived licenses and listings

- License texts, fetched 2026-10-11 from creativecommons.org: [`licenses/CC0-1.0.txt`](licenses/CC0-1.0.txt) (https://creativecommons.org/publicdomain/zero/1.0/legalcode.txt) and [`licenses/CC-BY-3.0.txt`](licenses/CC-BY-3.0.txt) (https://creativecommons.org/licenses/by/3.0/legalcode.txt).
- One listing snapshot per model, `licenses/polypizza-<id>.json`: Title, Creator, Licence, PublicID, ResourceID and GLB URL as the listing's page data (`window.__SERVER_APP_STATE__.initialData.model`) showed them on 2026-10-11, plus the SHA-1 and size of the bundled file. Each bundled GLB was re-downloaded from its GLB URL on that date and its SHA-1 matched.

| File | SHA-1 | Snapshot |
|---|---|---|
| `semi-williwam.glb` | `3016b940108feb712fdfd071812b794b962e80b9` | [`polypizza-kGA4N3G7Jv.json`](licenses/polypizza-kGA4N3G7Jv.json) |
| `container-quaternius.glb` | `ebfe2d48abcdbf4ee0445de0a407bca3f20eec7a` | [`polypizza-dQXRtm5GbO.json`](licenses/polypizza-dQXRtm5GbO.json) |
| `forklift-kolos.glb` | `bb09da754bbe2781f1d862b47ec5d11367ccdc49` | [`polypizza-DTQBuenKJY.json`](licenses/polypizza-DTQBuenKJY.json) |
| `pallet-quaternius.glb` | `ac2afe8e58f12bdd4ab9cff3cc2514963ca5206f` | [`polypizza-cUAsYHDqfD.json`](licenses/polypizza-cUAsYHDqfD.json) |
