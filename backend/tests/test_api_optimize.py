"""POST /api/v1/optimize -- driven by reference/examples/nynj_optimize_request.json.

The example request file is loaded and posted verbatim rather than
re-transcribed here, so these tests exercise the exact payload the bundle
ships as the canonical optimizer request.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

EXAMPLE_REQUEST_PATH = (
    Path(__file__).resolve().parents[2]
    / "reference"
    / "examples"
    / "nynj_optimize_request.json"
)


@pytest.fixture(scope="module")
def example_request() -> dict:
    return json.loads(EXAMPLE_REQUEST_PATH.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def example_result(client, example_request) -> dict:
    response = client.post("/api/v1/optimize", json=example_request)
    assert response.status_code == 200, response.text
    return response.json()


def test_example_request_file_is_the_one_we_expect(example_request):
    """Guard against the fixture drifting away from the shipped example."""
    assert example_request["cityId"] == "nynj"
    assert example_request["budgetCents"] == 1_043_868_100
    assert set(example_request["weights"]) == {
        "travelTime",
        "vehicleCongestion",
        "emissions",
        "accessibility",
        "reliability",
        "permanentLegacy",
    }


def test_optimize_returns_200_for_the_example_request(example_result):
    assert example_result["cityId"] == "nynj"
    assert example_result["hostRegion"] == "New York/New Jersey"


def test_spent_never_exceeds_budget(example_result):
    """Required assertion: spentCents <= budgetCents."""
    assert example_result["spentCents"] <= example_result["budgetCents"]
    assert example_result["budgetCents"] == 1_043_868_100
    assert (
        example_result["unspentCents"]
        == example_result["budgetCents"] - example_result["spentCents"]
    )
    assert example_result["unspentCents"] >= 0


def test_every_selected_project_id_resolves_to_projects3d(example_result, seed):
    """Required assertion: every selected ID is a real projects3d record."""
    assert example_result["selectedProjectIds"]
    for project_id in example_result["selectedProjectIds"]:
        record = seed.project_by_id.get(project_id)
        assert record is not None, f"{project_id} does not exist in projects3d.json"
        assert record["cityId"] == "nynj"
        assert record["phase"] in {"temporary", "permanent"}


def test_selected_projects_agree_with_the_id_list(example_result):
    ids_from_objects = [p["projectId"] for p in example_result["selectedProjects"]]
    assert ids_from_objects == example_result["selectedProjectIds"]


def test_repeated_identical_calls_are_deterministic(client, example_request):
    """Required assertion: identical requests return identical results."""
    payloads = set()
    for _ in range(10):
        response = client.post("/api/v1/optimize", json=example_request)
        assert response.status_code == 200
        payloads.add(json.dumps(response.json(), sort_keys=True))
    assert len(payloads) == 1


def test_weights_are_normalized_server_side(client, example_request):
    normalized = example_request["weights"]
    response = client.post("/api/v1/optimize", json=example_request).json()
    assert pytest.approx(sum(response["normalizedWeights"].values()), abs=1e-12) == 1.0

    scaled = {
        **example_request,
        "weights": {k: v * 100 for k, v in normalized.items()},
    }
    scaled_response = client.post("/api/v1/optimize", json=scaled).json()
    assert (
        scaled_response["quantitiesByCategory"] == response["quantitiesByCategory"]
    )
    assert scaled_response["selectedProjectIds"] == response["selectedProjectIds"]


def test_request_constraints_are_satisfied(example_result, example_request):
    constraints = example_request["constraints"]
    assert (
        example_result["phaseSplit"]["temporaryShare"]
        <= constraints["maximumTemporaryShare"] + 1e-9
    )
    assert (
        example_result["phaseSplit"]["permanentShare"]
        >= constraints["minimumPermanentShare"] - 1e-9
    )
    assert (
        example_result["accessibilitySpend"]["share"]
        >= constraints["minimumAccessibilityShare"] - 1e-9
    )
    assert (
        example_result["majorConstructionProjectCount"]
        <= constraints["maximumMajorConstructionProjects"]
    )


def test_money_is_integer_cents_over_the_wire(example_result):
    for field in ("budgetCents", "spentCents", "unspentCents"):
        assert isinstance(example_result[field], int)
    assert isinstance(example_result["phaseSplit"]["temporaryCents"], int)
    assert (
        example_result["phaseSplit"]["temporaryCents"]
        + example_result["phaseSplit"]["permanentCents"]
        == example_result["spentCents"]
    )


def test_result_is_labelled_as_model_output(example_result):
    """Rule 8: model output is never presented as observed fact."""
    assert example_result["evidenceClass"] == "model_output"
    assert "not an observed measurement" in example_result["modelAssumptions"]["note"]


def test_results_are_not_served_from_model_results_json(client, example_request):
    """Changing the objective must change the answer -- proof nothing is canned."""
    zero = {k: 0.0 for k in example_request["weights"]}

    legacy_only = client.post(
        "/api/v1/optimize",
        json={**example_request, "weights": {**zero, "permanentLegacy": 1.0}, "constraints": {}},
    ).json()
    congestion_only = client.post(
        "/api/v1/optimize",
        json={**example_request, "weights": {**zero, "vehicleCongestion": 1.0}, "constraints": {}},
    ).json()

    assert (
        legacy_only["quantitiesByCategory"] != congestion_only["quantitiesByCategory"]
    )
    assert legacy_only["selectedProjectIds"] != congestion_only["selectedProjectIds"]


def test_budget_override_changes_the_portfolio(client, example_request):
    half = client.post(
        "/api/v1/optimize",
        json={**example_request, "budgetCents": example_request["budgetCents"] // 2},
    ).json()
    assert half["spentCents"] <= half["budgetCents"]
    assert half["spentCents"] < 600_000_000


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------


def test_infeasible_request_returns_structured_explanation(client, example_request):
    """Required assertion: an impossible scenario explains itself, no crash."""
    response = client.post(
        "/api/v1/optimize",
        json={
            **example_request,
            "constraints": {
                "minimumPermanentShare": 0.99,
                "requiredInterventionIds": ["service"],
            },
        },
    )
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["error"] == "infeasible_scenario"
    assert detail["message"]
    assert detail["diagnostics"]
    diagnostic = detail["diagnostics"][0]
    assert diagnostic["code"] == "permanent_share_unreachable"
    assert diagnostic["detail"]["maximumAchievablePermanentShare"] == 0.8
    assert diagnostic["detail"]["achievedBy"] == ["station"]


def test_budget_too_small_returns_structured_explanation(client, example_request):
    response = client.post(
        "/api/v1/optimize",
        json={
            **example_request,
            "budgetCents": 1_000_000,
            "constraints": {"requiredInterventionIds": ["station", "toc", "hub"]},
        },
    )
    assert response.status_code == 422
    diagnostic = response.json()["detail"]["diagnostics"][0]
    assert diagnostic["code"] == "required_exceeds_budget"
    assert diagnostic["detail"]["shortfallCents"] == 274_000_000


def test_contradictory_constraints_return_structured_explanation(client, example_request):
    response = client.post(
        "/api/v1/optimize",
        json={
            **example_request,
            "constraints": {
                "requiredInterventionIds": ["station"],
                "excludedInterventionIds": ["station"],
            },
        },
    )
    assert response.status_code == 422
    assert response.json()["detail"]["diagnostics"][0]["code"] == "required_and_excluded"


def test_unknown_city_returns_400(client, example_request):
    response = client.post("/api/v1/optimize", json={**example_request, "cityId": "atlantis"})
    assert response.status_code == 400
    detail = response.json()["detail"]
    assert detail["error"] == "invalid_scenario"
    assert detail["diagnostics"][0]["code"] == "unknown_city"


def test_unknown_assumption_override_returns_400(client, example_request):
    response = client.post(
        "/api/v1/optimize",
        json={**example_request, "assumptionsOverride": {"magicMultiplier": 2.0}},
    )
    assert response.status_code == 400
    assert (
        response.json()["detail"]["diagnostics"][0]["code"]
        == "unknown_assumption_override"
    )


def test_unknown_request_field_is_rejected(client, example_request):
    response = client.post(
        "/api/v1/optimize", json={**example_request, "notAField": 1}
    )
    assert response.status_code == 422


def test_negative_budget_is_rejected(client, example_request):
    response = client.post(
        "/api/v1/optimize", json={**example_request, "budgetCents": -1}
    )
    assert response.status_code == 422


def test_every_city_can_be_optimized(client, seed, example_request):
    for city_id in seed.city_ids:
        region = seed.host_region_by_city_id[city_id]
        response = client.post(
            "/api/v1/optimize",
            json={
                **example_request,
                "cityId": city_id,
                "budgetCents": region["officialBudgetCents"],
            },
        )
        assert response.status_code == 200, f"{city_id}: {response.text}"
        body = response.json()
        assert body["spentCents"] <= body["budgetCents"]
        for project_id in body["selectedProjectIds"]:
            assert seed.project_by_id[project_id]["cityId"] == city_id
