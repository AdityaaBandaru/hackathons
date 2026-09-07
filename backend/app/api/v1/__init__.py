"""API v1: read-only evidence endpoints over the Phase 1 seed."""

from fastapi import APIRouter

from . import cities, interventions, sources

router = APIRouter(prefix="/api/v1")
router.include_router(cities.router)
router.include_router(interventions.router)
router.include_router(sources.router)

__all__ = ["router"]
