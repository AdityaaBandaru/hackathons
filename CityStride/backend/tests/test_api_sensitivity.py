"""POST /api/v1/optimize/sensitivity."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.optimizer.sensitivity import AXIS_NAMES

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
def sweep(client, example_request) -> dict:
    response = client.post("/api/v1/optimize/sensitivity", json=example_request)
    assert response.status_code == 200, response.text
    return response.json()


def test_sweep_covers_every_task_spec_axis(sweep):
    """Research_and_Modeling_Task.md Part 13: attendance, budget, costs,
    transit capacity and visitor transit usage."""
    assert {axis["axis"] for axis in sweep["axes"]} == set(AXIS_NAMES)
    assert sweep["summary"]["axesTested"] == 5
    assert sweep["summary"]["pointsEvaluated"] == 15


def test_baseline_matches_a_plain_optimize_call(client, example_request, sweep):
    direct = client.post("/api/v1/optimize", json=example_request).json()
    assert sweep["baseline"]["quantitiesByCategory"] == direct["quantitiesByCategory"]
    assert sweep["baseline"]["spentCents"] == direct["spentCents"]
    assert sweep["baseline"]["selectedProjectIds"] == direct["selectedProjectIds"]


def test_every_feasible_point_respects_its_budget(sweep):
    for axis in sweep["axes"]:
        for point in axis["points"]:
            if point["feasible"]:
                assert point["spentCents"] <= point["budgetCents"], (
                    axis["axis"],
                    point["label"],
                )


def test_every_point_selects_only_real_projects(sweep, seed):
    for axis in sweep["axes"]:
        for point in axis["points"]:
            if not point["feasible"]:
                continue
            for project_id in point["selectedProjectIds"]:
                assert seed.project_by_id.get(project_id) is not None
                assert seed.project_by_id[project_id]["cityId"] == "nynj"


def test_baseline_points_do_not_change_the_portfolio(sweep):
    """The multiplier-1.0 point on each axis must reproduce the baseline."""
    for axis in sweep["axes"]:
        neutral = [p for p in axis["points"] if p["multiplier"] == 1.0]
        assert neutral, axis["axis"]
        for point in neutral:
            assert point["portfolioChanged"] is False, axis["axis"]
            assert point["quantitiesByCategory"] == sweep["baseline"]["quantitiesByCategory"]


def test_budget_axis_moves_spend_in_the_expected_direction(sweep):
    budget_axis = next(a for a in sweep["axes"] if a["axis"] == "budget")
    by_label = {p["label"]: p for p in budget_axis["points"]}
    assert by_label["-25%"]["spentCents"] < by_label["baseline"]["spentCents"]
    assert by_label["+25%"]["spentCents"] > by_label["baseline"]["spentCents"]
    assert by_label["-25%"]["objectiveScore"] < by_label["+25%"]["objectiveScore"]


def test_sweep_reports_where_the_portfolio_changed(sweep):
    """The point of the sweep: say whether the recommendation actually holds."""
    summary = sweep["summary"]
    assert isinstance(summary["pointsWherePortfolioChanged"], list)
    assert isinstance(summary["portfolioStable"], bool)
    changed_in_axes = {
        f"{axis['axis']}:{point['label']}"
        for axis in sweep["axes"]
        for point in axis["points"]
        if point["feasible"] and point["portfolioChanged"]
    }
    assert set(summary["pointsWherePortfolioChanged"]) == changed_in_axes


def test_changed_points_report_which_projects_moved(sweep):
    for axis in sweep["axes"]:
        for point in axis["points"]:
            if point["feasible"] and point["portfolioChanged"]:
                assert "projectIdsAdded" in point
                assert "projectIdsRemoved" in point


def test_axis_subset_can_be_requested(client, example_request):
    response = client.post(
        "/api/v1/optimize/sensitivity", json={**example_request, "axes": ["budget"]}
    )
    assert response.status_code == 200
    body = response.json()
    assert [axis["axis"] for axis in body["axes"]] == ["budget"]
    assert body["summary"]["pointsEvaluated"] == 3


def test_unknown_axis_returns_400(client, example_request):
    response = client.post(
        "/api/v1/optimize/sensitivity", json={**example_request, "axes": ["weather"]}
    )
    assert response.status_code == 400
    diagnostic = response.json()["detail"]["diagnostics"][0]
    assert diagnostic["code"] == "unknown_sensitivity_axis"
    assert "budget" in diagnostic["detail"]["validAxes"]


def test_sensitivity_is_deterministic(client, example_request):
    payloads = set()
    for _ in range(3):
        response = client.post(
            "/api/v1/optimize/sensitivity",
            json={**example_request, "axes": ["budget", "attendance"]},
        )
        assert response.status_code == 200
        payloads.add(json.dumps(response.json(), sort_keys=True))
    assert len(payloads) == 1


def test_infeasible_baseline_returns_structured_explanation(client, example_request):
    response = client.post(
        "/api/v1/optimize/sensitivity",
        json={
            **example_request,
            "constraints": {
                "requiredInterventionIds": ["station"],
                "excludedInterventionIds": ["station"],
            },
        },
    )
    assert response.status_code == 422
    assert response.json()["detail"]["error"] == "infeasible_scenario"


def test_infeasible_point_is_reported_inline_not_as_a_failure(client, example_request):
    """A budget cut that breaks a required portfolio is a finding, not a 500.

    The baseline here is feasible; the -25% budget point is not, because the
    required interventions no longer fit.
    """
    response = client.post(
        "/api/v1/optimize/sensitivity",
        json={
            **example_request,
            "budgetCents": 280_000_000,
            "constraints": {"requiredInterventionIds": ["station", "toc", "hub"]},
            "axes": ["budget"],
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    budget_axis = body["axes"][0]
    infeasible = [p for p in budget_axis["points"] if not p["feasible"]]
    assert infeasible, "expected the -25% budget point to be infeasible"
    assert infeasible[0]["infeasibility"]["error"] == "infeasible_scenario"
    assert body["summary"]["infeasiblePoints"]
    # The rest of the sweep still completed.
    assert any(p["feasible"] for p in budget_axis["points"])


def test_sensitivity_result_is_labelled_as_model_output(sweep):
    assert sweep["evidenceClass"] == "model_output"
    assert sweep["baseline"]["evidenceClass"] == "model_output"
