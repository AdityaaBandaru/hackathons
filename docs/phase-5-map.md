# Phase 5 — MapLibre project map

## What exists after this phase

```
frontend/
  public/geojson/nynj_projects.geojson   copy of the pre-generated geometry
  public/maplibre/                        MapLibre worker, copied at build time (gitignored)
  scripts/copy-maplibre-worker.mjs        the copier, wired into predev/prebuild/pretest
  src/lib/mapModes.ts                     the mode -> visible-IDs rule (pure)
  src/lib/scenario.tsx                    ScenarioProvider: the map's only source of "selected"
  src/components/map/ProjectMap.tsx       MapLibre layers and filters
  src/components/map/ProjectCard.tsx      click card
  src/app/map/page.tsx                    the page: modes, banners, inspector
```

No geometry was regenerated. `reference/geojson/nynj_projects.geojson` is
copied verbatim into `public/`, exactly as Phase 1 copied the seed JSON, and
the reference bundle still passes its own 27 checks untouched.

Before building anything, the GeoJSON was cross-checked against the API:
its 24 `project_id`s are exactly the 24 nynj `projects3d` IDs, and all eight
shared fields (phase, allocation, evidence class, source URL, render flag,
category name, spatial precision, implementation status) match on every
record — **0 mismatches**. That is what makes joining the map to the API by
`projectId` safe.

## The four modes

| Mode | Draws |
|---|---|
| Baseline | nothing at all |
| Temporary Operations | only the scenario's temporary-phase project IDs |
| Selected Legacy | only the scenario's permanent-phase project IDs |
| All Possibilities | all 24 candidates, translucent; the current scenario's own picks are additionally highlighted on top |

The mode rule lives in one pure function, `resolveMapSelection`, so the
invariants can be proven by test instead of by inspecting a WebGL canvas:

- **Rule 12** — baseline returns empty lists regardless of what the scenario
  says.
- **Rule 11/13** — the scenario's `selectedProjects` is the only input that
  can put an ID in `selectedIds`. There is no default portfolio, no fallback,
  and no derivation. With no scenario, nothing is selected.
- An ID the loaded geometry has no feature for is dropped, so an Atlanta
  scenario against this map selects nothing rather than erroring.
- "All Possibilities" never removes a project from the undifferentiated
  candidate set to highlight it — `candidateIds` always holds all 24, whether
  or not the scenario chose any of them. `selectedIds` is layered on top,
  populated only from the scenario's own `selectedProjects`, so a chosen
  project renders as both "possible" (still in `candidateIds`) and "chosen"
  (also in `selectedIds`, drawn with the stronger styling on top of the
  translucent one). With no scenario, `selectedIds` is empty and every
  candidate still draws, plain.

`ScenarioProvider` holds the current `OptimizeResult`. It is written in
exactly one place — the optimizer page's `onSuccess` — and has no setter that
accepts anything else and no persistence, so a stale portfolio cannot come
back looking current. Selecting a scenario-dependent mode with no scenario
shows a banner linking to the optimizer rather than drawing a guess.

## Click cards

Attributes come from `GET /api/v1/cities/nynj/projects` under the same
TanStack Query key the city evidence page uses, so the two share one cache
entry and cannot disagree.

Cost is shown twice when both exist, because they are two different claims:
the scenario's own allocation (`model_output`) and the bundle's seeded
allocation (`engineering_assumption`, with its source link). Collapsing them
would present a model output as if it were the seeded figure (rule 8). The
card also carries phase, location basis with its `spatialPrecision`, and the
`concept_only` status.

## Two things that only turned up by running it

**CARTO now serves "API KEY REQUIRED" watermarks.** The first basemap choice
would have quietly made the map depend on a paid service, against rule 14.
Switched to OpenStreetMap's standard tiles, which need no account or key, with
attribution. The tile URL is env-overridable for self-hosted tiles.

**MapLibre's web worker never started, and the failure was silent.** MapLibre
resolves its worker URL from `import.meta.url` and returns an *empty string*
when that is not an `http(s):` URL — which is what happens once the library is
bundled. `new Worker("")` then fetches the HTML page instead of a script. The
symptom was pathological: the source existed with all 24 features, all six
layers existed, every filter was correct, and `map.querySourceFeatures()`
returned 0 with no error logged anywhere, because nothing was ever tiled.
`scripts/copy-maplibre-worker.mjs` copies the worker bundle (and the shared
chunk it imports) into `public/maplibre/` on every dev/build/test run, and
`setWorkerUrl()` points at it. The files are copied rather than committed so
they cannot drift from the installed version.

Neither of these was visible to the type checker, the linter, or the build.

## Verification

```bash
cd backend && ./.venv/bin/python -m pytest    # 142 passed
cd frontend && npm test && npm run build      # 64 passed, build clean
```

Frontend tests: 64 (13 from Phase 4, 51 new across three files).

- `mapModes.test.ts` (24) — the pure rule, including that baseline hides every
  ID individually, that no unselected ID reaches `selectedIds` in any mode,
  that a null scenario selects nothing, and that in "All Possibilities" the
  highlighted subset is exactly the scenario's own `selectedIds` intersected
  with the loaded geometry — never more, never derived, never present without
  a scenario.
- `ProjectMap.test.tsx` (13) — the same invariants asserted against the actual
  MapLibre layer filters, with the library faked, so the *rendering* path is
  proven, not just the logic, including that a highlighted feature is still
  present in its candidate layer's filter (additive, not a replacement).
- `map/page.test.tsx` (14) — modes, the no-scenario and wrong-city banners,
  the click card's name/phase/cost/evidence/source, and that an empty
  scenario portfolio highlights nothing rather than guessing.

Live-verified in the browser against the running backend, in both dev and a
production build: all four modes (Baseline visibly empty; Selected Legacy and
Temporary Operations each drawing 9 of the scenario's projects; All
Possibilities drawing all 24), the scenario surviving client-side navigation
from the optimizer, and a click card on `nynj-station-PERM`.

## 3D perspective view

A **Flat / 3D perspective** toggle on the map page, separate from the four
display modes. Both views honour all four modes identically: the toggle
changes how a project is drawn, never which projects are drawn.

**One map, not two.** The first attempt mounted a second MapLibre instance
for the 3D view and swapped it in and out; a second WebGL context whose
viewport never settled made it unreliable, and repeated toggling degraded
both views. The shipped design keeps the single flat map and switches
perspective in place: `easeTo` tilts the camera (pitch 60, bearing −30,
zoom 15.3), a volume source and two `fill-extrusion` layers are added, and
the compass/pitch control appears. Leaving 3D reverses all of it and eases
the camera back to the flat framing. A plain flat mount does none of this,
so the flat view's behaviour and tests are untouched.

**Which projects extrude, and how tall** — nothing here is arbitrary
(`src/lib/map3d.ts`):

- A project extrudes only when its intervention's own `defaultGeometryType`
  is one of the bundle's two volumetric types: `polygon_extrusion` (hub,
  parkride, tnc) or `glb_model` (station, toc). `line_extrusion`,
  `point_model` and `animated_route` categories stay flat, as in the flat
  view — extruding a bus lane or a signal plan would depict nothing real.
- Height is each project's own `height_m` from the 3D Projects records,
  sitting on the ground. The spread is real and phase-dependent: station
  18 m permanent / 6 m temporary, toc 12 m / 4 m, hub 6 m / 3 m.
- The two volumetric categories stored as points (station, toc) get a
  rectangular footprint from their own `length_m`, `width_m` and
  `bearing_deg`.

**What it deliberately does not show.** Nothing is drawn above ground
level. The bundle has no elevation data — its only vertical-offset field,
`zOffsetM`, is 0.05 or 0.1 m on all 264 records, a draw-order nudge — and no
bridge, elevated-crossing or flyover category exists in the 12-category
library. This, along with the height source and extrusion rule, is disclosed
on the page itself in a block that mirrors the optimizer's `modelAssumptions`
(CLAUDE.md rule 8).

**Tests.** `map3d.test.ts` (20) covers the pure rules: which categories
extrude, footprint geometry, that a volume with no `height_m` is dropped
rather than guessed at, and the disclosure text. `ProjectMap.3d.test.tsx`
(17) mounts the real component flat, switches it to 3D, and proves the
extrusion layers honour every selection invariant the flat tests prove —
baseline empty, an unselected ID never extruded as selected, all four modes,
and the same selected-ID set as the flat view — plus that repeated toggling
neither duplicates nor leaks layers, sources or controls.
`ProjectMap.test.tsx` and `mapModes.test.ts` are unchanged.

Frontend: 106 passed (69 before this view, 37 new). Verified live: solid
extruded volumes with lit faces in all four modes, Baseline empty in 3D, and
Flat → 3D → Flat → 3D → Flat returning the camera and layer set exactly to
their flat state each time.
