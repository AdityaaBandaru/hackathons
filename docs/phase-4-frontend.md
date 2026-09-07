# Phase 4 — Frontend dashboard

## What exists after this phase

```
frontend/
  src/
    app/
      page.tsx                landing page (health check, links)
      compare/page.tsx         all-11-region comparison
      cities/[cityId]/page.tsx city evidence page
      optimize/page.tsx        optimizer + sensitivity panel
    components/
      EvidenceBadge.tsx        evidence class + source link, single and grouped
      StatusStates.tsx         loading / error / infeasible presentational states
      Chart.tsx                ECharts wrapper
      optimizer/                weight sliders, constraints form, results, sensitivity
    lib/
      api.ts                   typed fetch client -- the only place that calls the backend
      types.ts                 types matching the real backend responses
      format.ts, evidence.ts   display formatting and evidence-class classification
    test/                      msw fixtures + server, matching the real API shapes
```

Two small, targeted additions to the Phase 2/3 backend were made to support
this phase honestly rather than working around a gap in the API:

1. **`GET /api/v1/cities/{city_id}/evidence` gained a `funding` section** --
   the city's 13 funding.json rows. Without it, the budget figures shown on
   `/compare` and the city page would have had no evidenceClass or sourceUrl
   to display, since `officialBudgetCents` itself carries none at the
   `/cities` summary level. This is the same pattern the endpoint already
   used for `pedestrianAreas` and `matchData` -- a read-only addition, not new
   scope. Two backend tests were added for it and the one test asserting the
   endpoint's exact key set was updated.
2. **CORS middleware**, since the frontend runs on a different origin
   (`localhost:3000`) than the API (`localhost:8000`) and calls it directly
   from the browser. No cookies or credentials cross this boundary, so an
   explicit origin allowlist (`CORS_ALLOWED_ORIGINS`, defaulting to
   `localhost:3000`) is sufficient.

Backend test count after these additions: 142 (was 138).

## The optimize button always calls the backend

`src/lib/api.ts` is the only module that talks to the API. There is no
client-side MILP solver, no benefit scoring, no re-derivation of a number the
backend already computed. `OptimizePage` posts the form state to
`POST /api/v1/optimize` via a TanStack Query mutation and renders exactly what
comes back. Verified live against the running backend: the example request's
default weights and constraints reproduce the same 18 selected project IDs
and \$10,330,000 spend confirmed in Phase 3 testing, and the sensitivity panel
reproduces "changed at 8 of 15 points" from the same session.

## Evidence on every number

`EvidenceBadge` renders one `evidenceClass` string plus a source link, always
verbatim -- it classifies into a visual tone (observed / official / model
output / assumption / derived / other) without rewriting the underlying
value, so a free-text citation like `"official NFL gamebook"` still displays
as itself. Where a figure has no single evidenceClass of its own (a city's
total official budget, which is really the sum of 13 differently-labeled
funding rows), `EvidenceBadgeGroup` shows the actual class distribution
underneath it (`engineering_assumption ×12`, `formula_residual ×1`) rather
than inventing one class for the aggregate.

## Loading, error, and infeasible states

- `LoadingBlock` -- shown while a query is pending (`role="status"`).
- `ErrorBlock` -- shown for network failures, 400s, and 404s, with retry.
- `InfeasibleBlock` -- shown only for a 422 `infeasible_scenario` response;
  renders the solver's own diagnostic code, message, and detail object
  instead of a generic failure. Verified live: setting the minimum-permanent-
  share slider to 99% renders `permanent_share_unreachable` with
  `maximumAchievablePermanentShare: 0.8, achievedBy: ["station"]` straight
  from the API.
- The city evidence page separately handles an unknown `cityId` (backend
  404 with `validCityIds`) with its own message, verified live at
  `/cities/atlantis`.

## Chart correctness

Both bar charts on `/compare` and the sensitivity spend chart explicitly pin
their value axis to `min: 0`. ECharts auto-scales a value axis to the data's
own range by default; since every host region's budget sits in a narrow
\$8.4M-\$10.4M band, an auto-scaled axis put its minimum near \$8M and turned
every bar into a barely-visible sliver above that baseline -- caught by
visual inspection in the live browser check, not by the build or type check.

## What was not built

No map (Phase 5), no Three.js/Blender scene (explicitly gated to after
Phase 5 by CLAUDE.md rule 16), no authentication or database (rule 15).

## Verification

```bash
cd backend && ./.venv/bin/python -m pytest      # 142 passed
cd frontend && npm run build && npm test         # build clean, 13 passed
```

Live-verified in-browser against the running backend: landing page connection
banner, comparison page charts and table, city evidence page including the
Match 104 acceptance row, a full optimizer run, the sensitivity sweep, the
infeasible-scenario state, and the unknown-city 404 state.
