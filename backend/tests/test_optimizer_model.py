"""The MILP model itself: faithfulness to the reference, determinism, money."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.optimizer import (
    InfeasibleScenarioError,
    InvalidScenarioError,
    ScenarioConstraints,
    build_city_model,
    normalize_weights,
    solve,
)
from app.optimizer.parameters import REFERENCE_WEIGHTS

REFERENCE_DIR = Path(__file__).resolve().parents[2] / "reference"

EXAMPLE_WEIGHTS = {
    "travelTime": 0.25,
    "vehicleCongestion": 0.15,
    "emissions": 0.12,
    "accessibility": 0.2,
    "reliability": 0.15,
    "permanentLegacy": 0.13,
}


@pytest.fixture(scope="module")
def reference_results():
    """The reference optimizer's published run, used only to prove faithfulness."""
    return json.loads((REFERENCE_DIR / "model_results.json").read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# Faithfulness: this is a refactor of reference/model_run.py, not a rewrite
# ---------------------------------------------------------------------------


def test_reproduces_reference_model_for_every_city(seed, reference_results):
    """With the reference's own weights and no constraints, the refactored
    optimizer must reproduce reference/model_results.json exactly -- same
    quantities, same spend -- for all 11 host regions."""
    by_city = {row["city"]: row for row in reference_results["base"]}
    for city_id in seed.city_ids:
        city = build_city_model(seed, city_id)
        result = solve(
            city, budget_cents=city.official_budget_cents, weights=REFERENCE_WEIGHTS
        )
        expected = by_city[city.host_region]
        assert result["quantitiesByCategory"] == expected["quantities"], city_id
        assert result["spentCents"] == round(expected["spent_m"] * 100_000_000), city_id


def test_reproduces_the_seeds_own_selected_units(seed):
    """funding.json's selectedUnits are the reference model's output. The
    refactor must land on the same portfolio, which also means its unspent
    budget equals the seed's reserve row."""
    for city_id in seed.city_ids:
        city = build_city_model(seed, city_id)
        result = solve(
            city, budget_cents=city.official_budget_cents, weights=REFERENCE_WEIGHTS
        )
        seeded_units = {
            str(row["category"]): int(row["selectedUnits"])
            for row in seed.funding_by_city_id[city_id]
            if row["category"] != "reserve" and row["selectedUnits"]
        }
        assert result["quantitiesByCategory"] == seeded_units, city_id

        reserve = next(
            row for row in seed.funding_by_city_id[city_id] if row["category"] == "reserve"
        )
        assert result["unspentCents"] == reserve["modeledCategoryAllocationCents"], city_id


# ---------------------------------------------------------------------------
# Determinism
# ---------------------------------------------------------------------------


def test_identical_requests_return_identical_results(seed):
    city = build_city_model(seed, "nynj")
    payloads = [
        json.dumps(
            solve(
                city,
                budget_cents=city.official_budget_cents,
                weights=EXAMPLE_WEIGHTS,
                constraints=ScenarioConstraints(
                    minimum_accessibility_share=0.1,
                    maximum_temporary_share=0.55,
                    minimum_permanent_share=0.35,
                    maximum_major_construction_projects=4,
                ),
            ),
            sort_keys=True,
        )
        for _ in range(15)
    ]
    assert len(set(payloads)) == 1


def test_determinism_holds_for_every_city(seed):
    for city_id in seed.city_ids:
        city = build_city_model(seed, city_id)
        runs = [
            json.dumps(
                solve(
                    city,
                    budget_cents=city.official_budget_cents,
                    weights=EXAMPLE_WEIGHTS,
                ),
                sort_keys=True,
            )
            for _ in range(3)
        ]
        assert len(set(runs)) == 1, city_id


# ---------------------------------------------------------------------------
# Weights
# ---------------------------------------------------------------------------


def test_weights_are_normalized_server_side():
    normalized = normalize_weights(EXAMPLE_WEIGHTS)
    assert pytest.approx(sum(normalized.values()), abs=1e-12) == 1.0


def test_weight_scale_does_not_change_the_answer(seed):
    """Weights are ratios: multiplying them all by 1000 must not move the result."""
    city = build_city_model(seed, "nynj")
    base = solve(city, budget_cents=city.official_budget_cents, weights=EXAMPLE_WEIGHTS)
    scaled = solve(
        city,
        budget_cents=city.official_budget_cents,
        weights={k: v * 1000 for k, v in EXAMPLE_WEIGHTS.items()},
    )
    assert base["quantitiesByCategory"] == scaled["quantitiesByCategory"]
    assert base["spentCents"] == scaled["spentCents"]
    assert pytest.approx(base["objectiveScore"], rel=1e-9) == scaled["objectiveScore"]


def test_zero_and_negative_weights_rejected():
    with pytest.raises(InvalidScenarioError):
        normalize_weights({k: 0.0 for k in EXAMPLE_WEIGHTS})
    with pytest.raises(InvalidScenarioError):
        normalize_weights({**EXAMPLE_WEIGHTS, "travelTime": -1.0})


def test_results_are_recalculated_from_the_requested_weights(seed):
    """Not a canned answer: changing the objective changes the portfolio."""
    city = build_city_model(seed, "nynj")
    budget = city.official_budget_cents
    zero = {k: 0.0 for k in EXAMPLE_WEIGHTS}

    legacy_only = solve(city, budget_cents=budget, weights={**zero, "permanentLegacy": 1.0})
    emissions_only = solve(city, budget_cents=budget, weights={**zero, "emissions": 1.0})
    congestion_only = solve(
        city, budget_cents=budget, weights={**zero, "vehicleCongestion": 1.0}
    )

    portfolios = [
        tuple(sorted(r["quantitiesByCategory"].items()))
        for r in (legacy_only, emissions_only, congestion_only)
    ]
    assert len(set(portfolios)) == 3, "different objectives must give different portfolios"

    # Weighting legacy alone drops the one-year-life intervention entirely.
    assert "service" not in legacy_only["quantitiesByCategory"]
    # tnc has a negative CO2 coefficient, so an emissions-only objective avoids it.
    assert "tnc" not in emissions_only["quantitiesByCategory"]


# ---------------------------------------------------------------------------
# Money: integer cents end to end
# ---------------------------------------------------------------------------


def test_spend_never_exceeds_budget_for_any_city(seed):
    for city_id in seed.city_ids:
        city = build_city_model(seed, city_id)
        result = solve(
            city, budget_cents=city.official_budget_cents, weights=EXAMPLE_WEIGHTS
        )
        assert result["spentCents"] <= result["budgetCents"], city_id
        assert result["unspentCents"] == result["budgetCents"] - result["spentCents"]
        assert result["unspentCents"] >= 0


def test_all_reported_money_is_integer_cents(seed):
    city = build_city_model(seed, "nynj")
    result = solve(city, budget_cents=city.official_budget_cents, weights=EXAMPLE_WEIGHTS)
    for field in ("budgetCents", "spentCents", "unspentCents"):
        assert isinstance(result[field], int), field
    assert isinstance(result["phaseSplit"]["temporaryCents"], int)
    assert isinstance(result["phaseSplit"]["permanentCents"], int)
    for project in result["selectedProjects"]:
        assert isinstance(project["allocationCents"], int)


def test_phase_split_reconciles_to_spend_exactly(seed):
    """Rounding the phase split must not create or lose a cent."""
    for city_id in seed.city_ids:
        city = build_city_model(seed, city_id)
        result = solve(
            city, budget_cents=city.official_budget_cents, weights=EXAMPLE_WEIGHTS
        )
        split = result["phaseSplit"]
        assert split["temporaryCents"] + split["permanentCents"] == result["spentCents"]
        assert (
            sum(p["allocationCents"] for p in result["selectedProjects"])
            == result["spentCents"]
        )


def test_phase_split_matches_the_seeded_allocations(seed):
    """At the reference weights the portfolio matches the seed, so the computed
    per-project allocations must match projects3d.json's own allocationCents."""
    city = build_city_model(seed, "nynj")
    result = solve(city, budget_cents=city.official_budget_cents, weights=REFERENCE_WEIGHTS)
    seeded = {
        str(p["projectId"]): int(p["allocationCents"])
        for p in seed.projects_by_city_id["nynj"]
    }
    for project in result["selectedProjects"]:
        assert project["allocationCents"] == seeded[project["projectId"]], project["projectId"]


# ---------------------------------------------------------------------------
# Project IDs (CLAUDE.md rules 10 and 11)
# ---------------------------------------------------------------------------


def test_every_selected_project_id_resolves_to_a_real_record(seed):
    for city_id in seed.city_ids:
        city = build_city_model(seed, city_id)
        result = solve(
            city, budget_cents=city.official_budget_cents, weights=EXAMPLE_WEIGHTS
        )
        assert result["selectedProjectIds"], city_id
        for project_id in result["selectedProjectIds"]:
            record = seed.project_by_id.get(project_id)
            assert record is not None, f"{project_id} is not in projects3d.json"
            assert record["cityId"] == city_id


def test_selected_project_ids_are_unique_and_scoped_to_the_city(seed):
    city = build_city_model(seed, "nynj")
    result = solve(city, budget_cents=city.official_budget_cents, weights=EXAMPLE_WEIGHTS)
    ids = result["selectedProjectIds"]
    assert len(ids) == len(set(ids))
    assert all(pid.startswith("nynj-") for pid in ids)


def test_unselected_categories_produce_no_project_ids(seed):
    city = build_city_model(seed, "nynj")
    result = solve(
        city,
        budget_cents=city.official_budget_cents,
        weights=EXAMPLE_WEIGHTS,
        constraints=ScenarioConstraints(excluded_intervention_ids=("station", "toc")),
    )
    assert "station" not in result["quantitiesByCategory"]
    assert "toc" not in result["quantitiesByCategory"]
    assert not any("-station-" in pid or "-toc-" in pid for pid in result["selectedProjectIds"])


def test_selected_projects_carry_both_phases_when_both_are_funded(seed):
    city = build_city_model(seed, "nynj")
    result = solve(city, budget_cents=city.official_budget_cents, weights=EXAMPLE_WEIGHTS)
    phases = {p["projectId"]: p["phase"] for p in result["selectedProjects"]}
    assert phases["nynj-service-TMP"] == "temporary"
    assert phases["nynj-service-PERM"] == "permanent"


# ---------------------------------------------------------------------------
# Constraints
# ---------------------------------------------------------------------------


def test_phase_and_accessibility_constraints_are_respected(seed):
    city = build_city_model(seed, "nynj")
    result = solve(
        city,
        budget_cents=city.official_budget_cents,
        weights=EXAMPLE_WEIGHTS,
        constraints=ScenarioConstraints(
            minimum_accessibility_share=0.1,
            maximum_temporary_share=0.55,
            minimum_permanent_share=0.35,
            maximum_major_construction_projects=4,
        ),
    )
    assert result["phaseSplit"]["temporaryShare"] <= 0.55 + 1e-9
    assert result["phaseSplit"]["permanentShare"] >= 0.35 - 1e-9
    assert result["accessibilitySpend"]["share"] >= 0.1 - 1e-9
    assert result["majorConstructionProjectCount"] <= 4


def test_tighter_permanent_floor_shifts_the_portfolio(seed):
    city = build_city_model(seed, "nynj")
    result = solve(
        city,
        budget_cents=city.official_budget_cents,
        weights=EXAMPLE_WEIGHTS,
        constraints=ScenarioConstraints(minimum_permanent_share=0.70),
    )
    assert result["phaseSplit"]["permanentShare"] >= 0.70 - 1e-9


def test_required_and_excluded_interventions_are_honoured(seed):
    city = build_city_model(seed, "nynj")
    result = solve(
        city,
        budget_cents=city.official_budget_cents,
        weights=EXAMPLE_WEIGHTS,
        constraints=ScenarioConstraints(
            required_intervention_ids=("bike", "parkride"),
            excluded_intervention_ids=("station",),
        ),
    )
    assert result["quantitiesByCategory"].get("bike", 0) >= 1
    assert result["quantitiesByCategory"].get("parkride", 0) >= 1
    assert "station" not in result["quantitiesByCategory"]


def test_construction_cap_limits_facility_projects(seed):
    city = build_city_model(seed, "nynj")
    result = solve(
        city,
        budget_cents=city.official_budget_cents,
        weights=EXAMPLE_WEIGHTS,
        constraints=ScenarioConstraints(maximum_major_construction_projects=1),
    )
    assert result["majorConstructionProjectCount"] <= 1


# ---------------------------------------------------------------------------
# Infeasible and invalid scenarios
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "constraints,expected_code",
    [
        (
            ScenarioConstraints(
                required_intervention_ids=("station",),
                excluded_intervention_ids=("station",),
            ),
            "required_and_excluded",
        ),
        (
            ScenarioConstraints(
                minimum_permanent_share=0.99, required_intervention_ids=("service",)
            ),
            "permanent_share_unreachable",
        ),
        (
            ScenarioConstraints(
                maximum_temporary_share=0.05, required_intervention_ids=("service",)
            ),
            "temporary_share_unreachable",
        ),
        (
            ScenarioConstraints(required_intervention_ids=("monorail",)),
            "unknown_intervention_id",
        ),
        (
            ScenarioConstraints(
                maximum_major_construction_projects=0,
                required_intervention_ids=("hub",),
            ),
            "construction_cap_conflict",
        ),
        (
            ScenarioConstraints(
                minimum_accessibility_share=0.5,
                excluded_intervention_ids=("access", "ped", "wayfinding", "station"),
                required_intervention_ids=("service",),
            ),
            "accessibility_share_unreachable",
        ),
    ],
)
def test_infeasible_scenarios_raise_structured_errors(seed, constraints, expected_code):
    """An impossible scenario explains itself; it never crashes."""
    city = build_city_model(seed, "nynj")
    with pytest.raises(InfeasibleScenarioError) as excinfo:
        solve(
            city,
            budget_cents=city.official_budget_cents,
            weights=EXAMPLE_WEIGHTS,
            constraints=constraints,
        )
    payload = excinfo.value.as_dict()
    assert payload["error"] == "infeasible_scenario"
    assert payload["message"]
    assert expected_code in {d["code"] for d in payload["diagnostics"]}
    assert all(d["message"] for d in payload["diagnostics"])


def test_budget_too_small_for_required_interventions(seed):
    city = build_city_model(seed, "nynj")
    with pytest.raises(InfeasibleScenarioError) as excinfo:
        solve(
            city,
            budget_cents=1_000_000,
            weights=EXAMPLE_WEIGHTS,
            constraints=ScenarioConstraints(
                required_intervention_ids=("station", "toc", "hub")
            ),
        )
    detail = next(
        d for d in excinfo.value.as_dict()["diagnostics"] if d["code"] == "required_exceeds_budget"
    )
    assert detail["detail"]["minimumRequiredCents"] == 275_000_000
    assert detail["detail"]["shortfallCents"] == 274_000_000


def test_unknown_city_raises_invalid_scenario(seed):
    with pytest.raises(InvalidScenarioError):
        build_city_model(seed, "atlantis")


def test_unknown_assumption_override_is_rejected_not_ignored(seed):
    city = build_city_model(seed, "nynj")
    with pytest.raises(InvalidScenarioError) as excinfo:
        solve(
            city,
            budget_cents=city.official_budget_cents,
            weights=EXAMPLE_WEIGHTS,
            assumptions={"magicMultiplier": 2.0},
        )
    diagnostic = excinfo.value.as_dict()["diagnostics"][0]
    assert diagnostic["code"] == "unknown_assumption_override"
    assert "attendanceMultiplier" in diagnostic["detail"]["supportedKeys"]


def test_zero_budget_yields_an_empty_portfolio(seed):
    city = build_city_model(seed, "nynj")
    result = solve(city, budget_cents=0, weights=EXAMPLE_WEIGHTS)
    assert result["spentCents"] == 0
    assert result["selectedProjectIds"] == []
    assert result["quantitiesByCategory"] == {}
    assert result["phaseSplit"]["temporaryShare"] is None


# ---------------------------------------------------------------------------
# Evidence labelling (CLAUDE.md rule 8)
# ---------------------------------------------------------------------------


def test_results_are_labelled_as_model_output(seed):
    city = build_city_model(seed, "nynj")
    result = solve(city, budget_cents=city.official_budget_cents, weights=EXAMPLE_WEIGHTS)
    assert result["evidenceClass"] == "model_output"
    assert result["modelVersion"]
    assumptions = result["modelAssumptions"]
    assert "not an observed measurement" in assumptions["note"]
    assert assumptions["diminishingReturns"]["segmentFactors"]
    assert assumptions["interactionEffects"]["pairs"]
    assert assumptions["accessibilityCategories"] == ["access", "ped", "station", "wayfinding"]


def test_next_best_unit_is_reported(seed):
    city = build_city_model(seed, "nynj")
    result = solve(city, budget_cents=city.official_budget_cents, weights=EXAMPLE_WEIGHTS)
    next_best = result["nextBest"]
    assert next_best is not None
    assert next_best["interventionId"]
    assert isinstance(next_best["unitCostCents"], int)
    assert next_best["unitNumber"] >= 1
