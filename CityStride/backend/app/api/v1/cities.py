"""City evidence API: GET /api/v1/cities and its sub-resources.

Every response is built from the seed loaded in Phase 1. Nothing here
computes or infers a value -- each record keeps the evidenceClass, sourceUrl,
qualifier, unit and methodology note it was loaded with, and a field that is
null in the seed stays null in the response (CLAUDE.md rules 6 and 7).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from ...seed import SeedData
from ..deps import get_city_or_404, get_seed, plain, plain_list

router = APIRouter(prefix="/cities", tags=["cities"])


def _city_summary(seed: SeedData, city_id: str) -> dict[str, Any]:
    """Compose one city's summary from hostRegions, allHostSummary and cityProfiles.

    hostRegions is the base record (also the join target for pedestrianAreaIds
    and evidenceRecordCount); allHostSummary adds the reconciled funding-phase
    breakdown; cityProfiles adds the demand/funding-source fields the base
    record does not carry. All three are keyed 1:1 by cityId in the bundle.
    """
    region = seed.host_region_by_city_id[city_id]
    summary_row = next(
        (row for row in seed.allHostSummary if row.get("cityId") == city_id), None
    )
    profile_row = next(
        (row for row in seed.cityProfiles if row.get("cityId") == city_id), None
    )

    summary: dict[str, Any] = {
        "cityId": region["cityId"],
        "hostRegionCode": region["hostRegionCode"],
        "hostRegion": region["hostRegion"],
        "matches": region["matches"],
        "stadiumCapacity": region["stadiumCapacity"],
        "tournamentDemand": region["tournamentDemand"],
        "demandClass": region["demandClass"],
        "venueAccessType": region["venueAccessType"],
        "adjacentRailStops": region["adjacentRailStops"],
        "transferStructure": region["transferStructure"],
        "dominantBottleneck": region["dominantBottleneck"],
        "pedestrianAreaIds": list(region["pedestrianAreaIds"]),
        "evidenceRecordCount": region["evidenceRecordCount"],
        "funding": {
            "officialBudgetCents": region["officialBudgetCents"],
            "temporaryAllocationCents": (
                summary_row["temporaryAllocationCents"] if summary_row else None
            ),
            "permanentAllocationCents": (
                summary_row["permanentAllocationCents"] if summary_row else None
            ),
            "reserveCents": summary_row["reserveCents"] if summary_row else None,
        },
        "enabledProjectCount": summary_row["enabledProjectCount"] if summary_row else None,
        "analogEventCount": summary_row["analogEventCount"] if summary_row else None,
        "airGateways": profile_row["airGateways"] if profile_row else None,
        "ftaUsdPerAttendee": profile_row["ftaUsdPerAttendee"] if profile_row else None,
        "fundingSourceId": profile_row["fundingSourceId"] if profile_row else None,
    }
    return summary


@router.get("")
def list_cities(seed: SeedData = Depends(get_seed)) -> list[dict[str, Any]]:
    """All 11 host-region city summaries, in bundle order."""
    return [_city_summary(seed, city_id) for city_id in seed.city_ids]


@router.get("/{city_id}")
def get_city(city_id: str, seed: SeedData = Depends(get_seed)) -> dict[str, Any]:
    """One host region's summary, or 404 with the list of valid city IDs."""
    get_city_or_404(seed, city_id)
    return _city_summary(seed, city_id)


@router.get("/{city_id}/evidence")
def get_city_evidence(city_id: str, seed: SeedData = Depends(get_seed)) -> dict[str, Any]:
    """Every evidence record tied to this city, grouped by dataset.

    Tournament-wide records (hostRegion/region == "Tournament") are included
    alongside city-specific ones since they bear on every city's evidence base.
    matchData is populated only for nynj -- it is the New Jersey Transit
    after-action report data and does not exist for any other host region;
    other cities correctly get an empty list rather than an invented one.

    funding is this city's 13 funding.json rows (12 intervention categories
    plus reserve) -- the only place the official/temporary/permanent budget
    figures shown elsewhere (the /cities summary) carry the evidenceClass and
    sourceUrl that justify them.
    """
    region = get_city_or_404(seed, city_id)
    host_region_name = region["hostRegion"]

    evidence_2026 = plain_list(
        record
        for record in seed.evidence2026
        if record["hostRegion"] in (host_region_name, "Tournament")
    )
    observed_summary = plain_list(
        record
        for record in seed.observedSummary
        if record["region"] in (host_region_name, "Tournament")
    )
    analog_events = plain_list(
        record for record in seed.analogEvents if record["hostRegion"] == host_region_name
    )
    pedestrian_areas = plain_list(seed.areas_by_city_id.get(city_id, ()))
    match_data = plain_list(seed.njMatchData) if city_id == "nynj" else []
    funding = plain_list(seed.funding_by_city_id.get(city_id, ()))

    return {
        "cityId": city_id,
        "hostRegion": host_region_name,
        "evidence2026": evidence_2026,
        "observedSummary": observed_summary,
        "analogEvents": analog_events,
        "pedestrianAreas": pedestrian_areas,
        "matchData": match_data,
        "funding": funding,
    }


@router.get("/{city_id}/projects")
def get_city_projects(city_id: str, seed: SeedData = Depends(get_seed)) -> dict[str, Any]:
    """This city's canonical 3D projects, plus nynj's narrative legacy projects.

    projects3d is the canonical renderer identifier set (CLAUDE.md rule 10) --
    every project this endpoint returns as "projects" is one the map and
    optimizer both key off of. legacyProjects is a richer, nynj-only
    descriptive layer used for the hero scenario; each entry is annotated with
    the canonical projectId it corresponds to (via legacyProjectAliases) where
    one is on file, and null where it is not -- the alias table covers 6 of
    the 8 legacy records, and the gap is preserved rather than guessed at.
    """
    region = get_city_or_404(seed, city_id)

    projects = plain_list(seed.projects_by_city_id.get(city_id, ()))

    legacy_projects: list[dict[str, Any]] = []
    if city_id == "nynj":
        aliases: dict[str, Any] = dict(seed.legacyProjectAliases)
        for record in seed.legacyProjects:
            enriched = plain(record)
            enriched["canonicalProjectId"] = aliases.get(record["projectId"])
            legacy_projects.append(enriched)

    return {
        "cityId": city_id,
        "hostRegion": region["hostRegion"],
        "projects": projects,
        "legacyProjects": legacy_projects,
    }
