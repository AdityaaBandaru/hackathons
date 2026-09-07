"""Request models for the optimizer endpoints.

Field names follow ``reference/types/datasets.ts`` OptimizeRequest so the
frontend contract in Phase 4 matches what the bundle already documents.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class OptimizeWeights(BaseModel):
    """The six objective weights. Normalised server-side, so any scale works."""

    model_config = ConfigDict(extra="forbid")

    travelTime: float = Field(default=0.0, ge=0.0)
    vehicleCongestion: float = Field(default=0.0, ge=0.0)
    emissions: float = Field(default=0.0, ge=0.0)
    accessibility: float = Field(default=0.0, ge=0.0)
    reliability: float = Field(default=0.0, ge=0.0)
    permanentLegacy: float = Field(default=0.0, ge=0.0)


class OptimizeConstraints(BaseModel):
    """Portfolio constraints. Every field is optional; omitted means unbounded."""

    model_config = ConfigDict(extra="forbid")

    minimumAccessibilityShare: float | None = Field(default=None, ge=0.0, le=1.0)
    maximumTemporaryShare: float | None = Field(default=None, ge=0.0, le=1.0)
    minimumPermanentShare: float | None = Field(default=None, ge=0.0, le=1.0)
    maximumMajorConstructionProjects: int | None = Field(default=None, ge=0)
    requiredInterventionIds: list[str] = Field(default_factory=list)
    excludedInterventionIds: list[str] = Field(default_factory=list)


class OptimizeRequest(BaseModel):
    """A single portfolio optimization request."""

    model_config = ConfigDict(extra="forbid")

    cityId: str
    budgetCents: int = Field(
        ge=0, description="Budget in integer cents. Money is never a float."
    )
    weights: OptimizeWeights
    constraints: OptimizeConstraints = Field(default_factory=OptimizeConstraints)
    assumptionsOverride: dict[str, float] = Field(default_factory=dict)


class SensitivityRequest(OptimizeRequest):
    """A sensitivity sweep around a base scenario.

    ``axes`` selects which sweeps to run; omitting it runs all of them.
    """

    model_config = ConfigDict(extra="forbid")

    axes: list[str] | None = Field(
        default=None,
        description="Subset of sensitivity axis names to run. Omit to run every axis.",
    )


def to_scenario_kwargs(request: OptimizeRequest) -> dict[str, Any]:
    """Translate the wire request into solve() keyword arguments."""
    from .model import ScenarioConstraints

    constraints = request.constraints
    return {
        "budget_cents": request.budgetCents,
        "weights": request.weights.model_dump(),
        "constraints": ScenarioConstraints(
            minimum_accessibility_share=constraints.minimumAccessibilityShare,
            maximum_temporary_share=constraints.maximumTemporaryShare,
            minimum_permanent_share=constraints.minimumPermanentShare,
            maximum_major_construction_projects=constraints.maximumMajorConstructionProjects,
            required_intervention_ids=tuple(constraints.requiredInterventionIds),
            excluded_intervention_ids=tuple(constraints.excludedInterventionIds),
        ),
        "assumptions": dict(request.assumptionsOverride),
    }
