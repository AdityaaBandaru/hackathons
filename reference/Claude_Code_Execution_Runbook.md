# Claude Code Execution Runbook

## World Cup 2026 Host-City Mobility Investment and 3D Legacy Optimizer

This runbook explains how to turn the existing research, workbook, optimizer results, and master build specification into a working application with Claude Code.

The correct strategy is to give Claude the complete specification once, then ask it to implement one testable phase at a time. Do not ask it to build the entire project in one message.

---

## 1. Existing project assets

Provide Claude Code with these files:

1. `World_Cup_2026_Mobility_Optimizer_AI_Build_Spec.md`
   - The authoritative product requirements and acceptance criteria.
2. `World_Cup_2026_Spatial_Mobility_Dataset.xlsx`
   - The current spatial, funding, comparable-event, ML, and 3D data contract.
3. `World_Cup_2026_Showcase_Data.xlsx`
   - The more detailed research/evidence workbook.
4. `model_run.py`
   - The existing demonstration optimizer.
5. `model_results.json`
   - Reference results from the demonstration optimizer.
6. `world_cup_mobility.csv`
   - The 768-row numeric ML dataset.

The spatial workbook contains:

- 22 named pedestrian analysis areas;
- 143 host-region/category funding records;
- 21 current World Cup 2026 evidence records;
- 14 NFL, concert, and stadium-event analog records;
- 264 temporary/permanent 3D phase records;
- 768 numeric ML scenarios;
- intervention, codebook, source, and QA sheets.

The official U.S. host-region FTA funding control total is `$100,250,212`.

The default demonstration allocation is:

- Temporary: `$44,128,000`
- Permanent: `$55,552,000`
- Unassigned reserve: `$570,212`

These three values sum exactly to the official control total.

---

## 2. What the finished application must do

The final product must let a user:

1. Compare all 11 U.S. host regions.
2. Inspect observed 2026 mobility evidence and its sources.
3. Select a city and budget.
4. Change weights for travel time, congestion, emissions, accessibility, reliability, and permanent legacy.
5. Apply policy constraints.
6. Run a real mixed-integer optimizer through a backend API.
7. See selected interventions, quantities, costs, modeled benefits, and selection explanations.
8. Run sensitivity scenarios.
9. Open a geospatial 3D scene.
10. Toggle baseline, temporary event operations, and permanent legacy improvements.
11. See only the 3D projects returned by the selected optimizer scenario.
12. Trace each number and 3D object to its evidence class and source.

The first polished vertical slice must be New York/New Jersey and the Meadowlands complex. All 11 regions still appear in the comparison and optimizer data model.

---

## 3. Recommended tools

### Required development tools

| Tool | Purpose |
|---|---|
| Claude Code | Main coding agent operating inside the repository |
| VS Code | Editing, diffs, terminal, debugging, and extension integration |
| Git and GitHub | Version control, checkpoints, issues, and deployment integration |
| Docker Desktop | Runs the frontend, backend, and PostGIS database consistently |
| Node.js LTS | Runs Next.js and frontend tooling |
| pnpm | JavaScript package manager and lockfile |
| Python 3.12+ | FastAPI, optimization, ingestion, testing, and geospatial processing |
| uv | Python environment and dependency management |
| PostgreSQL + PostGIS | Production data and spatial queries; run through Docker |

### Application libraries

| Area | Recommended technology |
|---|---|
| Frontend | Next.js, TypeScript, App Router |
| Styling | Tailwind CSS |
| Accessible UI primitives | Radix UI or shadcn/ui components |
| Server data | TanStack Query |
| Local scenario state | Zustand only for cross-page scenario state |
| Charts | Apache ECharts |
| Map | MapLibre GL JS |
| 3D integration | Three.js through a MapLibre custom layer |
| Animated movement | deck.gl `TripsLayer`, after static layers work |
| Backend | FastAPI and Pydantic |
| Optimization | `scipy.optimize.milp` using HiGHS |
| Data import | pandas and openpyxl |
| Spatial processing | GeoPandas, Shapely, and PyProj |
| Database | SQLAlchemy, Alembic, PostgreSQL, and PostGIS |
| Backend tests | Pytest |
| Frontend tests | Vitest and React Testing Library |
| Browser tests | Playwright |

### Optional finishing tools

| Tool | Use it for |
|---|---|
| QGIS | Inspecting and manually correcting GeoJSON corridors and polygons |
| Blender | One low-poly mobility-hub GLB and possibly one station asset |
| DBeaver | Inspecting PostgreSQL/PostGIS tables |
| Bruno or Postman | Manually testing API requests |
| GitHub Actions | Automated linting and tests on every push |

Do not require a paid map or data API for the basic demonstration.

---

## 4. Windows setup

The easiest reliable Windows workflow is:

1. Install Git for Windows.
2. Install VS Code.
3. Install Docker Desktop.
4. Install Node.js LTS.
5. Install Python 3.12 or newer.
6. Install Claude Code.

Official Claude Code PowerShell installation:

```powershell
irm https://claude.ai/install.ps1 | iex
```

Verify the tools:

```powershell
git --version
node --version
npm --version
python --version
docker --version
docker compose version
claude --version
```

Enable pnpm and install uv:

```powershell
corepack enable
corepack prepare pnpm@latest --activate
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

If Docker, Python geospatial libraries, or shell behavior becomes unreliable on native Windows, use WSL2 with Ubuntu and enable Docker Desktop's WSL integration.

---

## 5. Create the repository

Create a folder and place all existing project assets in `reference/` before starting Claude:

```powershell
mkdir world-cup-mobility-optimizer
cd world-cup-mobility-optimizer
git init
mkdir reference
```

Recommended initial layout:

```text
world-cup-mobility-optimizer/
├── CLAUDE.md
├── README.md
├── docker-compose.yml
├── .env.example
├── reference/
│   ├── World_Cup_2026_Mobility_Optimizer_AI_Build_Spec.md
│   ├── World_Cup_2026_Spatial_Mobility_Dataset.xlsx
│   ├── World_Cup_2026_Showcase_Data.xlsx
│   ├── model_run.py
│   ├── model_results.json
│   └── world_cup_mobility.csv
├── data/
│   ├── raw/
│   ├── processed/
│   ├── seed/
│   └── geojson/
├── backend/
├── frontend/
├── tests/
└── docs/
```

Start Claude Code only after the files are inside the repository:

```powershell
claude
```

---

## 6. Root `CLAUDE.md` instructions

Ask Claude to create this file at the repository root during Phase 1:

```markdown
# Project Instructions

Build the World Cup 2026 Host-City Mobility Investment and 3D Legacy Optimizer.

The authoritative requirements are in:
`reference/World_Cup_2026_Mobility_Optimizer_AI_Build_Spec.md`.

The authoritative seed workbook is:
`reference/World_Cup_2026_Spatial_Mobility_Dataset.xlsx`.

Rules:

1. Keep the repository runnable after every phase.
2. Implement only the requested phase before expanding scope.
3. Run relevant tests and report their output before claiming completion.
4. Store money as integer cents in application code and the database.
5. Assert that the 11 official allocations total exactly 10,025,021,200 cents.
6. Never convert missing values to zero.
7. Preserve evidence class, qualifier, methodology note, and source URL.
8. Never present engineering assumptions or model outputs as observed facts.
9. Treat workbook planning coordinates as conceptual anchors, not surveyed locations.
10. Treat `3D Projects.project_id` as the canonical renderer identifier.
11. The optimizer returns project IDs; the frontend must not invent selected objects.
12. Baseline mode hides every modeled proposal.
13. Selected Legacy mode renders only IDs returned by the current scenario.
14. Do not add paid API requirements.
15. Do not build authentication, payments, or a photorealistic city twin in version 1.
16. Prefer static GeoJSON and procedural geometry before custom Blender assets.
17. Add tests with each feature instead of postponing all tests.
18. Do not delete reference files or overwrite raw evidence.
```

---

## 7. Canonical identifier decision

The original master specification includes descriptive Meadowlands IDs such as:

- `nynj-ped-corridor-01`
- `nynj-tnc-hub-01`
- `nynj-bus-priority-01`
- `nynj-station-capacity-01`
- `nynj-toc-01`
- `nynj-access-01`

The newer spatial workbook contains phase-specific canonical IDs such as:

- `nynj-ped-TMP`
- `nynj-ped-PERM`
- `nynj-tnc-TMP`
- `nynj-tnc-PERM`

Use the workbook IDs as the canonical runtime IDs. Preserve the original descriptive IDs only as aliases:

```json
{
  "nynj-ped-corridor-01": "nynj-ped-PERM",
  "nynj-tnc-hub-01": "nynj-tnc-PERM",
  "nynj-bus-priority-01": "nynj-buslane-PERM",
  "nynj-station-capacity-01": "nynj-station-PERM",
  "nynj-toc-01": "nynj-toc-PERM",
  "nynj-access-01": "nynj-access-PERM"
}
```

The renderer, API, database, and tests should use the canonical workbook IDs. This prevents the 3D scene and optimizer from silently using different identifiers.

---

## 8. Master bootstrap prompt for Claude Code

Paste this as the first request inside the repository:

```text
Read reference/World_Cup_2026_Mobility_Optimizer_AI_Build_Spec.md completely.
Inspect every sheet and header in reference/World_Cup_2026_Spatial_Mobility_Dataset.xlsx.
Inspect reference/model_run.py and reference/model_results.json.

This is an implementation task, but work in bounded phases. For this turn, implement Phase 1 only: repository foundation and deterministic workbook-to-seed ingestion.

Requirements for this phase:
1. Create the monorepo structure, root CLAUDE.md, README, .env.example, and Docker Compose.
2. Scaffold a Next.js TypeScript App Router frontend and FastAPI backend.
3. Add PostgreSQL/PostGIS configuration with a local seed fallback.
4. Add GET /health.
5. Write a deterministic Python ingestion command that converts the workbook sheets into normalized JSON seed files without changing nulls to zero.
6. Store money as integer cents.
7. Validate unique IDs, required provenance fields, and the exact FTA total of 10,025,021,200 cents.
8. Treat 3D Projects.project_id as canonical and create the documented NY/NJ legacy alias map.
9. Add Pytest tests for ingestion and funding reconciliation.
10. Do not implement the optimizer, dashboard, or 3D scene yet.

Before editing, give a concise file-level plan. Then implement it. Run all Phase 1 tests and report exact commands, output, files changed, and remaining blockers. Do not use fabricated replacement data.
```

Do not move to Phase 2 until the health endpoint works and the seed tests pass.

Commit the result:

```powershell
git add .
git commit -m "phase 1: scaffold app and ingest verified seed data"
```

---

## 9. Phase 1 acceptance gate

Claude must demonstrate all of the following:

- `docker compose up --build` starts successfully.
- Frontend opens locally.
- `GET /health` returns a successful JSON response.
- The ingestion script produces deterministic JSON.
- There are 11 host regions.
- There are 22 pedestrian areas.
- There are 143 funding rows.
- There are 264 3D phase records.
- There are 14 analog-event records.
- There are 768 ML rows.
- Official funding equals exactly `10,025,021,200` cents.
- Missing source data stay `null`.
- No duplicate stable IDs exist.

---

## 10. Phase 2 prompt: evidence API

```text
Implement Phase 2 only: the evidence database and read APIs.

Use the normalized seeds produced in Phase 1. Add SQLAlchemy/PostGIS models, Alembic migrations, Pydantic response schemas, and deterministic seed loading for sources, host regions, funding, observations, pedestrian areas, analog events, interventions, and 3D projects.

Implement:
GET /api/v1/cities
GET /api/v1/cities/{city_id}
GET /api/v1/cities/{city_id}/evidence
GET /api/v1/cities/{city_id}/projects
GET /api/v1/interventions
GET /api/v1/sources
GET /api/v1/methodology

Every numerical response must preserve evidenceClass, source IDs, qualifier, unit, and methodology note where applicable. Missing data must remain null. Add API and database tests. Do not implement the optimizer or 3D renderer in this phase.
```

Phase 2 is complete when the API returns the New York/New Jersey final-match facts:

- 80,663 ticket holders
- 16,200 Uber trips/count entries reported for the row
- 11,168 Host Committee shuttle count
- 21,024 NJ Transit egress passengers
- 60-minute NJ Transit egress
- 65,000 American Dream pedestrians

These are evidence records, not optimizer outputs.

---

## 11. Phase 3 prompt: real optimizer

```text
Implement Phase 3 only: the mixed-integer portfolio optimizer and its tests.

Refactor useful logic from reference/model_run.py. Use scipy.optimize.milp with binary marginal segments, diminishing returns, budget constraints, segment precedence, required/excluded interventions, accessibility-share constraints, temporary/permanent spending constraints, major-construction limits, and selected synergy variables.

Use integer cents at every application boundary. Normalize nonnegative weights server-side. Identical requests must return identical ordered results.

Implement:
POST /api/v1/optimize
POST /api/v1/optimize/sensitivity
GET /api/v1/scenarios/{scenario_id}

The response must include selected intervention quantities, current-scenario phase costs, mapped canonical project IDs, total impacts, objective contributions, assumptions used, source IDs, warnings, binding constraints, near-miss alternatives, and a structured infeasibility explanation.

Do not copy the workbook's default allocation as the answer to every request. The workbook allocation is a seed/reference scenario. Recalculate results from the request weights, constraints, budget, intervention costs, and city multipliers.

Add tests for exact funding, budget feasibility, deterministic output, precedence, required/excluded projects, conflicting constraints, phase shares, sensitivity runs, and mapped project IDs.
```

Critical optimizer rule:

```text
scenario.selectedProjectIds
        = the only proposal IDs eligible to appear in Selected Legacy mode
```

---

## 12. Example optimization request

Use this request as the first backend integration test:

```json
{
  "cityId": "nynj",
  "budgetCents": 1043868100,
  "weights": {
    "travelTime": 0.25,
    "vehicleCongestion": 0.15,
    "emissions": 0.12,
    "accessibility": 0.20,
    "reliability": 0.15,
    "permanentLegacy": 0.13
  },
  "constraints": {
    "minimumAccessibilityShare": 0.10,
    "maximumTemporaryShare": 0.55,
    "minimumPermanentShare": 0.35,
    "maximumMajorConstructionProjects": 4,
    "requiredInterventionIds": [],
    "excludedInterventionIds": []
  },
  "assumptionsOverride": {}
}
```

Required assertions:

- `spentCents <= 1043868100`
- `remainingCents = budgetCents - spentCents`
- `solverStatus` is explicit
- every selected project ID resolves to one `3D Projects` record
- every selected number includes its evidence/model classification

---

## 13. Phase 4 prompt: usable dashboard

```text
Implement Phase 4 only: a polished frontend connected to the real API.

Build:
1. Landing page
2. All-host comparison page
3. City evidence page
4. Optimizer page
5. Sensitivity panel

Use Next.js, TypeScript, Tailwind, accessible components, TanStack Query, and ECharts. The Run Optimization button must call FastAPI. Do not generate optimization results in the browser.

Use a civic-technology visual system: deep navy, off-white, teal for permanent work, amber for temporary work/assumptions, blue for observed flows, purple for model output, and red only for errors.

Every important number must show evidence class, unit, qualifier, and source access. Include loading, error, empty, and infeasible states. Add frontend tests for all 11 regions, preset changes, API-backed optimization results, evidence badges, and source links.

Do not implement the full 3D scene yet. A placeholder route may show a clear '3D scene arrives in Phase 5' state.
```

---

## 14. Phase 5 prompt: MapLibre 2.5D scene

```text
Implement Phase 5 only: the New York/New Jersey geospatial baseline and static proposal layers.

Use MapLibre GL JS. Center the scene on the Meadowlands complex and load the map only on the client. Add existing context, 3D building extrusions where supported, named camera presets, and GeoJSON proposal layers generated from canonical 3D project records.

Modes:
- Baseline 2026: no modeled proposals
- Temporary Operations: selected TMP project IDs only
- Selected Legacy: selected PERM project IDs only
- All Possibilities: every candidate shown translucently

The current optimizer scenario is the only source of selected IDs. Changing modes must not recreate the map.

Start with simple GeoJSON lines, polygons, circles, symbols, and extrusions. Use amber with approximately 0.55 opacity for temporary work and teal/blue with approximately 0.85 opacity for permanent work. Show the conceptual-coordinate warning.

Add click cards with project name, category, phase, cost, evidence basis, source links, and spatial precision. Add a non-WebGL table fallback. Test layer filtering and baseline hiding.
```

Do not use Blender yet. First prove that data, optimizer output, map layers, and project IDs are connected.

---

## 15. Turning anchor records into initial GeoJSON

The workbook stores anchors and conceptual dimensions. Generate first-pass geometry reproducibly:

1. Read latitude, longitude, bearing, length, and width from `3D Projects`.
2. Transform the WGS84 point to a suitable local projected coordinate system.
3. Create a centered line following the bearing for line interventions.
4. Buffer the line by half the width.
5. Create oriented rectangles for hubs, parking, TNC zones, stations, and operations centers.
6. Transform the result back to WGS84.
7. Save the geometry with the canonical `project_id` and phase properties.
8. Label it `conceptual_design`.

Use Shapely and PyProj for generation. Inspect the output in QGIS. Manually adjust only the New York/New Jersey hero geometry when necessary, and preserve the generation source plus the edited final GeoJSON separately.

Required GeoJSON properties:

```json
{
  "project_id": "nynj-ped-PERM",
  "city_id": "nynj",
  "category": "ped",
  "phase": "permanent",
  "implementation_status": "concept_only",
  "spatial_precision": "planning_anchor ±25–100 m",
  "color": "#0F766E",
  "opacity": 0.85,
  "height_m": 0.15,
  "evidence_class": "engineering_assumption"
}
```

---

## 16. Phase 6 prompt: actual 3D objects

```text
Implement Phase 6 only: Three.js objects and the hero mobility-hub asset.

Integrate Three.js through a MapLibre custom 3D layer. Position models with MercatorCoordinate.fromLngLat and meterInMercatorCoordinateUnits. Persist longitude, latitude, altitude, rotations, and scale; do not eyeball transforms without saving them.

First create a procedural low-poly mobility hub from Three.js boxes, planes, cylinders, signs, shelters, loading bays, accessible bays, and route arrows. Only replace it with a Blender-exported GLB if the procedural version works and the replacement materially improves the presentation.

If using Blender:
- work in meters;
- apply transforms;
- place origin at the map anchor;
- keep the model low-poly;
- use a few simple PBR materials;
- export binary GLB;
- target under 3 MB per asset;
- do not use proprietary photogrammetry.

Add camera presets for Stadium Overview, Meadowlands Station, Pedestrian Corridor, Mobility Hub, and Post-Match Egress. Clicking an object must open the same project details used by the 2D proposal layer.

Add tests proving that an unselected GLB is not added to the scene and baseline mode removes all proposal objects.
```

---

## 17. Phase 7 prompt: animation, accessibility, and performance

```text
Implement Phase 7 only: illustrative movement, accessibility, performance, and final end-to-end testing.

After static rendering is stable, add limited deck.gl TripsLayer or equivalent animation for selected service, bus, shuttle, rideshare, or pedestrian-flow records. Label all motion illustrative_flow rather than simulation.

Respect prefers-reduced-motion and provide static directional markers. Lazy-load map and 3D modules, limit animated paths, add WebGL error fallback, optimize GLB/GeoJSON size, and keep the interface usable on a normal laptop.

Add a Playwright test that:
1. opens New York/New Jersey;
2. selects Permanent Legacy;
3. runs the optimizer;
4. verifies spending is within $10,438,681;
5. opens the 3D view;
6. switches from baseline to selected legacy;
7. verifies at least one selected canonical project appears;
8. clicks it;
9. verifies cost, evidence classification, and conceptual-design warning.

Run backend, frontend, and end-to-end test suites. Fix failures before reporting completion.
```

---

## 18. Where the ML dataset fits

Do not make the synthetic 768-row ML dataset the main analytical engine. The constrained optimizer is the core decision engine.

Use the ML dataset later for one optional feature:

```text
Predict mobility-pressure probability for a hypothetical match scenario.
```

Possible endpoint:

```text
POST /api/v1/predict-pressure
```

Input fields can include stadium capacity, ticket holders, transit passengers, pedestrian volume, egress minutes, funding, stage, and spatial area code.

Rules:

- identify the dataset as synthetic/demo data;
- report validation metrics and class balance;
- do not present the prediction as causal;
- do not let the prediction overwrite observed 2026 evidence;
- keep it separate from the MILP objective unless a documented calibration method is added.

Implement this only after the optimizer-to-3D vertical slice works.

---

## 19. Daily build sequence

### Day 1 — Foundation and ingestion

- Install tools.
- Create repository.
- Run the Phase 1 prompt.
- Verify exact counts and funding reconciliation.

### Day 2 — Evidence database and API

- Run Phase 2.
- Inspect the New York/New Jersey evidence response.
- Verify sources and null handling.

### Day 3 — Optimizer

- Run Phase 3.
- Test balanced, accessibility, and permanent-legacy presets.
- Force one infeasible request and verify the explanation.

### Day 4 — Dashboard

- Run Phase 4.
- Complete the comparison, evidence, optimizer, and sensitivity workflow.

### Day 5 — Geospatial scene

- Run Phase 5.
- Verify baseline, temporary, permanent, and all-possibilities modes.
- Inspect New York/New Jersey geometry in QGIS if needed.

### Day 6 — 3D hero assets

- Run Phase 6.
- Finish the procedural or Blender mobility hub.
- Add camera presets and click cards.

### Day 7 — Polish and demo

- Run Phase 7.
- Fix accessibility, performance, and end-to-end failures.
- Record a short demonstration.

If the deadline is shorter, omit custom Blender work and animation. Do not omit the optimizer, evidence labels, project-ID filtering, or tests.

---

## 20. Commands Claude should make available

The final repository should support commands similar to:

```powershell
docker compose up --build
docker compose down
```

Backend:

```powershell
cd backend
uv sync
uv run alembic upgrade head
uv run python -m app.ingestion.import_workbook
uv run uvicorn app.main:app --reload
uv run pytest -q
uv run ruff check .
uv run mypy app
```

Frontend:

```powershell
cd frontend
pnpm install
pnpm dev
pnpm lint
pnpm test
pnpm build
pnpm exec playwright test
```

The exact script names may differ, but the README must provide one reliable command for each operation.

---

## 21. How to control Claude Code effectively

For every phase:

1. Ask for a concise file-level plan.
2. Let Claude inspect the relevant code and reference files.
3. Tell it to implement only that phase.
4. Require tests and exact command output.
5. Review the diff.
6. Run the application yourself.
7. Commit only after the phase passes.

Useful follow-up prompts:

```text
Run the relevant tests now. Do not summarize expected results; show the actual failures and fix them.
```

```text
Review the current diff against the acceptance criteria for this phase. List any unmet requirement with its file path, then fix it.
```

```text
Trace this displayed value from the frontend component through the API, database record, evidence class, and original source URL. Fix any provenance break.
```

```text
Show the exact optimizer response project IDs and the exact MapLibre/Three.js filtering code. Add a test proving an unselected ID cannot render.
```

```text
Use the browser test to complete the New York/New Jersey critical path. Fix the first failure, rerun, and continue until it passes.
```

Avoid vague requests such as “make everything better.” Name the page, behavior, failed test, or acceptance criterion.

---

## 22. Git checkpoint plan

Create one commit after each passing phase:

```text
phase 1: scaffold app and ingest verified seed data
phase 2: add evidence database and read APIs
phase 3: implement deterministic mobility portfolio optimizer
phase 4: connect dashboard to evidence and optimizer APIs
phase 5: add optimizer-controlled Meadowlands map layers
phase 6: add geospatial Three.js legacy objects
phase 7: add accessible animation and end-to-end validation
```

If Claude breaks a later phase, return to the last good commit rather than asking it to repair an unknown number of unrelated changes.

---

## 23. Final definition of done

Do not call the project finished until:

- all 11 host regions appear;
- official funding reconciles exactly;
- New York/New Jersey evidence is visible and sourced;
- the optimizer runs on the backend;
- no solution exceeds its budget;
- infeasible constraints receive a real explanation;
- temporary and permanent costs are distinguishable;
- 3D projects use canonical IDs;
- baseline hides all proposals;
- selected mode shows only optimizer-selected proposals;
- every proposal is labeled conceptual;
- sensitivity analysis works;
- reduced-motion and non-WebGL alternatives exist;
- backend, frontend, data, and end-to-end tests pass;
- the README contains setup, architecture, sources, assumptions, and limitations;
- the app can be demonstrated from a clean clone.

---

## 24. Most important scope rule

The strongest version of this project is not the one with the most realistic stadium model. It is the version where this chain works without breaking:

```text
verified evidence
  -> transparent assumptions
  -> constrained optimizer
  -> selected canonical project IDs
  -> funding and impact explanation
  -> temporary/permanent geospatial rendering
```

Build that chain first. Custom models and animation are final presentation layers.

