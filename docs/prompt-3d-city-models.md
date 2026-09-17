# Task: city-specific 3D infrastructure models and a per-city 3D site view

You are working in the repository `world-cup-mobility-optimizer` (Next.js 16 + React 19 + TypeScript + Tailwind 4 frontend in `frontend/`, FastAPI backend in `backend/`). Read `CLAUDE.md` first — its 18 rules are binding. Read `docs/phase-5-map.md` and `docs/completion-notes.md`-style notes in `docs/` for how the current views were built and verified.

## Goal

Upgrade the 3D modelling so that every one of the 11 host regions gets **its own, city-specific 3D site view**: the projects the optimizer can choose for that city, modelled as solid, recognisable infrastructure, placed relative to each other using the geometry that already exists in the repo, and labelled with the exact place each one is planned for. Today the models are generic per category and the `/map` page only covers New York/New Jersey. Make the modelling specific to each city's own records and make the site view work for all 11 cities. Do not build a general-purpose map; build a 3D site model per city.

## What already exists — use it, do not regenerate it

**Data (authoritative, do not re-derive or edit):**

- `backend/app/data/seed/projects3d.json` — 264 records, 24 per city (12 intervention categories × temporary/permanent). Type is `Project3D` in `frontend/src/lib/types.ts`. Every record has: `projectId` (canonical renderer ID, e.g. `nynj-station-PERM`), `cityId`, `hostRegion`, `category`, `categoryName`, `phase`, `areaId`, `exactAreaName` (the named place it is planned for), `latitude`/`longitude`, `analysisRadiusM`, `geometryType`, `lengthM`/`widthM`/`heightM`, `bearingDeg`, `colorHex`, `renderEnabled`, `designDescription`, `implementationStatus` (`concept_only` everywhere), `spatialPrecision` (`planning_anchor ±25–100 m` everywhere), `evidenceClass`, `sourceUrl`, `allocationCents`.
- The 12 categories and their geometry types: `station` (glb_model), `toc` integrated traffic operations (glb_model), `hub` shuttle hub (polygon_extrusion), `parkride` (polygon_extrusion), `tnc` rideshare hub (polygon_extrusion), `buslane` / `bike` / `ped` / `access` (line_extrusion), `service` extra transit service (animated_route), `signals` / `wayfinding` (point_model).
- Each city has exactly **two named planning anchors** (`exactAreaName`), e.g. NY/NJ: "Meadowlands Rail Station and aerial walkway" and "American Dream–MetLife protected corridor"; Atlanta: "Vine City Station–Northside Drive approach" and "GWCC/CNN Center–Andrew Young International Boulevard approach"; Boston: "Foxboro Station platform and stadium underpass" and "Patriot Place north plaza and Gate A"; LA: "Downtown Inglewood K Line shuttle interchange" and "SoFi south plaza at Pincay Drive and Prairie Avenue"; and so on for Dallas, Houston, Kansas City, Miami, Philadelphia, Seattle, SF Bay. Read them from the data.
- `backend/app/data/seed/pedestrianAreas.json` — the 22 anchors themselves (2 per city) with lat/lon, `analysisRadiusM`, `areaType`, design pedestrian volumes and evidence.
- `reference/geojson/projects_all.geojson` — **pre-generated geometry for all 264 projects in every city** (Point / LineString / Polygon in EPSG:4326, properties include `project_id`, `city_id`, `exact_area_name`, `geometry_type`, `length_m`, `width_m`, `bearing`). Also `projects_permanent.geojson`, `projects_temporary.geojson`, `pedestrian_areas.geojson`. This is the only positional information there is. Use it as-is for relative placement; do not regenerate it (CLAUDE.md rule: do not regenerate GeoJSON for v1).
- `backend/app/data/seed/cityProfiles.json`, `hostRegions.json`, `interventions.json` — per-city context (venue access type, dominant bottleneck, stadium, transit mode) you can use to make models city-specific.
- API: `GET /api/v1/cities/{cityId}/projects` returns that city's `Project3D[]`; `GET /api/v1/cities` lists the 11 cities. Only the optimizer (`POST /api/v1/optimize`) decides which project IDs are "selected".

**Code (extend, don't fork):**

- `frontend/src/lib/projectModels.ts` — `buildProjectModel(project): THREE.Group` builds a procedural Three.js model inside the record's `lengthM × widthM × heightM` envelope, one branch per category. This is the single model builder; `/studio` and `/map` both use it. `disposeObject` handles cleanup.
- `frontend/src/lib/studio.ts` — `studioDimensions` (corridors > 80 m are shown as an 80 m section with the full length kept), `studioProjects` (applies map-mode rules to the studio).
- `frontend/src/lib/gallery.ts` — `galleryProjects` (which projects appear and in what role) and `layoutGallery` (current row-packed floor layout). Pure and unit-tested in `gallery.test.ts`.
- `frontend/src/components/map/ProjectGallery3D.tsx` — the Three.js scene for `/map` (OrbitControls, CSS2D labels with name/phase/anchor, click-to-select with raycasting, fly-to, reset).
- `frontend/src/components/map/ProjectStudioScene.tsx` + `frontend/src/app/studio/` — the per-category studio with temporary/permanent comparison and GLB export.
- `frontend/src/lib/mapModes.ts` — `resolveMapSelection(mode, scenarioProjects, candidateIds)` is the **only** source of "selected" vs "candidate". Four modes: Baseline, Temporary Operations, Selected Legacy, All Possibilities.
- `frontend/src/app/map/page.tsx` — the page (currently hard-coded to `nynj`), `ModeSwitcher` (ARIA radio group with roving tabindex), `ProjectCard`, `DrawnInspector`.
- `frontend/src/lib/scenario.tsx` — `ScenarioProvider` holds the last optimizer result; it is the only thing the 3D views may treat as "selected".
- Tests: Vitest + Testing Library + msw. `frontend/src/test/fixtures.ts` and `server.ts` mock the API. `projectModels.test.ts` builds all 264 records and asserts each stays inside its envelope and keeps provenance. `map/page.test.tsx` stubs the scene and asserts the mode rules.
- Existing GLB assets: `models/nynj-station-TMP.glb`, `models/nynj-station-PERM.glb` (exported from the same builder).

## What to build

1. **City-specific models.** Make `buildProjectModel` produce recognisably different infrastructure per city, driven only by the record and the city context in the seed data — e.g. a rail-station package for Meadowlands (NJ Transit rail), a K-Line/light-rail interchange for Inglewood, a commuter-rail platform for Foxboro, a plaza/bus-zone hub for Arrowhead, a VTA light-rail platform queue for Santa Clara. Use `exactAreaName`, `areaType`, `cityProfiles` venue-access / transit-mode fields and `designDescription` to pick variants. Keep every model inside its record's `lengthM × widthM × heightM` — the existing test enforces this for all 264 records and must keep passing. Add richer detail (platform canopies, stairs, escalators, shelters, signal masts, lane markings, kerbs, bollards, wayfinding totems, shuttle bays, parking rows) as procedural geometry; keep materials simple (MeshStandardMaterial, no external textures, no network fetches). Phase colouring stays: amber = temporary, blue = permanent.

2. **Per-city 3D site view on `/map`.** Add a host-region selector (like `/optimize` and `/studio` have) and render that city's projects placed by their **real relative positions from `reference/geojson/projects_all.geojson`** (project the WGS84 coordinates to local metres around the city's anchor centroid; LineStrings and Polygons should follow their actual shapes and bearings, Points sit where recorded). Show the two named anchors as labelled ground markers with their `analysisRadiusM` as a faint ring. No basemap tiles, no satellite imagery, no paid or keyed services — a clean dark studio floor with a metre grid and a north arrow is right. Give it a "site model" feel: subtle ground plane, shadows, fog, orbit/zoom/pan, top/front/reset camera presets, click a model or label for its `ProjectCard`.

3. **Labels.** Every model shows its `categoryName` and, on hover/active, phase + `exactAreaName` + full length if it is a shortened corridor. Labels must stay legible when all 24 are visible; decluster or hide the least important labels when zoomed out and restore them when zoomed in.

4. **Keep the four modes and their invariants exactly.** Baseline draws nothing. Temporary Operations / Selected Legacy draw only the IDs the current optimizer scenario returned for that phase. All Possibilities draws every candidate translucently and additionally highlights the scenario's own picks. A scenario for a different city selects nothing in this city's view (show the existing banner). Never invent a selected object; never derive selection from anything but `resolveMapSelection`.

5. **Honesty (CLAUDE.md rule 8).** Keep a visible "How these models are drawn — and what they leave out" disclosure (`GALLERY_ASSUMPTIONS` in `gallery.ts`) and update it to say: overall envelopes are the records' own dimensions; architectural detail is illustrative; positions are the pre-generated planning-anchor geometry at `planning_anchor ±25–100 m` precision, not surveyed; no terrain, elevation, surrounding buildings or the stadium are represented. Every card must still show the `evidenceClass`, `sourceUrl`, `implementationStatus` and `spatialPrecision` verbatim.

## Hard constraints

- Do not delete or edit anything under `reference/` or `backend/app/data/seed/`. Do not regenerate GeoJSON.
- No paid APIs, no API keys, no map tile services, no Docker, no auth. Dependencies must be free and open source; `three` (^0.186) is already installed — do not add a second 3D engine.
- Money stays integer cents. Never convert a missing value to zero.
- `projectId` is the canonical renderer ID. The optimizer returns project IDs; the frontend must not invent selected objects.
- Keep the repo runnable after every step. Keep the design language (dark theme, tokens in `frontend/src/app/globals.css`; use the existing `.btn`, `.segmented`, `.card`, `.panel-note` classes).
- Add tests with each feature, not at the end: extend `projectModels.test.ts` (all 264 still inside their envelopes; city variants produce different geometry for at least the station/hub categories), add a pure test for the WGS84→local-metres placement (relative distances between two known anchors match the haversine distance within 1%), and extend `map/page.test.tsx` for the city selector and for "a scenario for another city selects nothing here".

## Definition of done

- `cd frontend && npm run lint && npm test && npm run build` all clean (currently 80 tests pass; count must go up, none removed except by deliberate replacement with a stricter test).
- `cd backend && ./.venv/bin/python -m pytest` still 142 passed (you should not need to touch the backend).
- Open `/map`, switch through all 11 cities: each shows its own 24 models at their recorded relative positions with both anchors labelled; Baseline is empty in every city; after running the optimizer for a city, Selected Legacy shows only that run's permanent picks.
- Open `/studio` for at least three cities and confirm the same builder gives city-specific station/hub models with the same dimensions as before.
- Append a section to `docs/phase-5-map.md` describing what was built, what was verified live, and every modelling assumption in one list.

Report anything you could not do rather than approximating it.
