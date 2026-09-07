"""API v1: evidence endpoints over the Phase 1 seed, plus the optimizer."""

from fastapi import APIRouter

from . import cities, interventions, optimize, sources

router = APIRouter(prefix="/api/v1")
router.include_router(cities.router)
router.include_router(interventions.router)
router.include_router(optimize.router)
router.include_router(sources.router)

__all__ = ["router"]
