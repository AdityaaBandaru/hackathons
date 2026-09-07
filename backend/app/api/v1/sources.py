"""Source registry API: GET /api/v1/sources.

Read-only passthrough of the 36-entry source registry. 14 of the 36 records
have no publicationDate on file; that stays null rather than being guessed at
or coerced to an empty string.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from ...seed import SeedData
from ..deps import get_seed, plain_list

router = APIRouter(prefix="/sources", tags=["sources"])


@router.get("")
def list_sources(seed: SeedData = Depends(get_seed)) -> list[dict[str, Any]]:
    """All 36 registered sources, in bundle order."""
    return plain_list(seed.sources)
