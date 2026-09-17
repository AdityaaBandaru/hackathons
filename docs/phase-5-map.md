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

## 3D design studio and map refinements

Ported from the extended copy of the project (`world-cup-mobility-optimizer 2`)
and restyled onto the app's dark token system.

**`/studio`** — a Three.js design studio (`src/app/studio`,
`src/components/map/ProjectStudioScene.tsx`, `src/lib/{studio,projectModels}.ts`).
Every one of the 264 project records is buildable as a concept model whose
overall envelope is that record's own `lengthM × widthM × heightM`; the
architectural detail inside the envelope (canopies, glazing, markings) is
illustrative and disclosed as such on the page. Corridors longer than 80 m
show a labeled 80 m section with the full length kept in metadata. The
studio honours the same four modes as the map through `studioProjects`,
which routes through `resolveMapSelection`: Baseline shows nothing, and a
"Compare both" view can never resurrect an unselected counterpart. Orbit /
top / front cameras, an optional dimension envelope, auto-orbit, and GLB
export (with project ID, evidence class, source URL and dimensions in node
metadata). Two exported station assets live in `models/`.

**Map** — clicking a project now frames it (`easeTo`, zoom clamped to
12.8–17.5) and outlines it: a ring for point features, a line for the rest,
drawn from the volume source in 3D so it sits on the extrusion. The outline
exists only for a project the current mode draws, and the click card closes
the moment its project is hidden (switching to Baseline dismisses it — a
card must never claim a project the map is not showing). A "Reset view"
button returns to the Meadowlands framing for the current view. The OSM
raster source declares `maxzoom: 19` so close-ups scale the last real tile
rather than requesting z20 tiles that do not exist.

Frontend: 117 passed (10 new: `projectModels.test.ts` builds all 264 records
inside their envelopes and checks scenario permissions; `studio/page.test.tsx`
covers compare and Baseline; one new map page test for card dismissal).
Verified live: studio renders the station in permanent, temporary and
same-scale comparison; map fly-to, ring highlight, reset, and Baseline
dismissal.

## City-specific 3D site models

The updated `/map` has an eleven-city selector. All 24 candidate records for each city use their supplied geometry and two named planning anchors. `/map` and `/studio` share `buildProjectModel`; city profiles, anchor types, exact place names and design descriptions determine the illustrative station and hub variants. The site view places full-length corridors; the studio keeps its labelled 80 m detail view. The scene adds anchor analysis rings, a metre grid, north arrow, top/front/reset presets, anchor focus, click-to-focus, and labels with collision handling and leader lines.

`resolveMapSelection` remains the selection authority. An explicit city check prevents a mismatched scenario from selecting anything, even if it contains misleading IDs. Baseline has zero proposal models. The studio now includes all candidates and current optimizer picks regardless of the historic seed demonstration's `renderEnabled` flag; this follows this task's all-candidates/current-scenario requirements. Cards retain exact provenance and implementation-status fields.

The existing row-packing tests were deliberately replaced with geographic placement tests. The historical render-disabled test was replaced by stricter tests proving that seed funding flags cannot suppress a current scenario pick or invent a selection. No backend or reference data was edited.

### Validation and remaining checks

Before the workspace interruption: frontend lint clean, 106 frontend tests passed, production build passed; backend 142 tests passed with two dependency deprecation warnings. The source was subsequently restored from the original upload and the implementation reconstructed. The current restoration's frontend validation result is recorded below.

**Live browser verification is incomplete.** The browser/tool connection stalled before the requested eleven-city map and three-city studio tour could finish. No visual success is claimed. Browser interaction and appearance should still be inspected locally.

### Modelling assumptions

1. Overall model dimensions use the supplied project envelopes. Internal architecture is illustrative, not an approved or as-built design.
2. City recipes use the actual assigned anchor. The Los Angeles station-category record remains at SoFi south plaza; its K Line interchange is the hub record. No rail is invented at SoFi, Arlington, Arrowhead or Miami anchors that lack a supplied rail context.
3. Placement projects the unchanged pre-generated WGS84 geometry into local metres around the two-anchor centroid. Precision remains `planning_anchor ±25–100 m`, not surveyed.
4. Polygon assets conform to the supplied four-sided footprint. Full-length route surfaces follow the supplied LineStrings. These are conceptual alignments; they are not verified street or track alignments.
5. Bases sit at zero elevation. There is no terrain, surrounding building, stadium or surveyed surrounding road model. Illustrative station stairs and access details do not establish actual elevations or clearances.
6. Overlapping proposals remain at their recorded positions. Label decluttering moves or hides text only; the list exposes every proposal permitted by the active mode.
7. Anchor rings show `analysisRadiusM`, an aggregation area rather than a construction boundary.
8. One concept envelope represents each canonical project ID. Funded unit quantities do not create repeated buildings. Service-route geometry is a concept, not an observed vehicle movement or a new road.
9. Amber denotes temporary and blue denotes permanent. Candidates are translucent; selected styling derives only from the current optimizer scenario.
10. The same full envelope is used when a project is selected or merely a candidate. Geometry is not scaled according to funding.
11. Existing `models/` GLBs and preview images are preserved as prior exports. Export from the updated studio for the current city-specific assets.

### Logic fixes and accuracy follow-up

Included fixes: explicit scenario-city isolation, consistent studio selection badges, preservation of unknown allocation totals instead of converting missing amounts to zero, shared candidate materials without orphaned clones, cleanup of stale label elements, and a world-space active outline.

Improved visual specificity does **not** establish better predictive accuracy. The backend still uses engineering-assumption benefit coefficients. Attendance uniformly scales benefits, so stable portfolios under attendance changes are not evidence of realistic congestion response. Transit capacity and visitor transit usage multiply the same productivity term; separating supply from demand requires a network or queue model. Calibrate coefficients with measured queues, throughput, travel times and costs, then validate against held-out events before making accuracy claims.

The backend's `nextBest` helper ranks marginal benefit per cost without re-enforcing the full scenario constraints or including newly unlocked complementarities. Treat it as a heuristic, not a guaranteed feasible optimized recommendation. These backend assumptions were reviewed but not modified in this frontend task.

Restoration validation: `npm run lint` passed without lint warnings; `npm test` passed **106 tests across 9 files**; `npm run build` passed including TypeScript and all routes. Packaging verified the ZIP CRC and byte-for-byte preservation of **106 backend and reference files**. Browser verification remains incomplete.

### Follow-up after the city-specific update was brought in

Brought the updated frontend into the repository as-is, then:

- **Default framing.** The site model now opens focused on the anchor with the
  most projects (`flyTo`, immediate) instead of fitting the whole site; with
  3 km corridors in the bounds a full fit turned the station into a dot.
  "Reset view" still frames everything.
- **Candidates** in the site view are drawn at 66 % opacity (was 48 %).
- **Label stacks** are shallower (160 px close / 96 px far), so fewer labels
  pile over one anchor; the rest appear on hover, zoom, or in the list.
- **Model rework** for the categories that read weakest (all still inside
  their recorded envelopes — the 264-record test is unchanged and passes):
  signals (pole, controller cabinet, backplated head with visored lenses,
  pedestrian head, push button; the permanent variant adds a second head and
  detector), wayfinding (double-sided totem with header band, map panel,
  directional blades, pictogram tiles), park-and-ride (angled bays in rows,
  drive aisles, entry apron, shuttle kerb island, accessible bays), managed
  rideshare hub (lettered pickup bays along raised kerb islands, queue
  chevrons, waiting island with tactile edge), and the four corridor types,
  which previously looked identical: red bus lane with "bus only" blocks and
  separator kerb; blue service-route ribbon with chevrons and stop posts;
  green bikeway with hatched buffer and symbols; pedestrian corridor with
  paving joints, planters, crossings and a protective kerb; ADA route with a
  ribbed tactile guidance strip, stop pads and kerb ramps.
- **Live verification** completed for all 11 cities on `/map` (24 models
  each, both anchors, Baseline empty, no console errors) and for the reworked
  models in `/studio`.

### Labels: anchors first, projects on demand

Twenty-four callouts walling both margins of the site view read worse than no
label. The site model now labels **only the planning anchors** (name, project
count, selected count, "click to focus"), plus whatever is **selected, active
or hovered**. A plain candidate's label appears only when the camera is close
enough for it to sit on its own model without colliding; margin callouts with
leader lines are reserved for the important labels. The project list beside
the scene is sectioned by planning anchor, each project's temporary and
permanent concepts adjacent with a phase dot, so every project is still one
click away without being drawn as text over the models.

### Spread-out arrangement (default) vs. as placed

The pre-generated corridor geometry radiates from each anchor point, so the
geographic arrangement piles a dozen projects onto one spot. The site model
now defaults to **Spread out**: each anchor's projects are row-packed into a
grid centred on that anchor's real local position (category order, temporary
left of permanent, corridors as the studio's 80 m section), and the two grids
are pushed apart along the line between the anchors if they would overlap.
A model's place inside a grid is for reading, not geography, and the
disclosure block says so. **As placed** keeps the previous geographic layout
behind a toggle. `layoutSiteSpread` is pure and tested for all 11 cities: 24
items each, no overlapping footprints, no overlapping anchor grids, every
model nearer its own anchor than the other.

### Map section removed

The `/map` site model (page, `ProjectGallery3D`, `gallery`, `siteLabels`,
`sitePlacement`, `siteModels`, `ProjectCard`) was removed at the user's
request. The 3D design studio at `/studio` remains the single 3D view; it
still honours the four modes through `studioProjects` → `resolveMapSelection`
(`mapModes.ts` is kept for that reason). Frontend: 52 tests, lint and build
clean.
