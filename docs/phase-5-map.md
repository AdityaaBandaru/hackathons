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
| All Possibilities | all 24 candidates, translucent, none marked selected |

The mode rule lives in one pure function, `resolveMapSelection`, so the
invariants can be proven by test instead of by inspecting a WebGL canvas:

- **Rule 12** — baseline returns empty lists regardless of what the scenario
  says.
- **Rule 11/13** — the scenario's `selectedProjects` is the only input that
  can put an ID in `selectedIds`. There is no default portfolio, no fallback,
  and no derivation. With no scenario, nothing is selected.
- An ID the loaded geometry has no feature for is dropped, so an Atlanta
  scenario against this map selects nothing rather than erroring.
- "All Possibilities" leaves `selectedIds` empty on purpose: *possible* must
  never be styled as *chosen*.

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
cd frontend && npm test && npm run build      # 57 passed, build clean
```

Frontend tests: 57 (13 from Phase 4, 44 new across three files).

- `mapModes.test.ts` (21) — the pure rule, including that baseline hides every
  ID individually, that no unselected ID reaches `selectedIds` in any mode,
  and that a null scenario selects nothing.
- `ProjectMap.test.tsx` (11) — the same invariants asserted against the actual
  MapLibre layer filters, with the library faked, so the *rendering* path is
  proven, not just the logic.
- `map/page.test.tsx` (12) — modes, the no-scenario and wrong-city banners, and
  the click card's name/phase/cost/evidence/source.

Live-verified in the browser against the running backend, in both dev and a
production build: all four modes (Baseline visibly empty; Selected Legacy and
Temporary Operations each drawing 9 of the scenario's projects; All
Possibilities drawing all 24), the scenario surviving client-side navigation
from the optimizer, and a click card on `nynj-station-PERM`.
