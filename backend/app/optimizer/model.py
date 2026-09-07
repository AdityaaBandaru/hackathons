"""The mixed-integer portfolio optimizer.

This is ``reference/model_run.py`` adapted into a callable service. The
formulation is unchanged: one binary per (intervention, marginal unit) segment
with an ordering constraint so later units cannot be bought before earlier
ones, one binary per complementary pair, a single budget row, and a weighted
sum of normalised benefit families as the objective. Diminishing returns come
from the segment factors, interaction effects from the pair variables.

What this adds on top of the reference script:

* every city parameter is read from the seed rather than hard-coded
* money is integer cents end to end; the solver sees floats, but every
  reported amount is recomputed with integer arithmetic from the integer
  solution vector
* the six request weights (the reference has five) are normalised server-side
* the request's phase, accessibility and construction constraints become
  additional linear rows
* the selected portfolio is reported as canonical projects3d project IDs
  (CLAUDE.md rules 10 and 11)
* an impossible scenario raises a structured error instead of crashing

Results are deterministic: variables are built in a fixed order from the
bundle's canonical category ordering, and HiGHS is deterministic for identical
input.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Sequence

import numpy as np
from scipy.optimize import Bounds, LinearConstraint, milp

from ..seed import SeedData
from .errors import Diagnostic, InfeasibleScenarioError, InvalidScenarioError
from .parameters import (
    ACCESSIBILITY_CATEGORIES,
    ASSUMPTION_OVERRIDE_MAX,
    ASSUMPTION_OVERRIDE_MIN,
    DEMAND_REFERENCE_ATTENDANCE,
    INTERVENTION_ASSUMPTIONS,
    MAJOR_CONSTRUCTION_GEOMETRY_TYPES,
    METRIC_DENOMINATORS,
    MODEL_EVIDENCE_CLASS,
    MODEL_VERSION,
    SEGMENT_FACTORS,
    SOLVER_TIME_LIMIT_SECONDS,
    SUPPORTED_ASSUMPTION_OVERRIDES,
    SYNERGY_PAIRS,
    TRANSIT_AREA_TARGET,
    WEIGHT_TO_DIMENSION,
)

# cityMultipliers.json uses display names for four categories; interventions.json
# uses the short codes the optimizer keys on.
MULTIPLIER_KEY_BY_CATEGORY: Mapping[str, str] = {
    "service": "service",
    "buslane": "buslane",
    "signals": "signals",
    "hub": "hub",
    "parkride": "parkride",
    "ped": "pedestrian",
    "bike": "bike",
    "tnc": "rideshare",
    "wayfinding": "wayfinding",
    "station": "station",
    "toc": "trafficOps",
    "access": "accessibility",
}


@dataclass(frozen=True)
class Intervention:
    """One intervention category, assembled from seed plus model assumptions."""

    category: str
    category_name: str
    decision_unit: str
    unit_cost_cents: int
    temporary_share: float
    permanent_share: float
    useful_life_years: int
    geometry_type: str
    area_target: str
    max_units: int
    metrics: tuple[float, ...]
    multiplier: float

    @property
    def is_major_construction(self) -> bool:
        return self.geometry_type in MAJOR_CONSTRUCTION_GEOMETRY_TYPES

    @property
    def is_accessibility(self) -> bool:
        return self.category in ACCESSIBILITY_CATEGORIES

    @property
    def is_transit_dependent(self) -> bool:
        return self.area_target == TRANSIT_AREA_TARGET


@dataclass(frozen=True)
class CityModel:
    """Everything the solver needs about one host region."""

    city_id: str
    host_region: str
    official_budget_cents: int
    tournament_demand: int
    interventions: tuple[Intervention, ...]
    project_id_by_category_phase: Mapping[tuple[str, str], str]

    def intervention(self, category: str) -> Intervention | None:
        return next((i for i in self.interventions if i.category == category), None)


def build_city_model(seed: SeedData, city_id: str) -> CityModel:
    """Assemble a city's optimizer inputs from the seed bundle.

    Raises InvalidScenarioError if the city is unknown. Every value here comes
    from the seed except the per-intervention metric vectors, unit caps and
    segment factors, which live in parameters.py because the bundle does not
    carry them.
    """
    region = seed.host_region_by_city_id.get(city_id)
    if region is None:
        raise InvalidScenarioError(
            f"unknown cityId: {city_id!r}",
            [
                Diagnostic(
                    "unknown_city",
                    f"{city_id!r} is not one of the 11 host regions",
                    {"validCityIds": sorted(seed.city_ids)},
                )
            ],
        )

    host_region = str(region["hostRegion"])
    multiplier_row = next(
        (row for row in seed.cityMultipliers if row.get("hostRegion") == host_region),
        None,
    )
    if multiplier_row is None:  # pragma: no cover - seed validation prevents this
        raise InvalidScenarioError(f"no city multipliers on file for {host_region!r}")

    interventions: list[Intervention] = []
    # Canonical order: interventions.json categoryCode. Fixed ordering is what
    # makes repeated identical requests produce identical variable layouts.
    for row in sorted(seed.interventions, key=lambda r: r["categoryCode"]):
        category = str(row["category"])
        assumptions = INTERVENTION_ASSUMPTIONS.get(category)
        if assumptions is None:  # pragma: no cover - defensive
            raise InvalidScenarioError(f"no model assumptions for category {category!r}")
        max_units, metrics = assumptions
        interventions.append(
            Intervention(
                category=category,
                category_name=str(row["categoryName"]),
                decision_unit=str(row["decisionUnit"]),
                unit_cost_cents=int(row["typicalUnitCostCents"]),
                temporary_share=float(row["temporaryShare"]),
                permanent_share=float(row["permanentShare"]),
                useful_life_years=int(row["usefulLifeYears"]),
                geometry_type=str(row["defaultGeometryType"]),
                area_target=str(row["defaultAreaTarget"]),
                max_units=max_units,
                metrics=tuple(float(m) for m in metrics),
                multiplier=float(multiplier_row[MULTIPLIER_KEY_BY_CATEGORY[category]]),
            )
        )

    project_ids = {
        (str(p["category"]), str(p["phase"])): str(p["projectId"])
        for p in seed.projects_by_city_id.get(city_id, ())
    }

    return CityModel(
        city_id=city_id,
        host_region=host_region,
        official_budget_cents=int(region["officialBudgetCents"]),
        tournament_demand=int(region["tournamentDemand"]),
        interventions=tuple(interventions),
        project_id_by_category_phase=project_ids,
    )


def normalize_weights(weights: Mapping[str, float]) -> dict[str, float]:
    """Normalise the six request weights to sum to 1.0.

    Weights arrive on whatever scale the caller likes; the objective only cares
    about their ratios. A negative weight is rejected -- it would ask the model
    to actively destroy one benefit family to buy another.
    """
    negative = sorted(key for key, value in weights.items() if value < 0)
    if negative:
        raise InvalidScenarioError(
            "weights must not be negative",
            [Diagnostic("negative_weight", "negative weights are not supported", {"keys": negative})],
        )
    total = float(sum(weights.values()))
    if total <= 0.0:
        raise InvalidScenarioError(
            "at least one weight must be greater than zero",
            [
                Diagnostic(
                    "zero_weight_vector",
                    "all six objective weights are zero, so no portfolio is preferred to any other",
                    {"weights": dict(weights)},
                )
            ],
        )
    return {key: float(value) / total for key, value in weights.items()}


def resolve_assumptions(overrides: Mapping[str, float] | None) -> dict[str, float]:
    """Merge caller overrides onto the model defaults, rejecting unknown keys."""
    resolved = dict(SUPPORTED_ASSUMPTION_OVERRIDES)
    if not overrides:
        return resolved

    unknown = sorted(set(overrides) - set(SUPPORTED_ASSUMPTION_OVERRIDES))
    if unknown:
        raise InvalidScenarioError(
            f"unsupported assumption override key(s): {', '.join(unknown)}",
            [
                Diagnostic(
                    "unknown_assumption_override",
                    "an override key the model does not understand was supplied; "
                    "it is rejected rather than silently ignored",
                    {
                        "unknownKeys": unknown,
                        "supportedKeys": sorted(SUPPORTED_ASSUMPTION_OVERRIDES),
                    },
                )
            ],
        )

    out_of_range: dict[str, float] = {}
    for key, value in overrides.items():
        numeric = float(value)
        if not np.isfinite(numeric) or not (
            ASSUMPTION_OVERRIDE_MIN <= numeric <= ASSUMPTION_OVERRIDE_MAX
        ):
            out_of_range[key] = numeric
        else:
            resolved[key] = numeric
    if out_of_range:
        raise InvalidScenarioError(
            "assumption override values are out of the supported range",
            [
                Diagnostic(
                    "assumption_override_out_of_range",
                    f"multipliers must be between {ASSUMPTION_OVERRIDE_MIN} and "
                    f"{ASSUMPTION_OVERRIDE_MAX}",
                    {"values": out_of_range},
                )
            ],
        )
    return resolved


@dataclass(frozen=True)
class ScenarioConstraints:
    """The request's constraint block, already defaulted."""

    minimum_accessibility_share: float | None = None
    maximum_temporary_share: float | None = None
    minimum_permanent_share: float | None = None
    maximum_major_construction_projects: int | None = None
    required_intervention_ids: tuple[str, ...] = ()
    excluded_intervention_ids: tuple[str, ...] = ()


def _effective_unit_cost_cents(intervention: Intervention, cost_multiplier: float) -> int:
    """Unit cost after the cost-sensitivity multiplier, still integer cents."""
    return int(round(intervention.unit_cost_cents * cost_multiplier))


def _metric_vector(
    intervention: Intervention, demand_scale: float, transit_scale: float
) -> np.ndarray:
    """The six-dimensional benefit vector for one full unit of an intervention.

    The first five families are the reference model's, scaled by the city's
    productivity multiplier and demand. The sixth is legacy value: the unit's
    passenger-minute benefit, restricted to its permanent share, multiplied by
    how many years the permanent asset keeps delivering it.
    """
    scale = intervention.multiplier * demand_scale
    if intervention.is_transit_dependent:
        scale *= transit_scale
    operational = np.array(intervention.metrics, dtype=float) * scale
    legacy = (
        operational[0] * intervention.permanent_share * float(intervention.useful_life_years)
    )
    return np.append(operational, legacy)


def _preflight_diagnostics(
    city: CityModel,
    constraints: ScenarioConstraints,
    budget_cents: int,
    cost_multiplier: float,
) -> list[Diagnostic]:
    """Catch impossible scenarios before the solver, so the reason is explainable.

    The solver would also reject these, but only with a status code. These
    checks say which constraint is the problem and what the achievable range
    actually is.
    """
    diagnostics: list[Diagnostic] = []
    by_category = {i.category: i for i in city.interventions}
    known = set(by_category)

    required = set(constraints.required_intervention_ids)
    excluded = set(constraints.excluded_intervention_ids)

    unknown = sorted((required | excluded) - known)
    if unknown:
        diagnostics.append(
            Diagnostic(
                "unknown_intervention_id",
                "requiredInterventionIds/excludedInterventionIds name categories that "
                "do not exist in the intervention library",
                {"unknownIds": unknown, "validIds": sorted(known)},
            )
        )
        return diagnostics

    conflicting = sorted(required & excluded)
    if conflicting:
        diagnostics.append(
            Diagnostic(
                "required_and_excluded",
                "the same intervention is both required and excluded",
                {"interventionIds": conflicting},
            )
        )

    # One unit of every required intervention must fit inside the budget.
    if required:
        floor_cents = sum(
            _effective_unit_cost_cents(by_category[c], cost_multiplier) for c in sorted(required)
        )
        if floor_cents > budget_cents:
            diagnostics.append(
                Diagnostic(
                    "required_exceeds_budget",
                    "one unit of each required intervention already costs more than the budget",
                    {
                        "requiredInterventionIds": sorted(required),
                        "minimumRequiredCents": floor_cents,
                        "budgetCents": budget_cents,
                        "shortfallCents": floor_cents - budget_cents,
                    },
                )
            )

    # The phase shares are fixed per intervention, so the achievable permanent
    # (and temporary) share of spend is bounded by the library itself.
    selectable = [i for i in city.interventions if i.category not in excluded]
    if selectable and (required or constraints.minimum_permanent_share is not None):
        max_permanent = max(i.permanent_share for i in selectable)
        floor = constraints.minimum_permanent_share
        if floor is not None and floor > max_permanent:
            diagnostics.append(
                Diagnostic(
                    "permanent_share_unreachable",
                    "no mix of the available interventions can reach the requested "
                    "minimum permanent share",
                    {
                        "minimumPermanentShare": floor,
                        "maximumAchievablePermanentShare": max_permanent,
                        "achievedBy": sorted(
                            i.category for i in selectable if i.permanent_share == max_permanent
                        ),
                    },
                )
            )
        ceiling = constraints.maximum_temporary_share
        if ceiling is not None and ceiling < (1.0 - max_permanent):
            diagnostics.append(
                Diagnostic(
                    "temporary_share_unreachable",
                    "no mix of the available interventions can stay under the requested "
                    "maximum temporary share",
                    {
                        "maximumTemporaryShare": ceiling,
                        "minimumAchievableTemporaryShare": 1.0 - max_permanent,
                        "achievedBy": sorted(
                            i.category for i in selectable if i.permanent_share == max_permanent
                        ),
                    },
                )
            )

    # An accessibility floor is unreachable if every accessibility category is
    # excluded but spending is still forced.
    floor_access = constraints.minimum_accessibility_share
    if floor_access is not None and floor_access > 0.0:
        available_access = sorted(
            i.category for i in selectable if i.is_accessibility
        )
        if not available_access and required:
            diagnostics.append(
                Diagnostic(
                    "accessibility_share_unreachable",
                    "a minimum accessibility share was requested but every "
                    "accessibility-serving intervention is excluded",
                    {
                        "minimumAccessibilityShare": floor_access,
                        "accessibilityCategories": sorted(ACCESSIBILITY_CATEGORIES),
                        "excludedInterventionIds": sorted(excluded),
                    },
                )
            )
        if floor_access > 1.0:
            diagnostics.append(
                Diagnostic(
                    "accessibility_share_above_one",
                    "minimumAccessibilityShare cannot exceed 1.0",
                    {"minimumAccessibilityShare": floor_access},
                )
            )

    # A zero construction cap conflicts with a required facility intervention.
    cap = constraints.maximum_major_construction_projects
    if cap is not None:
        required_major = sorted(
            c for c in required if by_category[c].is_major_construction
        )
        if len(required_major) > cap:
            diagnostics.append(
                Diagnostic(
                    "construction_cap_conflict",
                    "more major-construction interventions are required than the cap allows",
                    {
                        "maximumMajorConstructionProjects": cap,
                        "requiredMajorConstructionIds": required_major,
                    },
                )
            )

    return diagnostics


def solve(
    city: CityModel,
    *,
    budget_cents: int,
    weights: Mapping[str, float],
    constraints: ScenarioConstraints | None = None,
    assumptions: Mapping[str, float] | None = None,
) -> dict[str, Any]:
    """Solve one city's portfolio problem and report it in integer cents.

    ``budget_cents`` is the requested budget before the budget multiplier;
    ``weights`` are the six raw request weights, normalised here.
    """
    constraints = constraints or ScenarioConstraints()
    resolved_assumptions = resolve_assumptions(assumptions)
    normalized = normalize_weights(weights)

    cost_multiplier = resolved_assumptions["costMultiplier"]
    effective_budget_cents = int(round(budget_cents * resolved_assumptions["budgetMultiplier"]))
    demand_scale = (
        city.tournament_demand / DEMAND_REFERENCE_ATTENDANCE
    ) * resolved_assumptions["attendanceMultiplier"]
    transit_scale = (
        resolved_assumptions["transitCapacityMultiplier"]
        * resolved_assumptions["visitorTransitUsageMultiplier"]
    )

    diagnostics = _preflight_diagnostics(
        city, constraints, effective_budget_cents, cost_multiplier
    )
    if diagnostics:
        raise InfeasibleScenarioError(
            "the requested constraints cannot all be satisfied", diagnostics
        )

    excluded = set(constraints.excluded_intervention_ids)
    required = set(constraints.required_intervention_ids)
    by_category = {i.category: i for i in city.interventions}

    # --- variable layout (fixed order => reproducible results) -------------
    segment_vars: list[tuple[str, int]] = []
    for intervention in city.interventions:
        segment_vars.extend((intervention.category, s) for s in range(intervention.max_units))
    pair_vars = [(a, b) for a, b, _factor in SYNERGY_PAIRS]

    names: list[tuple[str, ...]] = [("seg", c, str(s)) for c, s in segment_vars]
    names += [("pair", a, b) for a, b in pair_vars]
    index = {name: j for j, name in enumerate(names)}
    n = len(names)

    objective = np.zeros(n)
    costs = np.zeros(n)
    cost_cents: list[int] = [0] * n
    metric_vectors: list[np.ndarray] = [np.zeros(len(METRIC_DENOMINATORS))] * n

    weight_vector = np.zeros(len(METRIC_DENOMINATORS))
    for key, dimension in WEIGHT_TO_DIMENSION.items():
        weight_vector[dimension] = normalized.get(key, 0.0)
    denominators = np.array(METRIC_DENOMINATORS, dtype=float)

    for category, segment in segment_vars:
        intervention = by_category[category]
        j = index[("seg", category, str(segment))]
        vector = (
            _metric_vector(intervention, demand_scale, transit_scale)
            * SEGMENT_FACTORS[segment]
        )
        metric_vectors[j] = vector
        objective[j] = -float(weight_vector @ (vector / denominators))
        unit_cents = _effective_unit_cost_cents(intervention, cost_multiplier)
        cost_cents[j] = unit_cents
        costs[j] = float(unit_cents)

    for a, b, factor in SYNERGY_PAIRS:
        j = index[("pair", a, b)]
        va = _metric_vector(by_category[a], demand_scale, transit_scale)
        vb = _metric_vector(by_category[b], demand_scale, transit_scale)
        # Complementarity is credited conservatively: a share of the smaller
        # of the two first-unit benefits, family by family.
        vector = np.minimum(va, vb) * factor
        metric_vectors[j] = vector
        objective[j] = -float(weight_vector @ (vector / denominators))

    # --- constraint rows ---------------------------------------------------
    rows: list[LinearConstraint] = [
        LinearConstraint(costs, -np.inf, float(effective_budget_cents))
    ]

    # A later marginal unit requires every earlier unit of the same intervention.
    for intervention in city.interventions:
        for segment in range(1, intervention.max_units):
            row = np.zeros(n)
            row[index[("seg", intervention.category, str(segment))]] = 1
            row[index[("seg", intervention.category, str(segment - 1))]] = -1
            rows.append(LinearConstraint(row, -np.inf, 0))

    # A pair bonus is available only when both interventions are funded.
    for a, b, _factor in SYNERGY_PAIRS:
        z = index[("pair", a, b)]
        for category in (a, b):
            row = np.zeros(n)
            row[z] = 1
            row[index[("seg", category, "0")]] = -1
            rows.append(LinearConstraint(row, -np.inf, 0))
        row = np.zeros(n)
        row[z] = -1
        row[index[("seg", a, "0")]] = 1
        row[index[("seg", b, "0")]] = 1
        rows.append(LinearConstraint(row, -np.inf, 1))

    # Phase-mix and accessibility rows are shares of realised spend. Each is
    # homogeneous in the decision vector, so it constrains the mix without
    # forcing any particular level of spending.
    if constraints.maximum_temporary_share is not None:
        ceiling = float(constraints.maximum_temporary_share)
        row = np.zeros(n)
        for category, segment in segment_vars:
            j = index[("seg", category, str(segment))]
            row[j] = (by_category[category].temporary_share - ceiling) * cost_cents[j]
        rows.append(LinearConstraint(row, -np.inf, 0))

    if constraints.minimum_permanent_share is not None:
        floor = float(constraints.minimum_permanent_share)
        row = np.zeros(n)
        for category, segment in segment_vars:
            j = index[("seg", category, str(segment))]
            row[j] = (floor - by_category[category].permanent_share) * cost_cents[j]
        rows.append(LinearConstraint(row, -np.inf, 0))

    if constraints.minimum_accessibility_share is not None:
        floor = float(constraints.minimum_accessibility_share)
        row = np.zeros(n)
        for category, segment in segment_vars:
            j = index[("seg", category, str(segment))]
            indicator = 1.0 if by_category[category].is_accessibility else 0.0
            row[j] = (floor - indicator) * cost_cents[j]
        rows.append(LinearConstraint(row, -np.inf, 0))

    if constraints.maximum_major_construction_projects is not None:
        row = np.zeros(n)
        for intervention in city.interventions:
            if intervention.is_major_construction:
                row[index[("seg", intervention.category, "0")]] = 1
        rows.append(
            LinearConstraint(
                row, -np.inf, float(constraints.maximum_major_construction_projects)
            )
        )

    # --- bounds: required floors and exclusions ---------------------------
    lower = np.zeros(n)
    upper = np.ones(n)
    for category in sorted(required):
        lower[index[("seg", category, "0")]] = 1
    for category in sorted(excluded):
        intervention = by_category[category]
        for segment in range(intervention.max_units):
            upper[index[("seg", category, str(segment))]] = 0
        # A pair bonus involving an excluded intervention is unavailable.
        for a, b, _factor in SYNERGY_PAIRS:
            if category in (a, b):
                upper[index[("pair", a, b)]] = 0

    result = milp(
        objective,
        integrality=np.ones(n),
        bounds=Bounds(lower, upper),
        constraints=rows,
        options={"time_limit": SOLVER_TIME_LIMIT_SECONDS},
    )

    if result.status == 2 or result.x is None:
        raise InfeasibleScenarioError(
            "no portfolio satisfies the requested budget and constraints",
            [
                Diagnostic(
                    "solver_infeasible",
                    "the solver could not find any feasible portfolio for this "
                    "combination of budget, required interventions and share constraints",
                    {
                        "solverStatus": int(result.status),
                        "solverMessage": str(result.message),
                        "budgetCents": effective_budget_cents,
                        "requiredInterventionIds": sorted(required),
                        "excludedInterventionIds": sorted(excluded),
                    },
                )
            ],
        )
    if result.status not in (0, 1):
        raise InfeasibleScenarioError(
            "the optimizer could not solve this scenario",
            [
                Diagnostic(
                    "solver_failed",
                    str(result.message),
                    {"solverStatus": int(result.status)},
                )
            ],
        )

    return _build_result(
        city=city,
        solution=np.rint(result.x).astype(int),
        names=names,
        cost_cents=cost_cents,
        metric_vectors=metric_vectors,
        objective=objective,
        by_category=by_category,
        budget_cents=effective_budget_cents,
        requested_budget_cents=budget_cents,
        normalized_weights=normalized,
        assumptions=resolved_assumptions,
        constraints=constraints,
        demand_scale=demand_scale,
        transit_scale=transit_scale,
        cost_multiplier=cost_multiplier,
        solver_status=int(result.status),
    )


def _phase_split_cents(
    intervention: Intervention, units: int, cost_multiplier: float
) -> tuple[int, int, int]:
    """Split an intervention's spend into (total, temporary, permanent) cents.

    The permanent side takes the remainder so the two always sum back to the
    total exactly -- no cent is created or lost by rounding. This reproduces
    the split already present in the seed: for nynj service at 3 units this
    yields 132,000,000 temporary and 33,000,000 permanent, matching
    funding.json and the allocations on nynj-service-TMP / nynj-service-PERM.
    """
    total = _effective_unit_cost_cents(intervention, cost_multiplier) * units
    temporary = int(round(total * intervention.temporary_share))
    return total, temporary, total - temporary


def _build_result(
    *,
    city: CityModel,
    solution: np.ndarray,
    names: Sequence[tuple[str, ...]],
    cost_cents: Sequence[int],
    metric_vectors: Sequence[np.ndarray],
    objective: np.ndarray,
    by_category: Mapping[str, Intervention],
    budget_cents: int,
    requested_budget_cents: int,
    normalized_weights: Mapping[str, float],
    assumptions: Mapping[str, float],
    constraints: ScenarioConstraints,
    demand_scale: float,
    transit_scale: float,
    cost_multiplier: float,
    solver_status: int,
) -> dict[str, Any]:
    """Turn the integer solution vector into the API response payload."""
    quantities: dict[str, int] = {i.category: 0 for i in city.interventions}
    for j, name in enumerate(names):
        if name[0] == "seg" and solution[j]:
            quantities[name[1]] += 1

    # Money is recomputed with integer arithmetic from the integer solution --
    # never read back off the solver's float vector.
    selected_projects: list[dict[str, Any]] = []
    selected_project_ids: list[str] = []
    spent_cents = 0
    temporary_cents = 0
    permanent_cents = 0

    for intervention in city.interventions:
        units = quantities[intervention.category]
        if units <= 0:
            continue
        total, temporary, permanent = _phase_split_cents(
            intervention, units, cost_multiplier
        )
        spent_cents += total
        temporary_cents += temporary
        permanent_cents += permanent

        for phase, allocation in (("temporary", temporary), ("permanent", permanent)):
            project_id = city.project_id_by_category_phase.get(
                (intervention.category, phase)
            )
            if project_id is None or allocation <= 0:
                # The bundle only renders a phase when its allocation is above
                # zero; an unfunded phase is not part of the portfolio.
                continue
            selected_project_ids.append(project_id)
            selected_projects.append(
                {
                    "projectId": project_id,
                    "cityId": city.city_id,
                    "category": intervention.category,
                    "categoryName": intervention.category_name,
                    "phase": phase,
                    "units": units,
                    "decisionUnit": intervention.decision_unit,
                    "allocationCents": allocation,
                    "usefulLifeYears": intervention.useful_life_years,
                    "isMajorConstruction": intervention.is_major_construction,
                    "isAccessibility": intervention.is_accessibility,
                }
            )

    raw = np.zeros(len(METRIC_DENOMINATORS))
    for j in range(len(names)):
        if solution[j]:
            raw = raw + metric_vectors[j] * int(solution[j])

    attendance = city.tournament_demand * assumptions["attendanceMultiplier"]
    objective_score = float(-(objective @ solution))

    next_best = _next_best_unit(
        city=city,
        quantities=quantities,
        excluded=set(constraints.excluded_intervention_ids),
        normalized_weights=normalized_weights,
        demand_scale=demand_scale,
        transit_scale=transit_scale,
        cost_multiplier=cost_multiplier,
    )

    total_spend = spent_cents or 1  # only used for share reporting
    accessibility_cents = sum(
        p["allocationCents"] for p in selected_projects if p["isAccessibility"]
    )
    major_construction_count = sum(
        1
        for intervention in city.interventions
        if quantities[intervention.category] > 0 and intervention.is_major_construction
    )

    return {
        "cityId": city.city_id,
        "hostRegion": city.host_region,
        "budgetCents": budget_cents,
        "requestedBudgetCents": requested_budget_cents,
        "spentCents": spent_cents,
        "unspentCents": budget_cents - spent_cents,
        "objectiveScore": objective_score,
        "selectedProjectIds": selected_project_ids,
        "selectedProjects": selected_projects,
        "quantitiesByCategory": {k: v for k, v in quantities.items() if v > 0},
        "phaseSplit": {
            "temporaryCents": temporary_cents,
            "permanentCents": permanent_cents,
            "temporaryShare": temporary_cents / total_spend if spent_cents else None,
            "permanentShare": permanent_cents / total_spend if spent_cents else None,
        },
        "accessibilitySpend": {
            "cents": accessibility_cents,
            "share": accessibility_cents / total_spend if spent_cents else None,
            "categories": sorted(ACCESSIBILITY_CATEGORIES),
        },
        "majorConstructionProjectCount": major_construction_count,
        "benefits": {
            "passengerHoursSaved": float(raw[0]) / 60.0,
            "avgMinutesSavedPerAttendee": float(raw[0]) / attendance if attendance else None,
            "vehicleHoursAvoided": float(raw[1]),
            "co2TonnesAvoided": float(raw[2]),
            "accessibleTripsImproved": float(raw[3]),
            "reliabilityRiskPpReduction": float(raw[4]),
            "permanentLegacyValue": float(raw[5]),
        },
        "nextBest": next_best,
        "normalizedWeights": dict(normalized_weights),
        "appliedAssumptions": dict(assumptions),
        "modelVersion": MODEL_VERSION,
        "evidenceClass": MODEL_EVIDENCE_CLASS,
        "solverStatus": solver_status,
        "modelAssumptions": {
            "note": (
                "Every figure in this response is a model output computed from "
                "engineering assumptions, not an observed measurement."
            ),
            "benefitCoefficientsSource": "reference/model_run.py intervention metric vectors",
            "diminishingReturns": {
                "form": "per-unit segment factors",
                "segmentFactors": list(SEGMENT_FACTORS),
            },
            "interactionEffects": {
                "form": "pairwise complementarity credited as a share of the smaller "
                "first-unit benefit",
                "pairs": [
                    {"a": a, "b": b, "factor": factor} for a, b, factor in SYNERGY_PAIRS
                ],
            },
            "accessibilityCategories": sorted(ACCESSIBILITY_CATEGORIES),
            "majorConstructionGeometryTypes": sorted(MAJOR_CONSTRUCTION_GEOMETRY_TYPES),
            "demandScale": demand_scale,
            "transitProductivityScale": transit_scale,
        },
    }


def _next_best_unit(
    *,
    city: CityModel,
    quantities: Mapping[str, int],
    excluded: set[str],
    normalized_weights: Mapping[str, float],
    demand_scale: float,
    transit_scale: float,
    cost_multiplier: float,
) -> dict[str, Any] | None:
    """The best unfunded marginal unit by benefit per dollar.

    This answers "if this city received one more increment of money, where
    should it go?" It ignores any new complementarity the unit would unlock, so
    it is a conservative lower bound on the next unit's value.
    """
    weight_vector = np.zeros(len(METRIC_DENOMINATORS))
    for key, dimension in WEIGHT_TO_DIMENSION.items():
        weight_vector[dimension] = normalized_weights.get(key, 0.0)
    denominators = np.array(METRIC_DENOMINATORS, dtype=float)

    best: tuple[float, str, int, int] | None = None
    for intervention in city.interventions:
        if intervention.category in excluded:
            continue
        funded = quantities.get(intervention.category, 0)
        if funded >= intervention.max_units:
            continue
        vector = (
            _metric_vector(intervention, demand_scale, transit_scale)
            * SEGMENT_FACTORS[funded]
        )
        utility = float(weight_vector @ (vector / denominators))
        unit_cents = _effective_unit_cost_cents(intervention, cost_multiplier)
        if unit_cents <= 0:  # pragma: no cover - defensive
            continue
        candidate = (utility / unit_cents, intervention.category, funded + 1, unit_cents)
        if best is None or candidate > best:
            best = candidate

    if best is None:
        return None
    utility_per_cent, category, unit_number, unit_cents = best
    intervention = city.intervention(category)
    return {
        "interventionId": category,
        "categoryName": intervention.category_name if intervention else None,
        "unitNumber": unit_number,
        "unitCostCents": unit_cents,
        "decisionUnit": intervention.decision_unit if intervention else None,
        "utilityPerMillionCents": utility_per_cent * 1_000_000,
    }
