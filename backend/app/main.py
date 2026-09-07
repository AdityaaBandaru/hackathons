"""FastAPI application entrypoint.

Phase 1 scope: load and validate the seed bundle at startup, and expose
``GET /health``. The evidence API, optimizer and map arrive in later phases.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

from fastapi import FastAPI, Request

from . import __version__
from .config import BUNDLE_VERSION, CANONICAL_CRS, HERO_SCENARIO_CITY_ID
from .seed import SeedData, load_seed

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)-8s %(name)s: %(message)s"
)
logger = logging.getLogger("app.main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Load the seed before serving. A failure here must stop the process."""
    try:
        seed, checks = load_seed()
    except Exception:
        logger.exception("SEED LOAD FAILED -- refusing to start")
        raise

    app.state.seed = seed
    app.state.seed_checks = checks
    logger.info(
        "startup complete: %d host regions, %d funding rows, %d 3D projects",
        len(seed.hostRegions),
        len(seed.funding),
        len(seed.projects3d),
    )
    yield
    logger.info("shutdown")


app = FastAPI(
    title="World Cup 2026 Host-City Mobility Investment and Legacy Optimizer",
    version=__version__,
    summary=(
        "Evidence-anchored mobility investment optimizer for the 11 U.S. "
        "FIFA World Cup 2026 host regions."
    ),
    lifespan=lifespan,
)


def get_seed(request: Request) -> SeedData:
    """Dependency accessor for the loaded seed."""
    return request.app.state.seed


@app.get("/health", tags=["system"])
def health(request: Request) -> dict[str, Any]:
    """Liveness plus a summary of what was loaded and verified."""
    seed: SeedData = request.app.state.seed
    checks = request.app.state.seed_checks
    return {
        "status": "ok",
        "version": __version__,
        "bundleVersion": BUNDLE_VERSION,
        "canonicalCrs": CANONICAL_CRS,
        "heroScenarioCityId": HERO_SCENARIO_CITY_ID,
        "seed": {
            "datasets": len(seed.record_counts()),
            "recordCounts": dict(seed.record_counts()),
            "integrityChecksPassed": len(checks),
            "cityIds": list(seed.city_ids),
        },
    }
