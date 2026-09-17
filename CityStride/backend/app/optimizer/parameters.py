"""Engineering-assumption constants carried over from ``reference/model_run.py``.

Everything in this module is a modeling assumption, not an observation
(CLAUDE.md rule 8). The values are transcribed verbatim from the reference
optimizer so that the API reproduces its published results exactly; they are
kept here, rather than in the seed, because the seed bundle does not carry
them.

What *is* in the seed and therefore read from it instead of hard-coded here:
per-city budgets (``officialBudgetCents``), tournament demand
(``tournamentDemand``), per-city productivity multipliers
(``cityMultipliers.json``), and per-intervention unit costs, phase shares and
useful life (``interventions.json``). All four were verified to reproduce the
reference model's hard-coded tables exactly.
"""

from __future__ import annotations

from typing import Final, Mapping

# ---------------------------------------------------------------------------
# Benefit dimensions
# ---------------------------------------------------------------------------

# The five operational metric families from reference/model_run.py, plus a
# sixth legacy dimension that the reference model does not have. The API
# request carries six weights (reference/types/datasets.ts OptimizeRequest);
# the sixth, permanentLegacy, needs a dimension to weight.
METRIC_DIMENSIONS: Final[tuple[str, ...]] = (
    "passengerMinutesSaved",
    "vehicleHoursAvoided",
    "co2TonnesAvoided",
    "accessibleTripsImproved",
    "reliabilityRiskPpReduction",
    "permanentLegacyValue",
)

# Request weight key -> index into METRIC_DIMENSIONS.
WEIGHT_TO_DIMENSION: Final[Mapping[str, int]] = {
    "travelTime": 0,
    "vehicleCongestion": 1,
    "emissions": 2,
    "accessibility": 3,
    "reliability": 4,
    "permanentLegacy": 5,
}

# Denominators that make one unit's metric families commensurate. The first
# five are reference/model_run.py's DENOM verbatim. The sixth normalises the
# legacy dimension so that a full unit delivering 200,000 passenger-minutes,
# entirely permanent, with a 15-year life scores 1.0.
METRIC_DENOMINATORS: Final[tuple[float, ...]] = (
    200_000.0,
    8_000.0,
    50.0,
    10_000.0,
    1.5,
    200_000.0 * 15.0,
)

# reference/model_run.py WEIGHTS, extended with permanentLegacy=0 so that the
# default request reproduces the reference model exactly.
REFERENCE_WEIGHTS: Final[Mapping[str, float]] = {
    "travelTime": 0.30,
    "vehicleCongestion": 0.20,
    "emissions": 0.15,
    "accessibility": 0.20,
    "reliability": 0.15,
    "permanentLegacy": 0.0,
}

# ---------------------------------------------------------------------------
# Per-intervention modeling assumptions (reference/model_run.py `I`)
# ---------------------------------------------------------------------------

# category -> (max fundable units, five-metric vector per unit).
# The metric vector is (passenger-minutes, vehicle-hours, CO2 tonnes,
# accessible passenger-trips, reliability-risk percentage points).
INTERVENTION_ASSUMPTIONS: Final[Mapping[str, tuple[int, tuple[float, ...]]]] = {
    "service": (5, (180_000, 4_000, 45, 8_000, 1.7)),
    "buslane": (4, (210_000, 8_000, 70, 10_000, 1.1)),
    "signals": (4, (70_000, 7_000, 30, 2_000, 0.5)),
    "hub": (4, (190_000, 6_000, 60, 14_000, 1.3)),
    "parkride": (3, (80_000, 5_000, 15, 6_000, 0.5)),
    "ped": (3, (55_000, 1_500, 12, 9_000, 0.7)),
    "bike": (2, (35_000, 1_000, 18, 3_000, 0.2)),
    "tnc": (3, (120_000, 11_000, -5, 4_000, 0.8)),
    "wayfinding": (2, (45_000, 500, 4, 7_000, 0.6)),
    "station": (3, (240_000, 2_500, 25, 18_000, 2.4)),
    "toc": (2, (150_000, 13_000, 45, 5_000, 1.5)),
    "access": (2, (40_000, 400, 1, 8_000, 0.4)),
}

# Diminishing returns: the nth unit of an intervention delivers this share of
# the first unit's benefit (reference/model_run.py SEG_FACTORS).
SEGMENT_FACTORS: Final[tuple[float, ...]] = (1.0, 0.74, 0.53, 0.37, 0.25)

# Demand scaling denominator: multipliers are calibrated to a 500,000-attendee
# host region (reference/model_run.py `dscale`).
DEMAND_REFERENCE_ATTENDANCE: Final[float] = 500_000.0

# Complementary pairs and the share of the smaller first-unit benefit that
# funding both together adds (reference/model_run.py SYNERGIES). Held as a
# tuple, not a dict, so variable ordering is fixed and results are
# reproducible.
SYNERGY_PAIRS: Final[tuple[tuple[str, str, float], ...]] = (
    ("service", "buslane", 0.22),
    ("service", "hub", 0.18),
    ("service", "station", 0.15),
    ("tnc", "toc", 0.18),
    ("wayfinding", "station", 0.08),
)

# ---------------------------------------------------------------------------
# Constraint category sets
# ---------------------------------------------------------------------------

# Categories counted toward `minimumAccessibilityShare`. These are the four
# whose temporary and permanent fixes describe getting people to and through
# the venue on foot, with a disability, or while navigating an unfamiliar
# system: ADA/microtransit access, protected pedestrian corridors, multilingual
# wayfinding, and station entry/circulation capacity. This grouping is an
# engineering assumption and is reported as one on every response.
ACCESSIBILITY_CATEGORIES: Final[frozenset[str]] = frozenset(
    {"access", "ped", "wayfinding", "station"}
)

# Geometry types in interventions.json that denote a built facility rather
# than a surface treatment, a piece of point equipment, or an operating plan.
# `maximumMajorConstructionProjects` counts selected categories whose
# defaultGeometryType is one of these -- deriving the set from the bundle
# rather than hand-listing categories.
MAJOR_CONSTRUCTION_GEOMETRY_TYPES: Final[frozenset[str]] = frozenset(
    {"polygon_extrusion", "glb_model"}
)

# `defaultAreaTarget` value marking an intervention whose productivity depends
# on the transit network, used by the transit-capacity and transit-usage
# sensitivity levers.
TRANSIT_AREA_TARGET: Final[str] = "transit"

# ---------------------------------------------------------------------------
# Assumption overrides
# ---------------------------------------------------------------------------

# Supported `assumptionsOverride` keys and their default (no-op) values.
# An unrecognised key is rejected rather than silently ignored.
SUPPORTED_ASSUMPTION_OVERRIDES: Final[Mapping[str, float]] = {
    "attendanceMultiplier": 1.0,
    "budgetMultiplier": 1.0,
    "costMultiplier": 1.0,
    "transitCapacityMultiplier": 1.0,
    "visitorTransitUsageMultiplier": 1.0,
}

ASSUMPTION_OVERRIDE_MIN: Final[float] = 0.1
ASSUMPTION_OVERRIDE_MAX: Final[float] = 10.0

MODEL_VERSION: Final[str] = "milp-v1"
MODEL_EVIDENCE_CLASS: Final[str] = "model_output"

# Solver time limit, seconds (reference/model_run.py options).
SOLVER_TIME_LIMIT_SECONDS: Final[float] = 10.0
