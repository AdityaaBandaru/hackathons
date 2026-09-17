"""Shared FastAPI dependencies for the API layer.

Phase 2 scope: read-only access to the in-memory seed loaded at startup
(Phase 1). No database, no write paths.
"""

from __future__ import annotations

from typing import Any, Iterable

from fastapi import HTTPException, Request

from ..seed import Record, SeedData


def get_seed(request: Request) -> SeedData:
    """Return the seed data loaded into app.state at startup."""
    return request.app.state.seed


def plain(record: Record) -> dict[str, Any]:
    """Materialize one seed record (a read-only mapping) into a plain dict.

    Seed records are stored as ``MappingProxyType`` so nothing downstream can
    mutate them (Phase 1). FastAPI's response serializer does not know how to
    encode that type, so every record must pass through this before it is
    returned from an endpoint.
    """
    return dict(record)


def plain_list(records: Iterable[Record]) -> list[dict[str, Any]]:
    """Materialize a sequence of seed records into a list of plain dicts."""
    return [plain(record) for record in records]


def get_city_or_404(seed: SeedData, city_id: str) -> Record:
    """Resolve a host region by cityId, or raise a structured 404.

    The 404 body lists the valid IDs rather than leaving the caller to guess --
    there are only 11 of them.
    """
    region = seed.host_region_by_city_id.get(city_id)
    if region is None:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "city_not_found",
                "cityId": city_id,
                "validCityIds": sorted(seed.city_ids),
            },
        )
    return region
