"""Seed loader: counts, integrity, provenance and null handling."""

from __future__ import annotations

import json

import pytest

from app.config import EXPECTED_COUNTS, SEED_FILES
from app.seed import SeedLoadError, SeedValidationError, load_seed, validate_seed


def test_every_seed_file_loads(seed):
    for name in SEED_FILES:
        assert seed.dataset(name) is not None, f"{name} did not load"


@pytest.mark.parametrize("dataset,expected", sorted(EXPECTED_COUNTS.items()))
def test_record_counts(seed, dataset, expected):
    assert len(seed.dataset(dataset)) == expected


def test_bundle_headline_counts(seed):
    """The counts named in the Phase 1 acceptance criteria."""
    assert len(seed.hostRegions) == 11
    assert len(seed.funding) == 143
    assert len(seed.pedestrianAreas) == 22
    assert len(seed.projects3d) == 264
    assert len(seed.analogEvents) == 14
    assert len(seed.mlScenarios) == 768


def test_all_integrity_checks_pass(checks):
    assert checks, "no integrity checks ran"
    assert all(result.passed for result in checks)


def test_no_duplicate_project_ids(seed):
    ids = [record["projectId"] for record in seed.projects3d]
    assert len(ids) == len(set(ids)) == 264


def test_no_duplicate_city_ids(seed):
    assert len(seed.city_ids) == len(set(seed.city_ids)) == 11


def test_project_area_ids_resolve(seed):
    for record in seed.projects3d:
        assert record["areaId"] in seed.area_by_id


def test_ml_scenarios_join_to_areas(seed):
    for record in seed.mlScenarios:
        assert record["primaryAreaCode"] in seed.area_by_code


def test_missing_values_stay_null(seed):
    """Rule 6: a null unit cost is null, not zero."""
    reserve_rows = [r for r in seed.funding if r["category"] == "reserve"]
    assert len(reserve_rows) == 11
    assert all(row["typicalUnitCostCents"] is None for row in reserve_rows)
    assert not any(row["typicalUnitCostCents"] == 0 for row in reserve_rows)

    # Analog events with no reported transit boardings keep the gap visible.
    null_boardings = [e for e in seed.analogEvents if e["transitBoardings"] is None]
    assert null_boardings, "expected some analog events without transit boardings"
    assert all(e["transitSourceUrl"] is None for e in null_boardings)


def test_provenance_preserved_on_every_project(seed):
    """Rule 7: evidence class and source URL survive the load."""
    for record in seed.projects3d:
        assert str(record["evidenceClass"]).strip()
        assert str(record["sourceUrl"]).strip()
        assert record["spatialPrecision"]


def test_free_text_evidence_classes_are_not_rejected(seed):
    """The bundle uses free-text evidence classes; the loader keeps them verbatim.

    A closed enum of the nine canonical classes would reject real records, so
    evidenceClass is preserved as written rather than normalised.
    """
    analog_classes = {str(r["evidenceClass"]) for r in seed.analogEvents}
    assert "official NFL gamebook" in analog_classes
    assert "local media citing Eagles spokesperson" in analog_classes

    observed_classes = {str(r["evidenceClass"]) for r in seed.observedSummary}
    assert "observed_final" in observed_classes
    assert "observed_preliminary" in observed_classes


def test_modeled_projects_are_concept_only(seed):
    """Rule 8/9: proposals are concepts on planning anchors, not surveyed sites."""
    for record in seed.projects3d:
        assert record["implementationStatus"] == "concept_only"
        assert record["phase"] in {"temporary", "permanent"}


def test_records_are_read_only(seed):
    with pytest.raises(TypeError):
        seed.projects3d[0]["allocationCents"] = 1  # type: ignore[index]


def test_missing_seed_directory_raises(tmp_path):
    with pytest.raises(SeedLoadError):
        load_seed(tmp_path)


def test_tampered_count_fails_validation(tmp_path, seed):
    """Startup must fail loudly if the bundle stops matching its expected shape."""
    from app.config import SEED_DIR

    for filename in SEED_FILES.values():
        (tmp_path / filename).write_text(
            (SEED_DIR / filename).read_text(encoding="utf-8"), encoding="utf-8"
        )
    hosts = json.loads((tmp_path / "hostRegions.json").read_text(encoding="utf-8"))
    hosts.pop()
    (tmp_path / "hostRegions.json").write_text(json.dumps(hosts), encoding="utf-8")

    with pytest.raises(SeedValidationError) as excinfo:
        load_seed(tmp_path)
    names = {failure.name for failure in excinfo.value.failures}
    assert "count/hostRegions" in names


def test_validation_error_lists_every_failure(seed):
    assert validate_seed(seed)
