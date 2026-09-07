"""The Phase 1 HTTP surface: GET /health."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_health_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["bundleVersion"] == "2026.09.06-hackathon-v1"


def test_health_reports_loaded_counts(client):
    body = client.get("/health").json()
    counts = body["seed"]["recordCounts"]
    assert counts["hostRegions"] == 11
    assert counts["funding"] == 143
    assert counts["pedestrianAreas"] == 22
    assert counts["projects3d"] == 264
    assert counts["analogEvents"] == 14
    assert counts["mlScenarios"] == 768
    assert body["seed"]["integrityChecksPassed"] > 0
    assert len(body["seed"]["cityIds"]) == 11


def test_seed_available_on_app_state(client):
    assert len(app.state.seed.hostRegions) == 11
