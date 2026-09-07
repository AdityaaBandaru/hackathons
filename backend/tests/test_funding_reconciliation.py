"""Funding reconciliation in integer cents (CLAUDE.md rules 4 and 5)."""

from __future__ import annotations

import json

import pytest

from app.config import (
    OFFICIAL_ALLOCATION_TOTAL_CENTS,
    PERMANENT_ALLOCATION_TOTAL_CENTS,
    RESERVE_ALLOCATION_TOTAL_CENTS,
    SEED_FILES,
    TEMPORARY_ALLOCATION_TOTAL_CENTS,
)
from app.seed import MoneyError, SeedValidationError, as_cents, dollars_str, load_seed, sum_cents


def test_official_allocations_total_exactly(seed):
    """Rule 5: the 11 official allocations total exactly 10,025,021,200 cents."""
    total = sum_cents(
        (region["officialBudgetCents"] for region in seed.hostRegions), "officialBudgetCents"
    )
    assert total == 10_025_021_200 == OFFICIAL_ALLOCATION_TOTAL_CENTS
    assert len(seed.hostRegions) == 11


def test_modeled_categories_reconcile_to_official_total(seed):
    total = sum_cents(
        (row["modeledCategoryAllocationCents"] for row in seed.funding),
        "modeledCategoryAllocationCents",
    )
    assert total == OFFICIAL_ALLOCATION_TOTAL_CENTS


def test_phase_split_reconciles(seed):
    temporary = sum_cents(
        (row["temporaryAllocationCents"] for row in seed.funding), "temporaryAllocationCents"
    )
    permanent = sum_cents(
        (row["permanentAllocationCents"] for row in seed.funding), "permanentAllocationCents"
    )
    reserve = sum_cents(
        (
            row["modeledCategoryAllocationCents"]
            for row in seed.funding
            if row["category"] == "reserve"
        ),
        "modeledCategoryAllocationCents",
    )
    assert temporary == TEMPORARY_ALLOCATION_TOTAL_CENTS == 4_412_800_000
    assert permanent == PERMANENT_ALLOCATION_TOTAL_CENTS == 5_555_200_000
    assert reserve == RESERVE_ALLOCATION_TOTAL_CENTS == 57_021_200
    assert temporary + permanent + reserve == OFFICIAL_ALLOCATION_TOTAL_CENTS


def test_each_city_reconciles_to_its_own_official_budget(seed):
    for region in seed.hostRegions:
        city_id = region["cityId"]
        rows = seed.funding_by_city_id[city_id]
        assert len(rows) == 13, f"{city_id} should have 12 interventions plus reserve"
        modeled = sum_cents(
            (row["modeledCategoryAllocationCents"] for row in rows),
            "modeledCategoryAllocationCents",
        )
        assert modeled == region["officialBudgetCents"], city_id


def test_all_money_is_integer_cents(seed):
    """No floats anywhere money is stored."""
    for row in seed.funding:
        for field in (
            "officialHostBudgetCents",
            "modeledCategoryAllocationCents",
            "temporaryAllocationCents",
            "permanentAllocationCents",
        ):
            value = row[field]
            assert isinstance(value, int) and not isinstance(value, bool), (field, value)
    for project in seed.projects3d:
        assert isinstance(project["allocationCents"], int)


def test_as_cents_refuses_floats_and_nulls():
    assert as_cents(1234, "x") == 1234
    with pytest.raises(MoneyError):
        as_cents(12.34, "x")
    with pytest.raises(MoneyError):
        as_cents(None, "x")
    with pytest.raises(MoneyError):
        as_cents("1234", "x")


def test_dollars_str_formatting():
    assert dollars_str(10_025_021_200) == "$100,250,212.00"
    assert dollars_str(1) == "$0.01"
    assert dollars_str(-250) == "-$2.50"


def test_broken_reconciliation_fails_startup(tmp_path):
    """If a single cent moves, the application must refuse to start."""
    from app.config import SEED_DIR

    for filename in SEED_FILES.values():
        (tmp_path / filename).write_text(
            (SEED_DIR / filename).read_text(encoding="utf-8"), encoding="utf-8"
        )
    hosts = json.loads((tmp_path / "hostRegions.json").read_text(encoding="utf-8"))
    hosts[0]["officialBudgetCents"] += 1
    (tmp_path / "hostRegions.json").write_text(json.dumps(hosts), encoding="utf-8")

    with pytest.raises(SeedValidationError) as excinfo:
        load_seed(tmp_path)
    names = {failure.name for failure in excinfo.value.failures}
    assert "funding/official-total-cents" in names


def test_float_money_fails_startup(tmp_path):
    from app.config import SEED_DIR

    for filename in SEED_FILES.values():
        (tmp_path / filename).write_text(
            (SEED_DIR / filename).read_text(encoding="utf-8"), encoding="utf-8"
        )
    projects = json.loads((tmp_path / "projects3d.json").read_text(encoding="utf-8"))
    projects[0]["allocationCents"] = 1234.56
    (tmp_path / "projects3d.json").write_text(json.dumps(projects), encoding="utf-8")

    with pytest.raises(SeedValidationError) as excinfo:
        load_seed(tmp_path)
    assert "money/integer-cents" in {f.name for f in excinfo.value.failures}
