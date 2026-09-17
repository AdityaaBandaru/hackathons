"""The in-memory seed container.

Records are held as the raw mappings parsed from JSON, deliberately. Narrowing
them into models with fixed fields would drop qualifiers, methodology notes and
source URLs that CLAUDE.md rule 7 requires us to preserve, and would reject the
free-text ``evidenceClass`` values the real bundle uses (for example
"official NFL gamebook"). Validation is enforced separately, in validation.py,
on the fields we actually depend on.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from types import MappingProxyType
from typing import Any, Iterable, Mapping, Sequence

Record = Mapping[str, Any]


def _index(records: Sequence[Record], key: str) -> Mapping[Any, Record]:
    """Index records by a unique key, keeping the first occurrence."""
    out: dict[Any, Record] = {}
    for record in records:
        identifier = record.get(key)
        if identifier is not None and identifier not in out:
            out[identifier] = record
    return MappingProxyType(out)


def _group(records: Sequence[Record], key: str) -> Mapping[Any, tuple[Record, ...]]:
    """Group records by a repeated key."""
    out: dict[Any, list[Record]] = {}
    for record in records:
        out.setdefault(record.get(key), []).append(record)
    return MappingProxyType({k: tuple(v) for k, v in out.items()})


@dataclass(frozen=True)
class SeedData:
    """Every seed dataset, loaded once at startup and never mutated."""

    allHostSummary: tuple[Record, ...]
    analogEvents: tuple[Record, ...]
    cityMultipliers: tuple[Record, ...]
    cityProfiles: tuple[Record, ...]
    codebook: tuple[Record, ...]
    dataDictionary: tuple[Record, ...]
    evidence2026: tuple[Record, ...]
    funding: tuple[Record, ...]
    hostRegions: tuple[Record, ...]
    interventions: tuple[Record, ...]
    legacyProjects: tuple[Record, ...]
    mlScenarios: tuple[Record, ...]
    modelOutputs: tuple[Record, ...]
    njMatchData: tuple[Record, ...]
    observedSummary: tuple[Record, ...]
    pedestrianAreas: tuple[Record, ...]
    projects3d: tuple[Record, ...]
    sources: tuple[Record, ...]
    legacyProjectAliases: Mapping[str, Any]
    nynjHackathonContext: Mapping[str, Any]

    # Lookups derived on construction.
    host_region_by_city_id: Mapping[str, Record] = field(init=False, repr=False)
    project_by_id: Mapping[str, Record] = field(init=False, repr=False)
    area_by_id: Mapping[str, Record] = field(init=False, repr=False)
    area_by_code: Mapping[int, Record] = field(init=False, repr=False)
    source_by_id: Mapping[str, Record] = field(init=False, repr=False)
    intervention_by_category: Mapping[str, Record] = field(init=False, repr=False)
    funding_by_city_id: Mapping[str, tuple[Record, ...]] = field(init=False, repr=False)
    projects_by_city_id: Mapping[str, tuple[Record, ...]] = field(init=False, repr=False)
    areas_by_city_id: Mapping[str, tuple[Record, ...]] = field(init=False, repr=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "host_region_by_city_id", _index(self.hostRegions, "cityId"))
        object.__setattr__(self, "project_by_id", _index(self.projects3d, "projectId"))
        object.__setattr__(self, "area_by_id", _index(self.pedestrianAreas, "areaId"))
        object.__setattr__(self, "area_by_code", _index(self.pedestrianAreas, "areaCode"))
        object.__setattr__(self, "source_by_id", _index(self.sources, "sourceId"))
        object.__setattr__(
            self, "intervention_by_category", _index(self.interventions, "category")
        )
        object.__setattr__(self, "funding_by_city_id", _group(self.funding, "cityId"))
        object.__setattr__(self, "projects_by_city_id", _group(self.projects3d, "cityId"))
        object.__setattr__(self, "areas_by_city_id", _group(self.pedestrianAreas, "cityId"))

    @property
    def city_ids(self) -> tuple[str, ...]:
        """Canonical host-region city IDs, in bundle order."""
        return tuple(str(region["cityId"]) for region in self.hostRegions)

    def dataset(self, name: str) -> Sequence[Record] | Mapping[str, Any]:
        """Fetch a dataset by its seed name."""
        try:
            return getattr(self, name)
        except AttributeError as exc:  # pragma: no cover - defensive
            raise KeyError(f"unknown dataset: {name}") from exc

    def record_counts(self) -> Mapping[str, int]:
        """Record count per list-shaped dataset, for /health and diagnostics."""
        counts: dict[str, int] = {}
        for key, value in vars(self).items():
            if key.startswith("_") or not isinstance(value, tuple):
                continue
            counts[key] = len(value)
        return MappingProxyType(counts)


def freeze_records(raw: Iterable[Any], source: str) -> tuple[Record, ...]:
    """Normalise a parsed JSON array into a tuple of read-only mappings."""
    records: list[Record] = []
    for position, item in enumerate(raw):
        if not isinstance(item, dict):
            raise TypeError(
                f"{source}[{position}] must be a JSON object, got {type(item).__name__}"
            )
        records.append(MappingProxyType(item))
    return tuple(records)
