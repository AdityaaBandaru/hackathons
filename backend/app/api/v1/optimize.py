"""Optimizer API: POST /api/v1/optimize and /api/v1/optimize/sensitivity.

Both endpoints recalculate from the request's own weights and constraints on
every call. Nothing is served from reference/model_results.json.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from ...optimizer import (
    InfeasibleScenarioError,
    InvalidScenarioError,
    OptimizeRequest,
    SensitivityRequest,
    build_city_model,
    run_sensitivity,
    solve,
    to_scenario_kwargs,
)
from ...seed import SeedData
from ..deps import get_seed

router = APIRouter(prefix="/optimize", tags=["optimizer"])

# A scenario that cannot be solved is a well-formed request the model cannot
# satisfy, not a server fault -- 422, with the reason in the body.
INFEASIBLE_STATUS = 422
INVALID_STATUS = 400


@router.post("")
def optimize(
    request: OptimizeRequest, seed: SeedData = Depends(get_seed)
) -> dict[str, Any]:
    """Solve one host region's investment portfolio.

    Returns canonical projects3d project IDs (CLAUDE.md rules 10 and 11) --
    the caller renders those IDs, it does not invent selected objects.
    """
    try:
        city = build_city_model(seed, request.cityId)
        return solve(city, **to_scenario_kwargs(request))
    except InvalidScenarioError as exc:
        raise HTTPException(status_code=INVALID_STATUS, detail=exc.as_dict()) from exc
    except InfeasibleScenarioError as exc:
        raise HTTPException(status_code=INFEASIBLE_STATUS, detail=exc.as_dict()) from exc


@router.post("/sensitivity")
def optimize_sensitivity(
    request: SensitivityRequest, seed: SeedData = Depends(get_seed)
) -> dict[str, Any]:
    """Re-solve the scenario across the assumption axes and report what moved."""
    try:
        city = build_city_model(seed, request.cityId)
        kwargs = to_scenario_kwargs(request)
        return run_sensitivity(city, axes=request.axes, **kwargs)
    except InvalidScenarioError as exc:
        raise HTTPException(status_code=INVALID_STATUS, detail=exc.as_dict()) from exc
    except InfeasibleScenarioError as exc:
        # Only reached when the baseline itself is infeasible; individual
        # sensitivity points that fail are reported inline instead.
        raise HTTPException(status_code=INFEASIBLE_STATUS, detail=exc.as_dict()) from exc
