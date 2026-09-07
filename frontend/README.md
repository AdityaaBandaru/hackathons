# Frontend

Next.js (App Router) + TypeScript + Tailwind CSS dashboard for the World Cup
2026 Host-City Mobility Investment and Legacy Optimizer, connected to the
Phase 1-3 FastAPI backend. Phase 4 scope: landing page, an 11-region
comparison page, a per-city evidence page, and an optimizer page with a
sensitivity panel. No map yet -- that's Phase 5.

## Pages

| Route | Purpose |
|---|---|
| `/` | Overview, links, live backend connection check |
| `/compare` | All 11 host regions: budgets, funding-phase split, demand |
| `/cities/[cityId]` | One city's full evidence: funding, match-day data, analog events, pedestrian areas, modeled projects |
| `/optimize` | Adjustable weights/constraints, calls the real MILP optimizer, plus a sensitivity panel |

## Setup

```bash
npm install
cp .env.local.example .env.local   # points at http://localhost:8000 by default
```

Run the backend first (from `backend/`, `uvicorn app.main:app --reload`),
then:

```bash
npm run dev
```

## Test

```bash
npm test
```

Frontend tests mock the API with [msw](https://mswjs.io/) rather than hitting
a live backend, using fixtures shaped exactly like the real responses. The
optimizer test asserts the request body the "Run optimizer" button actually
sends and that every rendered number comes from the mocked response body --
nothing is computed client-side.

## Build

```bash
npm run build
```

## Design notes

- **The optimize button always calls the backend.** `src/lib/api.ts` is the
  only place that talks to the API; there is no client-side MILP or
  benefit-scoring code anywhere in this app.
- **Every displayed number carries its evidence class and source**
  (`src/components/EvidenceBadge.tsx`). Where the currently-shipped API
  doesn't attach evidenceClass to a figure directly (city-level budget
  totals), the page instead shows the evidence classes of the underlying
  funding-category records that back it, via `EvidenceBadgeGroup` -- nothing
  is labeled with a class the backend never returned.
- **Optimizer results render exactly what the API returned.**
  `selectedProjectIds` / `selectedProjects` come straight from the response;
  the frontend never invents a selected project (CLAUDE.md rule 11).
- **Loading, error, and infeasible states are distinct**
  (`src/components/StatusStates.tsx`). A 422 `infeasible_scenario` response
  renders the solver's own diagnostics, not a generic error.
