"""Static configuration and the invariants the seed bundle must satisfy.

Every constant here is transcribed from the verified bundle
(``reference/validation_report.json``, bundle version 2026.09.06-hackathon-v1).
They are hard expectations: if the seed data stops matching them, the
application refuses to start rather than serving numbers we cannot defend.
"""

from __future__ import annotations

from pathlib import Path
from typing import Final

APP_ROOT: Final[Path] = Path(__file__).resolve().parent
SEED_DIR: Final[Path] = APP_ROOT / "data" / "seed"

BUNDLE_VERSION: Final[str] = "2026.09.06-hackathon-v1"
HERO_SCENARIO_CITY_ID: Final[str] = "nynj"
CANONICAL_CRS: Final[str] = "EPSG:4326"

# Seed file stem -> filename. Every one of these is loaded at startup.
SEED_FILES: Final[dict[str, str]] = {
    "allHostSummary": "allHostSummary.json",
    "analogEvents": "analogEvents.json",
    "cityMultipliers": "cityMultipliers.json",
    "cityProfiles": "cityProfiles.json",
    "codebook": "codebook.json",
    "dataDictionary": "dataDictionary.json",
    "evidence2026": "evidence2026.json",
    "funding": "funding.json",
    "hostRegions": "hostRegions.json",
    "interventions": "interventions.json",
    "legacyProjectAliases": "legacyProjectAliases.json",
    "legacyProjects": "legacyProjects.json",
    "mlScenarios": "mlScenarios.json",
    "modelOutputs": "modelOutputs.json",
    "njMatchData": "njMatchData.json",
    "nynjHackathonContext": "nynjHackathonContext.json",
    "observedSummary": "observedSummary.json",
    "pedestrianAreas": "pedestrianAreas.json",
    "projects3d": "projects3d.json",
    "sources": "sources.json",
}

# Exact record counts from the bundle validation report.
EXPECTED_COUNTS: Final[dict[str, int]] = {
    "hostRegions": 11,
    "funding": 143,
    "pedestrianAreas": 22,
    "evidence2026": 21,
    "analogEvents": 14,
    "projects3d": 264,
    "interventions": 12,
    "mlScenarios": 768,
    "njMatchData": 9,
    "sources": 36,
    "cityProfiles": 11,
    "cityMultipliers": 11,
    "modelOutputs": 11,
    "allHostSummary": 11,
    "legacyProjects": 8,
}

# Funding reconciliation, in integer cents. CLAUDE.md rule 5 pins the first one.
OFFICIAL_ALLOCATION_TOTAL_CENTS: Final[int] = 10_025_021_200
TEMPORARY_ALLOCATION_TOTAL_CENTS: Final[int] = 4_412_800_000
PERMANENT_ALLOCATION_TOTAL_CENTS: Final[int] = 5_555_200_000
RESERVE_ALLOCATION_TOTAL_CENTS: Final[int] = 57_021_200

RESERVE_CATEGORY: Final[str] = "reserve"
PROJECT_PHASES: Final[frozenset[str]] = frozenset({"temporary", "permanent"})

# Fields carrying money. They must be integers (cents) or explicitly null --
# never floats, never silently zeroed.
CENTS_FIELDS: Final[frozenset[str]] = frozenset(
    name
    for name in (
        "officialBudgetCents",
        "officialHostBudgetCents",
        "typicalUnitCostCents",
        "modeledCategoryAllocationCents",
        "temporaryAllocationCents",
        "permanentAllocationCents",
        "allocationCents",
        "budgetCents",
        "spentCents",
        "unspentCents",
        "nextUnitCostCents",
        "reserveCents",
        "temporaryAllocationCents",
        "permanentAllocationCents",
    )
)

# Provenance fields that must survive the load untouched (CLAUDE.md rule 7).
PROVENANCE_FIELDS: Final[tuple[str, ...]] = (
    "evidenceClass",
    "qualifier",
    "sourceUrl",
    "sourceId",
    "methodologyNote",
    "volumeBasis",
    "spatialPrecision",
    "calibrationReason",
    "recommendedModelUse",
    "modelUse",
)
