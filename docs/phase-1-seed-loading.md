# Phase 1 — Foundation and seed loading

## What exists after this phase

```
backend/
  app/
    config.py            paths, expected counts, reconciliation constants
    main.py              FastAPI app; loads+validates seed at startup; GET /health
    seed/
      loader.py          reads all 20 JSON files into memory
      schema.py          SeedData container and derived indexes
      validation.py      123 integrity checks
      money.py           integer-cents helpers
    data/seed/*.json     copy of the verified bundle (reference/ is untouched)
  tests/                 42 tests
frontend/                placeholder (Phase 4)
docs/                    this file
```

`GET /health` is the only endpoint. The evidence API (Phase 2), optimizer
(Phase 3), dashboard (Phase 4) and map (Phase 5) are not implemented yet.

## Design decisions

**Records are stored verbatim as read-only mappings, not narrowed models.**
Parsing each dataset into a Pydantic model with a fixed field list would drop
the qualifiers, methodology notes and source URLs that rule 7 requires us to
carry, and would reject legitimate data: `evidenceClass` is free text in the
real bundle (`"official NFL gamebook"`, `"local media citing venue"`), not the
nine-value enum in `reference/types/datasets.ts`. Validation is therefore
applied separately, in `validation.py`, to the fields the application actually
depends on.

**Nulls are preserved, never zeroed** (rule 6). The 11 `reserve` funding rows
have `typicalUnitCostCents: null` because a reserve has no unit cost — not
because it costs nothing. Twelve analog events have `transitBoardings: null`
because no transit figure was published. `as_cents()` raises on `None` rather
than defaulting, so a missing amount can never silently become zero.

**Money is integer cents everywhere** (rule 4). `money/integer-cents` rejects a
float in any cents field, and startup fails if one appears.

## Validation performed at startup

123 checks in seven groups. Any failure raises `SeedValidationError`, which
lists every failure and stops the process.

| Group | Covers |
|---|---|
| counts | 15 datasets against the bundle's validation report |
| money | integer-cents typing, non-negative allocations, nulls preserved |
| funding | global and per-city reconciliation |
| uniqueness | 14 identifier columns, including all 264 `projectId`s |
| referential integrity | city / area / category / source foreign keys |
| provenance | `evidenceClass` on 11 datasets, `sourceUrl` on 6 |
| domain | phase enum, `concept_only` status, coordinates, area shares sum to 1.0 |

The reconciliation rule 5 pins is checked directly:

```
sum(officialBudgetCents) over 11 host regions == 10,025,021,200 cents
```

and is decomposed further — temporary 4,412,800,000 + permanent 5,555,200,000
+ reserve 57,021,200 = 10,025,021,200 — plus a per-city check that each
region's 13 category rows reconcile to its own official budget.

Moving a single cent produces five named failures and a refusal to start.

## Evidence handling

Nothing in this phase computes or infers a number. Every value served is the
value in the bundle, with its `evidenceClass`, `qualifier`, `sourceUrl` and
methodology note attached. The 264 3D project records are all
`implementationStatus: concept_only`; their coordinates are conceptual planning
anchors (rule 9), and `spatialPrecision` is required on each so the frontend
can say so.

## Verification

```bash
cd backend && ./.venv/bin/python -m pytest
```

42 passed. `python3 reference/scripts/validate_bundle.py` also passes its own
27 checks against the untouched reference copy.
