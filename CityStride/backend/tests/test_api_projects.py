"""GET /api/v1/cities/{city_id}/projects."""

from __future__ import annotations


def test_projects_endpoint_shape(client):
    response = client.get("/api/v1/cities/atlanta/projects")
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"cityId", "hostRegion", "projects", "legacyProjects"}
    assert body["cityId"] == "atlanta"
    assert body["hostRegion"] == "Atlanta"


def test_unknown_city_projects_returns_404(client):
    response = client.get("/api/v1/cities/nope/projects")
    assert response.status_code == 404


def test_every_city_has_24_canonical_projects(client):
    for city_id in (
        "atlanta",
        "boston",
        "dallas",
        "houston",
        "kansas-city",
        "los-angeles",
        "miami",
        "nynj",
        "philadelphia",
        "sf-bay",
        "seattle",
    ):
        body = client.get(f"/api/v1/cities/{city_id}/projects").json()
        assert len(body["projects"]) == 24, city_id
        assert all(p["cityId"] == city_id for p in body["projects"])


def test_projects_use_canonical_project_ids(client):
    """CLAUDE.md rule 10: projectId (3D Projects) is the canonical renderer ID."""
    body = client.get("/api/v1/cities/nynj/projects").json()
    project_ids = {p["projectId"] for p in body["projects"]}
    assert "nynj-service-TMP" in project_ids
    assert "nynj-ped-PERM" in project_ids
    assert len(project_ids) == len(body["projects"])  # no duplicates


def test_projects_preserve_evidence_and_source(client):
    body = client.get("/api/v1/cities/atlanta/projects").json()
    for project in body["projects"]:
        assert project["evidenceClass"]
        assert project["sourceUrl"]
        assert project["spatialPrecision"]
        assert project["implementationStatus"] == "concept_only"


def test_only_nynj_has_legacy_projects(client):
    for city_id in ("atlanta", "boston", "seattle", "dallas"):
        body = client.get(f"/api/v1/cities/{city_id}/projects").json()
        assert body["legacyProjects"] == []

    nynj_body = client.get("/api/v1/cities/nynj/projects").json()
    assert len(nynj_body["legacyProjects"]) == 8


def test_legacy_projects_resolve_to_canonical_ids_where_known(client):
    """Legacy (showcase) projectIds are distinct from the canonical projects3d
    IDs; the alias table on file resolves 6 of the 8, and the other 2 stay
    null rather than being guessed at."""
    body = client.get("/api/v1/cities/nynj/projects").json()
    by_id = {p["projectId"]: p for p in body["legacyProjects"]}

    assert by_id["nynj-ped-corridor-01"]["canonicalProjectId"] == "nynj-ped-PERM"
    assert by_id["nynj-tnc-hub-01"]["canonicalProjectId"] == "nynj-tnc-PERM"
    assert by_id["nynj-bus-priority-01"]["canonicalProjectId"] == "nynj-buslane-PERM"
    assert by_id["nynj-station-capacity-01"]["canonicalProjectId"] == "nynj-station-PERM"
    assert by_id["nynj-toc-01"]["canonicalProjectId"] == "nynj-toc-PERM"
    assert by_id["nynj-access-01"]["canonicalProjectId"] == "nynj-access-PERM"

    unaliased = {
        pid: record["canonicalProjectId"]
        for pid, record in by_id.items()
        if pid not in {
            "nynj-ped-corridor-01",
            "nynj-tnc-hub-01",
            "nynj-bus-priority-01",
            "nynj-station-capacity-01",
            "nynj-toc-01",
            "nynj-access-01",
        }
    }
    assert len(unaliased) == 2
    assert all(value is None for value in unaliased.values())


def test_resolved_canonical_ids_are_real_projects3d_records(client):
    body = client.get("/api/v1/cities/nynj/projects").json()
    canonical_ids = {p["projectId"] for p in body["projects"]}
    for legacy in body["legacyProjects"]:
        if legacy["canonicalProjectId"] is not None:
            assert legacy["canonicalProjectId"] in canonical_ids
