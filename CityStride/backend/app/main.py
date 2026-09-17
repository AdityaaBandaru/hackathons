"""FastAPI application entrypoint.

Phase 1 scope: load and validate the seed bundle at startup, and expose
``GET /health``.

Phase 2 scope: the read-only evidence API under ``/api/v1`` (cities,
interventions, sources).

Phase 3 scope: the mixed-integer portfolio optimizer at ``/api/v1/optimize``
and ``/api/v1/optimize/sensitivity``. The map arrives in a later phase.
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .api.v1 import router as api_v1_router
from .config import BUNDLE_VERSION, CANONICAL_CRS, HERO_SCENARIO_CITY_ID
from .seed import SeedData, load_seed

# The Phase 4 frontend runs on a different origin (Next.js dev server, by
# default localhost:3000) and calls this API directly from the browser, so it
# needs CORS headers. No cookies or credentials cross this boundary -- the API
# is read-only plus a stateless optimizer -- so an explicit origin allowlist is
# enough; nothing here needs `allow_credentials`. Overridable via
# CORS_ALLOWED_ORIGINS (comma-separated) for a non-default frontend port/host.
DEFAULT_CORS_ORIGINS = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
)

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


_configured_origins = os.environ.get("CORS_ALLOWED_ORIGINS")
_cors_origins = (
    tuple(origin.strip() for origin in _configured_origins.split(",") if origin.strip())
    if _configured_origins
    else DEFAULT_CORS_ORIGINS
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(_cors_origins),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(api_v1_router)


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
