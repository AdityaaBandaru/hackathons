# Phase 3 — Mixed-integer portfolio optimizer

## What exists after this phase

```
backend/app/optimizer/
  parameters.py    engineering-assumption constants carried from model_run.py
  model.py         MILP construction, solve, integer-cents result building
  sensitivity.py   the five Part 13 assumption sweeps
  schemas.py       request models matching reference/types/datasets.ts
  errors.py        structured invalid/infeasible failures
backend/app/api/v1/optimize.py   POST /optimize, POST /optimize/sensitivity
```

## This is a refactor of `reference/model_run.py`, not a rewrite

The formulation is unchanged: one binary per (intervention, marginal unit)
segment with an ordering row so later units cannot be bought before earlier
ones, one binary per complementary pair, a single budget row, and a weighted
sum of normalised benefit families as the objective. Diminishing returns come
from the segment factors; interaction effects from the pair variables.

The strongest evidence that it is a faithful adaptation:
`test_reproduces_reference_model_for_every_city` runs the refactored optimizer
with the reference's own weights and no constraints, and asserts it reproduces
`reference/model_results.json` exactly — same quantities and same spend — for
all 11 host regions.

A second test closes the provenance loop the other way:
`funding.json`'s `selectedUnits` are themselves the output of that reference
run, so the refactor must also land on the seeded portfolio, and its unspent
budget must equal the seeded `reserve` row (10,868,100 cents for nynj).

## What the seed supplies vs. what stays a coded assumption

Every per-city constant the reference script hard-coded was verified to be
present in the seed and is now read from it:

| Reference table | Seed source | Verified |
|---|---|---|
| `BUDGET` | `hostRegions.officialBudgetCents` | 11/11 exact |
| `ATTENDANCE` | `hostRegions.tournamentDemand` | 11/11 exact |
| `MULT` | `cityMultipliers.json` | 132/132 exact |
| `I[...].cost_m` | `interventions.typicalUnitCostCents` | 12/12 exact |

What the bundle does not carry, and therefore remains in `parameters.py` as a
documented engineering assumption: the five-family metric vector per
intervention, the unit caps, the segment factors, the commensurating
denominators, and the synergy pairs.

## Changes on top of the reference model

**A sixth benefit dimension.** The reference objective has five metric
families; the request contract in `reference/types/datasets.ts` carries six
weights. The sixth, `permanentLegacy`, needs something to weight, so the model
adds a legacy dimension: a unit's passenger-minute benefit, restricted to its
permanent share, multiplied by its useful life in years. With
`permanentLegacy: 0` the objective collapses back to the reference's exactly —
which is what makes the reproduction test above possible.

**Phase-aware output.** A category's spend splits temporary/permanent by the
fixed share in `interventions.json`. That split was verified to reproduce the
seed exactly: 264 of 264 `projects3d.allocationCents` equal the corresponding
`funding` phase allocation. So selecting *q* units of a category yields both
its `-TMP` and `-PERM` project IDs with those allocations. The permanent side
takes the rounding remainder, so the two always sum back to the total and no
cent is created or lost.

**Four request constraints, as linear rows.** `maximumTemporaryShare`,
`minimumPermanentShare` and `minimumAccessibilityShare` are shares of realised
spend, written homogeneously so they constrain the *mix* without forcing a
level of spending. `maximumMajorConstructionProjects` counts selected
categories through their segment-0 binary.

Both constraint category sets are derived from the bundle rather than
hand-listed, and are reported on every response:

- accessibility = `{access, ped, wayfinding, station}` — the four whose fixes
  describe reaching and moving through the venue on foot, with a disability,
  or while navigating an unfamiliar system.
- major construction = categories whose `defaultGeometryType` is
  `polygon_extrusion` or `glb_model`, i.e. a built facility rather than a
  surface treatment, point equipment, or an operating plan. That yields
  `{hub, parkride, tnc, station, toc}`.

## Integer cents

The solver sees floats, but no reported amount is ever read back off the
solver's float vector. Costs are integer cents (`round(unitCost × costMultiplier)`),
and every reported figure is recomputed with integer arithmetic from the
integer solution vector. `spentCents`, `unspentCents`, the phase split and
each project's `allocationCents` all reconcile exactly.

## Determinism

Variables are built in a fixed order from the bundle's canonical
`categoryCode` ordering, synergy pairs are held in a tuple rather than a dict,
and HiGHS is deterministic for identical input. Tested with 15 repeated
identical solves and 10 repeated identical HTTP calls.

## Nothing is canned

`reference/model_results.json` is read by exactly one test, to prove
faithfulness. It is never served. Every call re-solves from the request's own
weights and constraints, and `test_results_are_not_served_from_model_results_json`
proves it: weighting `permanentLegacy` alone drops the one-year-life `service`
intervention entirely, and weighting `emissions` alone avoids `tnc`, which
carries a negative CO₂ coefficient.

## Infeasibility

An impossible scenario is a normal outcome of a well-formed request, so it
returns `422` with a structured body, never a 500. Pre-flight checks catch the
explainable cases before the solver so the response says which constraint is
the problem and what the achievable range actually was:

| Code | Catches |
|---|---|
| `required_and_excluded` | same intervention required and excluded |
| `required_exceeds_budget` | one unit of each required intervention already exceeds the budget |
| `permanent_share_unreachable` | floor above the library's best permanent share (0.80, station) |
| `temporary_share_unreachable` | ceiling below the library's lowest temporary share |
| `accessibility_share_unreachable` | floor requested with every accessibility category excluded |
| `construction_cap_conflict` | more facilities required than the cap allows |
| `unknown_intervention_id` | a category that does not exist |
| `solver_infeasible` | anything else HiGHS rejects |

`unknown_city` and unsupported/out-of-range `assumptionsOverride` keys return
`400` as `invalid_scenario` — an override key the model does not understand is
rejected rather than silently ignored.

## Sensitivity

`POST /api/v1/optimize/sensitivity` runs the five axes named in
Research_and_Modeling_Task.md Part 13 — attendance 80/100/120, budget ±25%,
intervention costs ±20%, transit capacity ±20%, visitor transit usage
low/medium/high — and reports for each point whether the portfolio changed,
plus which project IDs entered and left. A point that is individually
infeasible (a budget cut that no longer fits the required interventions) is
reported inline as a finding rather than failing the sweep.

For nynj at the example request's weights the portfolio is stable across
attendance — demand scales every benefit uniformly, so the ranking does not
move — but changes under budget, cost and transit assumptions.

`transitCapacityMultiplier` and `visitorTransitUsageMultiplier` both act on
interventions whose `defaultAreaTarget` is `transit`. This MVP model does not
separate transit supply from transit demand; that would need a network
assignment model the bundle does not provide, and the response says so.

## Evidence labelling

Every response carries `evidenceClass: "model_output"`, a `modelVersion`, and
a `modelAssumptions` block stating in as many words that the figures are model
outputs computed from engineering assumptions and not observed measurements
(CLAUDE.md rule 8). The block also publishes the segment factors, the synergy
pairs and factors, and both constraint category sets, so a reader can see what
was assumed.

## Verification

```bash
cd backend && ./.venv/bin/python -m pytest
```

138 passed (72 from Phases 1–2, 66 new). `reference/scripts/validate_bundle.py`
still passes its own 27 checks against the untouched reference copy.
