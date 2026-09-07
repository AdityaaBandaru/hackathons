"""Sensitivity analysis across the assumption axes named in the task spec.

Research_and_Modeling_Task.md Part 13 asks whether the optimal portfolio holds
up when the assumptions are wrong. Each axis re-solves the same scenario with
one assumption multiplier moved, and reports whether the chosen portfolio
changed -- a portfolio that only works under one set of assumptions is not a
useful recommendation.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Sequence

from .model import CityModel, ScenarioConstraints, solve


@dataclass(frozen=True)
class SensitivityPoint:
    label: str
    multiplier: float


@dataclass(frozen=True)
class SensitivityAxis:
    """One assumption swept across several values."""

    name: str
    assumption_key: str
    description: str
    points: tuple[SensitivityPoint, ...]


# The Part 13 axes. Baseline (multiplier 1.0) is included on every axis so the
# sweep is self-contained and each axis can be read on its own.
SENSITIVITY_AXES: tuple[SensitivityAxis, ...] = (
    SensitivityAxis(
        name="attendance",
        assumption_key="attendanceMultiplier",
        description="Tournament demand 80% / 100% / 120% of the seeded figure.",
        points=(
            SensitivityPoint("80%", 0.8),
            SensitivityPoint("baseline", 1.0),
            SensitivityPoint("120%", 1.2),
        ),
    ),
    SensitivityAxis(
        name="budget",
        assumption_key="budgetMultiplier",
        description="Available budget minus 25% / baseline / plus 25%.",
        points=(
            SensitivityPoint("-25%", 0.75),
            SensitivityPoint("baseline", 1.0),
            SensitivityPoint("+25%", 1.25),
        ),
    ),
    SensitivityAxis(
        name="interventionCosts",
        assumption_key="costMultiplier",
        description="Unit costs minus 20% / baseline / plus 20%.",
        points=(
            SensitivityPoint("-20%", 0.8),
            SensitivityPoint("baseline", 1.0),
            SensitivityPoint("+20%", 1.2),
        ),
    ),
    SensitivityAxis(
        name="transitCapacity",
        assumption_key="transitCapacityMultiplier",
        description=(
            "Transit capacity minus 20% / baseline / plus 20%. Scales the "
            "productivity of interventions whose defaultAreaTarget is transit."
        ),
        points=(
            SensitivityPoint("-20%", 0.8),
            SensitivityPoint("baseline", 1.0),
            SensitivityPoint("+20%", 1.2),
        ),
    ),
    SensitivityAxis(
        name="visitorTransitUsage",
        assumption_key="visitorTransitUsageMultiplier",
        description=(
            "Visitor transit mode share low / medium / high. Acts on the same "
            "transit-targeted interventions as transitCapacity; this MVP model "
            "does not separate transit supply from transit demand."
        ),
        points=(
            SensitivityPoint("low", 0.8),
            SensitivityPoint("medium", 1.0),
            SensitivityPoint("high", 1.2),
        ),
    ),
)

AXIS_NAMES: tuple[str, ...] = tuple(axis.name for axis in SENSITIVITY_AXES)


def run_sensitivity(
    city: CityModel,
    *,
    budget_cents: int,
    weights: Mapping[str, float],
    constraints: ScenarioConstraints | None = None,
    assumptions: Mapping[str, float] | None = None,
    axes: Sequence[str] | None = None,
) -> dict[str, Any]:
    """Solve the baseline, then re-solve once per sensitivity point.

    Points that turn out to be infeasible are reported as such rather than
    aborting the whole sweep -- a budget cut that makes a required portfolio
    impossible is a finding, not an error.
    """
    from .errors import Diagnostic, InfeasibleScenarioError, InvalidScenarioError

    base_assumptions = dict(assumptions or {})
    baseline = solve(
        city,
        budget_cents=budget_cents,
        weights=weights,
        constraints=constraints,
        assumptions=base_assumptions,
    )
    baseline_quantities = baseline["quantitiesByCategory"]
    baseline_project_ids = set(baseline["selectedProjectIds"])

    selected_axes = SENSITIVITY_AXES
    if axes is not None:
        requested = list(dict.fromkeys(axes))
        unknown = [name for name in requested if name not in AXIS_NAMES]
        if unknown:
            raise InvalidScenarioError(
                f"unknown sensitivity axis: {', '.join(unknown)}",
                [
                    Diagnostic(
                        "unknown_sensitivity_axis",
                        "requested a sensitivity axis the model does not define",
                        {"unknownAxes": unknown, "validAxes": list(AXIS_NAMES)},
                    )
                ],
            )
        selected_axes = tuple(a for a in SENSITIVITY_AXES if a.name in set(requested))

    axis_results: list[dict[str, Any]] = []
    changed_points: list[str] = []
    infeasible_points: list[str] = []
    evaluated = 0

    for axis in selected_axes:
        points: list[dict[str, Any]] = []
        for point in axis.points:
            point_assumptions = dict(base_assumptions)
            point_assumptions[axis.assumption_key] = (
                base_assumptions.get(axis.assumption_key, 1.0) * point.multiplier
            )
            evaluated += 1
            try:
                result = solve(
                    city,
                    budget_cents=budget_cents,
                    weights=weights,
                    constraints=constraints,
                    assumptions=point_assumptions,
                )
            except InfeasibleScenarioError as exc:
                infeasible_points.append(f"{axis.name}:{point.label}")
                points.append(
                    {
                        "label": point.label,
                        "multiplier": point.multiplier,
                        "feasible": False,
                        "infeasibility": exc.as_dict(),
                    }
                )
                continue

            portfolio_changed = result["quantitiesByCategory"] != baseline_quantities
            if portfolio_changed:
                changed_points.append(f"{axis.name}:{point.label}")
            selected_ids = set(result["selectedProjectIds"])
            points.append(
                {
                    "label": point.label,
                    "multiplier": point.multiplier,
                    "feasible": True,
                    "budgetCents": result["budgetCents"],
                    "spentCents": result["spentCents"],
                    "unspentCents": result["unspentCents"],
                    "objectiveScore": result["objectiveScore"],
                    "quantitiesByCategory": result["quantitiesByCategory"],
                    "selectedProjectIds": result["selectedProjectIds"],
                    "phaseSplit": result["phaseSplit"],
                    "benefits": result["benefits"],
                    "portfolioChanged": portfolio_changed,
                    "projectIdsAdded": sorted(selected_ids - baseline_project_ids),
                    "projectIdsRemoved": sorted(baseline_project_ids - selected_ids),
                }
            )
        axis_results.append(
            {
                "axis": axis.name,
                "assumptionKey": axis.assumption_key,
                "description": axis.description,
                "points": points,
            }
        )

    return {
        "cityId": city.city_id,
        "hostRegion": city.host_region,
        "baseline": baseline,
        "axes": axis_results,
        "summary": {
            "axesTested": len(axis_results),
            "pointsEvaluated": evaluated,
            "pointsWherePortfolioChanged": changed_points,
            "infeasiblePoints": infeasible_points,
            "portfolioStable": not changed_points and not infeasible_points,
        },
        "evidenceClass": baseline["evidenceClass"],
        "modelVersion": baseline["modelVersion"],
    }
