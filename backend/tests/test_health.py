"""The Phase 1 HTTP surface: GET /health."""

from __future__ import annotations

from app.main import app


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


def test_cors_allows_the_default_frontend_origin(client):
    """Phase 4's frontend (localhost:3000) must be able to call this API
    directly from the browser."""
    response = client.get("/health", headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_cors_rejects_an_unlisted_origin(client):
    response = client.get("/health", headers={"Origin": "http://evil.example.com"})
    assert response.status_code == 200  # simple GET still succeeds...
    assert "access-control-allow-origin" not in response.headers  # ...but not cross-origin
