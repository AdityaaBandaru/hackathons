"""Intervention library API: GET /api/v1/interventions.

Read-only passthrough of the 12 intervention categories, preserving every
field -- including typicalUnitCostCents, which is present on all 12 here
(unlike the per-city funding rows, where a reserve category legitimately has
no unit cost).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from ...seed import SeedData
from ..deps import get_seed, plain_list

router = APIRouter(prefix="/interventions", tags=["interventions"])


@router.get("")
def list_interventions(seed: SeedData = Depends(get_seed)) -> list[dict[str, Any]]:
    """All 12 intervention categories, in bundle order."""
    return plain_list(seed.interventions)
