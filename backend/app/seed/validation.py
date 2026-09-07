"""Startup integrity checks for the seed bundle.

Nothing in this module repairs data. Every check either passes or records a
failure, and a failing load raises :class:`SeedValidationError` so the process
dies loudly instead of serving numbers that no longer reconcile.

The checks mirror ``reference/scripts/validate_bundle.py`` and add the
application-level rules from CLAUDE.md: integer-cents money (rule 4), the exact
official allocation total (rule 5), missing values preserved as null rather than
zeroed (rule 6), and provenance retained on every record (rule 7).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Sequence

from ..config import (
    CENTS_FIELDS,
    EXPECTED_COUNTS,
    OFFICIAL_ALLOCATION_TOTAL_CENTS,
    PERMANENT_ALLOCATION_TOTAL_CENTS,
    PROJECT_PHASES,
    RESERVE_ALLOCATION_TOTAL_CENTS,
    RESERVE_CATEGORY,
    TEMPORARY_ALLOCATION_TOTAL_CENTS,
)
from .money import is_cents
from .schema import Record, SeedData

# Datasets that must carry a non-empty evidenceClass on every record.
EVIDENCE_CLASS_REQUIRED: tuple[str, ...] = (
    "analogEvents",
    "cityMultipliers",
    "evidence2026",
    "funding",
    "interventions",
    "legacyProjects",
    "modelOutputs",
    "njMatchData",
    "observedSummary",
    "pedestrianAreas",
    "projects3d",
)

# Datasets that must carry a non-empty sourceUrl on every record.
SOURCE_URL_REQUIRED: tuple[str, ...] = (
    "evidence2026",
    "funding",
    "njMatchData",
    "observedSummary",
    "pedestrianAreas",
    "projects3d",
)

# (dataset, key) pairs whose values must be unique across the dataset.
UNIQUE_KEYS: tuple[tuple[str, str], ...] = (
    ("hostRegions", "cityId"),
    ("hostRegions", "hostRegionCode"),
    ("projects3d", "projectId"),
    ("pedestrianAreas", "areaId"),
    ("pedestrianAreas", "areaCode"),
    ("sources", "sourceId"),
    ("evidence2026", "evidenceId"),
    ("observedSummary", "observationId"),
    ("analogEvents", "analogEventId"),
    ("interventions", "category"),
    ("interventions", "categoryCode"),
    ("mlScenarios", "scenarioID"),
    ("cityProfiles", "cityId"),
    ("legacyProjects", "projectId"),
)


class SeedValidationError(RuntimeError):
    """Raised when the seed bundle fails one or more integrity checks."""

    def __init__(self, failures: Sequence["CheckResult"]) -> None:
        self.failures = tuple(failures)
        lines = "\n".join(f"  FAIL {f.name}: {f.detail}" for f in self.failures)
        super().__init__(
            f"seed validation failed with {len(self.failures)} error(s):\n{lines}"
        )


@dataclass(frozen=True)
class CheckResult:
    name: str
    passed: bool
    detail: str = ""


class _Checker:
    def __init__(self) -> None:
        self.results: list[CheckResult] = []

    def check(self, name: str, condition: bool, detail: str = "") -> bool:
        self.results.append(CheckResult(name, bool(condition), detail))
        return bool(condition)

    def equals(self, name: str, actual: Any, expected: Any) -> bool:
        return self.check(
            name, actual == expected, f"expected {expected!r}, got {actual!r}"
        )


def _sum_field(records: Iterable[Record], field: str) -> int:
    """Sum an integer-cents field, treating a null as an error rather than 0."""
    total = 0
    for record in records:
        value = record.get(field)
        if not is_cents(value):
            raise ValueError(
                f"{field}={value!r} is not integer cents on record "
                f"{record.get('projectId') or record.get('cityId') or '<unknown>'}"
            )
        total += int(value)
    return total


def validate_seed(seed: SeedData) -> tuple[CheckResult, ...]:
    """Run every integrity check. Raises SeedValidationError on any failure."""
    checker = _Checker()

    _check_counts(checker, seed)
    _check_money_typing(checker, seed)
    _check_funding_reconciliation(checker, seed)
    _check_uniqueness(checker, seed)
    _check_referential_integrity(checker, seed)
    _check_provenance(checker, seed)
    _check_domain_invariants(checker, seed)

    results = tuple(checker.results)
    failures = [result for result in results if not result.passed]
    if failures:
        raise SeedValidationError(failures)
    return results


def _check_counts(checker: _Checker, seed: SeedData) -> None:
    for dataset, expected in EXPECTED_COUNTS.items():
        records = seed.dataset(dataset)
        checker.equals(f"count/{dataset}", len(records), expected)  # type: ignore[arg-type]


def _check_money_typing(checker: _Checker, seed: SeedData) -> None:
    """Money is integer cents or explicitly null -- never a float, never coerced.

    A null is allowed and preserved (rule 6); what is rejected is a float, a
    bool, or a string standing in for an amount.
    """
    offenders: list[str] = []
    nulls_preserved = 0
    for dataset in EXPECTED_COUNTS:
        records = seed.dataset(dataset)
        if not isinstance(records, tuple):
            continue
        for position, record in enumerate(records):
            for field in CENTS_FIELDS & record.keys():
                value = record[field]
                if value is None:
                    nulls_preserved += 1
                    continue
                if not is_cents(value):
                    offenders.append(
                        f"{dataset}[{position}].{field}={value!r}"
                        f" ({type(value).__name__})"
                    )
    checker.check(
        "money/integer-cents",
        not offenders,
        f"{len(offenders)} non-integer money field(s): {offenders[:5]}",
    )
    checker.check(
        "money/nulls-preserved",
        True,
        f"{nulls_preserved} null money field(s) kept as null, not zeroed",
    )

    negatives = [
        f"{record.get('projectId') or record.get('cityId')}.{field}={record[field]}"
        for dataset in ("funding", "projects3d", "hostRegions")
        for record in seed.dataset(dataset)  # type: ignore[union-attr]
        for field in CENTS_FIELDS & record.keys()
        if is_cents(record[field]) and record[field] < 0
    ]
    checker.check(
        "money/non-negative-allocations", not negatives, f"negative: {negatives[:5]}"
    )


def _check_funding_reconciliation(checker: _Checker, seed: SeedData) -> None:
    """The reconciliation CLAUDE.md rule 5 pins, plus its per-city breakdown."""
    official_total = _sum_field(seed.hostRegions, "officialBudgetCents")
    checker.equals(
        "funding/official-total-cents", official_total, OFFICIAL_ALLOCATION_TOTAL_CENTS
    )

    category_total = _sum_field(seed.funding, "modeledCategoryAllocationCents")
    checker.equals("funding/category-total-cents", category_total, official_total)

    temporary_total = _sum_field(seed.funding, "temporaryAllocationCents")
    permanent_total = _sum_field(seed.funding, "permanentAllocationCents")
    reserve_total = _sum_field(
        (r for r in seed.funding if r.get("category") == RESERVE_CATEGORY),
        "modeledCategoryAllocationCents",
    )
    checker.equals(
        "funding/temporary-total-cents", temporary_total, TEMPORARY_ALLOCATION_TOTAL_CENTS
    )
    checker.equals(
        "funding/permanent-total-cents", permanent_total, PERMANENT_ALLOCATION_TOTAL_CENTS
    )
    checker.equals(
        "funding/reserve-total-cents", reserve_total, RESERVE_ALLOCATION_TOTAL_CENTS
    )
    checker.equals(
        "funding/phase-plus-reserve-reconciliation",
        temporary_total + permanent_total + reserve_total,
        official_total,
    )

    # Each host region's own categories must reconcile to its official budget.
    for region in seed.hostRegions:
        city_id = str(region["cityId"])
        rows = seed.funding_by_city_id.get(city_id, ())
        checker.equals(
            f"funding/city-reconciliation/{city_id}",
            _sum_field(rows, "modeledCategoryAllocationCents"),
            region["officialBudgetCents"],
        )
        stated = {r.get("officialHostBudgetCents") for r in rows}
        checker.equals(
            f"funding/city-budget-consistency/{city_id}",
            stated,
            {region["officialBudgetCents"]},
        )


def _check_uniqueness(checker: _Checker, seed: SeedData) -> None:
    for dataset, key in UNIQUE_KEYS:
        records = seed.dataset(dataset)
        values = [record.get(key) for record in records]  # type: ignore[union-attr]
        missing = [i for i, value in enumerate(values) if value is None]
        duplicates = sorted(
            {value for value in values if value is not None and values.count(value) > 1}
        )
        checker.check(
            f"unique/{dataset}.{key}",
            not duplicates and not missing,
            f"duplicates={duplicates[:5]} missing_at={missing[:5]}",
        )


def _check_referential_integrity(checker: _Checker, seed: SeedData) -> None:
    city_ids = set(seed.host_region_by_city_id)
    area_ids = set(seed.area_by_id)
    area_codes = set(seed.area_by_code)
    source_ids = set(seed.source_by_id)
    categories = set(seed.intervention_by_category) | {RESERVE_CATEGORY}

    def _orphans(records: Sequence[Record], field: str, allowed: set[Any]) -> list[Any]:
        return sorted(
            {
                record.get(field)
                for record in records
                if record.get(field) not in allowed
            },
            key=repr,
        )

    for dataset, field, allowed, label in (
        (seed.funding, "cityId", city_ids, "funding.cityId"),
        (seed.projects3d, "cityId", city_ids, "projects3d.cityId"),
        (seed.pedestrianAreas, "cityId", city_ids, "pedestrianAreas.cityId"),
        (seed.cityProfiles, "cityId", city_ids, "cityProfiles.cityId"),
        (seed.projects3d, "areaId", area_ids, "projects3d.areaId"),
        (seed.mlScenarios, "primaryAreaCode", area_codes, "mlScenarios.primaryAreaCode"),
        (seed.funding, "category", categories, "funding.category"),
        (seed.projects3d, "category", categories, "projects3d.category"),
    ):
        orphans = _orphans(dataset, field, allowed)
        checker.check(f"fk/{label}", not orphans, f"unresolved: {orphans[:5]}")

    # Host regions declare their pedestrian areas; each must exist.
    for region in seed.hostRegions:
        declared = region.get("pedestrianAreaIds") or []
        unknown = [area_id for area_id in declared if area_id not in area_ids]
        checker.check(
            f"fk/hostRegions.pedestrianAreaIds/{region.get('cityId')}",
            not unknown,
            f"unknown area IDs: {unknown}",
        )

    # Source IDs, where a record cites one, must resolve to the registry.
    cited = [
        (record.get("sourceId"), dataset_name)
        for dataset_name in ("njMatchData", "observedSummary")
        for record in seed.dataset(dataset_name)  # type: ignore[union-attr]
        if record.get("sourceId") is not None
    ]
    unresolved = sorted({sid for sid, _ in cited if sid not in source_ids})
    checker.check("fk/sourceId-registry", not unresolved, f"unresolved: {unresolved[:5]}")


def _check_provenance(checker: _Checker, seed: SeedData) -> None:
    """Rule 7: provenance survives the load on every record that carries it."""
    for dataset in EVIDENCE_CLASS_REQUIRED:
        records = seed.dataset(dataset)
        blank = [
            position
            for position, record in enumerate(records)  # type: ignore[arg-type]
            if not str(record.get("evidenceClass") or "").strip()
        ]
        checker.check(
            f"provenance/evidenceClass/{dataset}",
            not blank,
            f"{len(blank)} record(s) missing evidenceClass at {blank[:5]}",
        )

    for dataset in SOURCE_URL_REQUIRED:
        records = seed.dataset(dataset)
        blank = [
            position
            for position, record in enumerate(records)  # type: ignore[arg-type]
            if not str(record.get("sourceUrl") or "").strip()
        ]
        checker.check(
            f"provenance/sourceUrl/{dataset}",
            not blank,
            f"{len(blank)} record(s) missing sourceUrl at {blank[:5]}",
        )


def _check_domain_invariants(checker: _Checker, seed: SeedData) -> None:
    bad_phases = sorted(
        {
            record.get("phase")
            for record in seed.projects3d
            if record.get("phase") not in PROJECT_PHASES
        },
        key=repr,
    )
    checker.check("domain/projects3d.phase", not bad_phases, f"unexpected: {bad_phases}")

    # Rule 8/9: modeled proposals are concepts, and their coordinates are
    # planning anchors. Both facts must be present on every record.
    not_concept = [
        record.get("projectId")
        for record in seed.projects3d
        if record.get("implementationStatus") != "concept_only"
    ]
    checker.check(
        "domain/projects3d.concept-only", not not_concept, f"offenders: {not_concept[:5]}"
    )
    missing_precision = [
        record.get("projectId")
        for record in seed.projects3d
        if not str(record.get("spatialPrecision") or "").strip()
    ]
    checker.check(
        "domain/projects3d.spatialPrecision",
        not missing_precision,
        f"missing on: {missing_precision[:5]}",
    )

    out_of_range = [
        record.get("projectId")
        for record in seed.projects3d
        if not (
            isinstance(record.get("latitude"), (int, float))
            and isinstance(record.get("longitude"), (int, float))
            and -90 <= float(record["latitude"]) <= 90
            and -180 <= float(record["longitude"]) <= 180
        )
    ]
    checker.check(
        "domain/projects3d.coordinates", not out_of_range, f"invalid: {out_of_range[:5]}"
    )

    # Pedestrian area shares partition each city exactly once.
    for city_id, areas in seed.areas_by_city_id.items():
        share = sum(float(area.get("areaShare", 0.0)) for area in areas)
        checker.check(
            f"domain/areaShare/{city_id}",
            abs(share - 1.0) < 1e-9,
            f"shares sum to {share!r}",
        )

    # Every intervention category appears once per host region in funding.
    expected_categories = set(seed.intervention_by_category) | {RESERVE_CATEGORY}
    for city_id, rows in seed.funding_by_city_id.items():
        present = {row.get("category") for row in rows}
        checker.equals(f"domain/funding-categories/{city_id}", present, expected_categories)
