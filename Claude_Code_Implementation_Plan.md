# Implementation Plan — World Cup 2026 Mobility Optimizer
### Scoped for an 11-day window (Sept 6 → Sept 17 submission)

This plan is built on top of the verified `World_Cup_2026_Hackathon_Data_Bundle.zip` — every count and source in it was independently checked. Two things in the bundle let you skip work the original runbook assumed you'd still have to do:

1. **The JSON in `json/` is already normalized and validated.** You do not need to write an xlsx-parsing ingestion pipeline. Load the JSON files directly as your seed data.
2. **The GeoJSON in `geojson/` is already generated.** You do not need the Shapely/PyProj geometry-generation step (Runbook §15) for your first working map. Use `geojson/nynj_projects.geojson` as-is.

Skipping those two steps alone probably saves 1.5–2 days versus following the original runbook literally.

---

## 0. One fix before you start

The bundle's build spec is named `Research_and_Modeling_Task.md`, not `World_Cup_2026_Mobility_Optimizer_AI_Build_Spec.md` as the runbook's `CLAUDE.md` template expects. Either rename the file or edit that one line in `CLAUDE.md`. Do this before your first prompt — otherwise Claude Code will fail to find the spec.

---

## 1. Model choice

Use Claude Code's model picker (`/model` inside the CLI, or the `--model` flag) — check what's currently listed as the top-tier "Opus"-class model versus the standard "Sonnet"-class model at the time you run this, since naming/availability can change.

- **Use the top-tier model for Phases 1, 3, and 5** — these are the phases where a subtle mistake cascades: the seed/schema design (Phase 1), the actual optimizer math (Phase 3), and the geospatial rendering logic (Phase 5). Get these right the first time; debugging a wrong MILP formulation on day 9 is expensive.
- **Use the standard mid-tier model for Phases 2, 4, and polish/tests** — these are more mechanical (CRUD endpoints, wiring a frontend to an API, writing repetitive tests) and don't need the most expensive reasoning for every token.
- If your team has limited usage budget, it's better to spend it concentrated on Phases 1 and 3 than spread thin evenly across all seven.

---

## 2. Scope cuts from the original runbook (do these deliberately, not by accident)

Given 11 days total — which also has to cover testing, a pitch deck, and a demo video — build this, in order of priority:

**Must ship (this is what actually gets judged on Data Analytics, Impact, Feasibility):**
- Phase 1: seed loading + validation
- Phase 2: evidence API
- Phase 3: real optimizer
- Phase 4: working dashboard

**Should ship if Phase 1–4 finish on schedule:**
- Phase 5, simplified: a MapLibre map using the *already-generated* GeoJSON, with baseline/temporary/permanent/all-possibilities toggle modes and click cards. No Three.js custom layer, no Blender asset yet.

**Cut unless you finish everything above with 2+ days to spare:**
- Phase 6 (Three.js hero asset, Blender model) and Phase 7 (deck.gl animation) — these are the most time-expensive, least judging-relevant parts. The runbook itself says to drop these first if short on time; at 11 days total, assume you're short on time.

**Also cut: Docker + PostgreSQL/PostGIS, at least for v1.** Your entire dataset is small (264 3D records, 22 pedestrian areas, 768 ML rows) — there is no query-performance reason to stand up a spatial database for a hackathon demo. Load the JSON into memory in FastAPI at startup instead. This removes an entire category of setup failure (Docker networking, migration errors, connection strings) that has nothing to do with your actual judging criteria. Add Postgres later only if you have time left over, as a "production-readiness" talking point in your pitch, not a demo requirement.

Reserve **September 15–17 for the pitch, demo video, and rehearsal — not coding.** Stop writing new features by end of day the 14th.

---

## 3. Day-by-day sequence

| Day | Date | Work |
|---|---|---|
| 1 | Sep 6 | Setup + Phase 1 |
| 2 | Sep 7 | Phase 2 |
| 3–4 | Sep 8–9 | Phase 3 (optimizer) — the hardest phase, budget two days |
| 5–6 | Sep 10–11 | Phase 4 (dashboard) |
| 7–8 | Sep 12–13 | Phase 5, simplified (static map) |
| 9 | Sep 14 | Bug fixes, accessibility basics, freeze features |
| 10 | Sep 15 | Record demo video, build pitch deck |
| 11 | Sep 16–17 | Rehearse, submit |

---

## 4. Setup (run once)

```powershell
mkdir world-cup-mobility-optimizer
cd world-cup-mobility-optimizer
git init
mkdir reference
# copy the ENTIRE unzipped bundle contents into reference/, including json/, csv/, geojson/, examples/, schemas/, types/
```

Rename `reference/Research_and_Modeling_Task.md` → keep its name, but update `CLAUDE.md` (below) to point at the real filename.

Start Claude Code:
```powershell
claude
```

---

## 5. Root `CLAUDE.md` (paste this as your first request, Phase 1)

```markdown
# Project Instructions

Build the World Cup 2026 Host-City Mobility Investment and Legacy Optimizer.

Authoritative requirements: reference/Research_and_Modeling_Task.md
Authoritative seed data: reference/json/*.json (already normalized and validated — do not re-derive from the xlsx workbooks)
Already-generated map geometry: reference/geojson/*.geojson (do not regenerate from scratch for v1)
Reference optimizer: reference/model_run.py and reference/model_results.json

Rules:
1. Keep the repository runnable after every phase.
2. Implement only the requested phase before expanding scope.
3. Run relevant tests and report their output before claiming completion.
4. Store money as integer cents in application code.
5. Assert the 11 official allocations total exactly 10,025,021,200 cents.
6. Never convert missing values to zero.
7. Preserve evidenceClass, qualifier, methodology note, and source URL on every record.
8. Never present engineering assumptions or model outputs as observed facts.
9. Treat GeoJSON coordinates as conceptual planning anchors, not surveyed locations.
10. Treat projectId (3D Projects) as the canonical renderer identifier.
11. The optimizer returns project IDs; the frontend must not invent selected objects.
12. Baseline mode hides every modeled proposal.
13. Selected Legacy mode renders only IDs returned by the current scenario.
14. Do not add paid API requirements.
15. Do not build authentication, payments, Docker, or PostgreSQL for v1 — load JSON seed data in memory.
16. Do not build a Three.js/Blender 3D scene or animation until Phases 1-5 are complete and tested.
17. Add tests with each feature instead of postponing all tests.
18. Do not delete reference files or overwrite raw evidence.
```

---

## 6. Phase prompts

### Phase 1 — foundation + seed loading

```text
Read reference/Research_and_Modeling_Task.md and reference/Claude_Code_Execution_Runbook.md completely.
Inspect every file in reference/json/ and reference/geojson/. Inspect reference/model_run.py and reference/model_results.json.

Implement Phase 1 only: repository foundation and seed loading. The JSON in reference/json/ is already normalized and validated — load it directly, do not write an xlsx ingestion pipeline.

Requirements:
1. Create backend/, frontend/, docs/ folders. Copy reference/json/*.json into backend/app/data/seed/.
2. Scaffold a FastAPI backend (no Docker, no PostgreSQL for this phase).
3. Add GET /health.
4. Write a Python seed-loading module that reads every JSON file into memory at startup.
5. Store money as integer cents everywhere.
6. Validate on load: 11 host regions, 143 funding rows, 22 pedestrian areas, 264 3D project records, 14 analog events, 768 ML rows, exact funding reconciliation to 10,025,021,200 cents, no duplicate IDs. Fail startup loudly if any check fails.
7. Add Pytest tests for the seed loader and the funding reconciliation.
8. Do not implement the optimizer, dashboard, or map yet.

Give a concise file-level plan first. Then implement. Run all tests and report exact commands, output, and files changed.
```

Commit only after tests pass:
```powershell
git add . && git commit -m "phase 1: scaffold app and load verified seed data"
```

### Phase 2 — evidence API

```text
Implement Phase 2 only: read-only evidence API, using the in-memory seed from Phase 1 (no database needed at this scale).

Implement:
GET /api/v1/cities
GET /api/v1/cities/{city_id}
GET /api/v1/cities/{city_id}/evidence
GET /api/v1/cities/{city_id}/projects
GET /api/v1/interventions
GET /api/v1/sources

Every response must preserve evidenceClass, sourceUrl, qualifier, unit, and methodology note where present. Missing data stays null, never zero.

Add API tests. Specifically verify GET /api/v1/cities/nynj/evidence returns the Match 104 record exactly as in reference/json/njMatchData.json: 80,663 ticket holders, 16,200 Uber count, 11,168 host shuttles, 21,024 NJ Transit egress, 60-minute egress, 65,000 American Dream pedestrians — all labeled evidenceClass "observed_final", not treated as model output.
```

### Phase 3 — the real optimizer (budget two days for this one)

```text
Implement Phase 3 only: the mixed-integer portfolio optimizer.

Refactor the logic in reference/model_run.py — it already uses scipy.optimize.milp and has real intervention definitions (see reference/json/interventions.json for the 12 categories with unit costs and useful life). Do not throw this away and start over; adapt it into an API endpoint.

Implement:
POST /api/v1/optimize
POST /api/v1/optimize/sensitivity

Use integer cents. Weights are normalized server-side. Identical requests return identical results.

Test with the exact request in reference/examples/nynj_optimize_request.json. Assert:
- spentCents <= budgetCents
- every selected project ID resolves to a real record in projects3d.json
- results are deterministic across repeated identical calls
- an infeasible request (impossible constraints) returns a structured explanation, not a crash

Do not copy reference/model_results.json as a canned answer — recalculate from the actual request weights and constraints every time.
```

### Phase 4 — dashboard

```text
Implement Phase 4 only: a frontend connected to the real API from Phases 2-3.

Build: landing page, all-11-region comparison page (using GET /api/v1/cities), city evidence page (NY/NJ first), optimizer page with adjustable weights/constraints that calls POST /api/v1/optimize, and a sensitivity panel.

Use Next.js, TypeScript, Tailwind, TanStack Query for API calls, ECharts for charts. The optimize button must call the real backend — do not compute results in the browser.

Every number shown must display its evidence class (observed / official / engineering_assumption) and a link to its source. Add loading, error, and infeasible states. Add frontend tests for the comparison page and one full optimizer run.
```

### Phase 5 — static map (simplified from the original runbook)

```text
Implement Phase 5 only: a MapLibre map using the already-generated GeoJSON in reference/geojson/ — specifically nynj_projects.geojson. Do not regenerate geometry from Shapely/PyProj; it's already built and validated.

Center on the Meadowlands complex. Implement four modes:
- Baseline: no proposals shown
- Temporary Operations: only selected -TMP project IDs from the current optimizer scenario
- Selected Legacy: only selected -PERM project IDs from the current optimizer scenario
- All Possibilities: every candidate shown translucently

The current optimizer scenario (from Phase 3/4) is the only source of which IDs are "selected" — the map must never invent a selected object.

Add click cards showing project name, phase, cost, evidence basis, and source link, pulled from the same data used elsewhere. No Three.js, no custom 3D objects, no Blender — flat GeoJSON layers only for this phase.

Add a test proving baseline mode hides every proposal and that an unselected ID never renders as selected.
```

---

## 7. After each phase

Before moving on, ask Claude Code directly:

```text
Review the current diff against this phase's acceptance criteria above. List any unmet requirement with its file path, then fix it.
```

```text
Run the relevant tests now. Do not summarize expected results — show the actual failures and fix them.
```

Commit only once tests pass. If a later phase breaks something, go back to the last good commit rather than asking Claude Code to repair an unknown number of unrelated changes.

---

## 8. If you somehow finish early

Only then consider: PostgreSQL/PostGIS (swap in for the in-memory seed, mostly a "production-readiness" pitch point), a procedural Three.js mobility-hub object (skip Blender entirely), or limited deck.gl flow animation labeled `illustrative_flow`. None of these are worth risking Phases 1–5 for.
