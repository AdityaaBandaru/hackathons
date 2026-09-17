"""GET /api/v1/interventions and GET /api/v1/sources."""

from __future__ import annotations


def test_list_interventions_returns_all_twelve(client):
    response = client.get("/api/v1/interventions")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 12
    categories = {row["category"] for row in body}
    assert categories == {
        "service",
        "buslane",
        "signals",
        "hub",
        "parkride",
        "ped",
        "bike",
        "tnc",
        "wayfinding",
        "station",
        "toc",
        "access",
    }


def test_interventions_preserve_evidence_and_costs(client):
    body = client.get("/api/v1/interventions").json()
    service = next(row for row in body if row["category"] == "service")
    assert service["categoryName"] == "Extra transit service"
    assert service["evidenceClass"] == "engineering_assumption"
    assert service["typicalUnitCostCents"] == 55_000_000
    assert isinstance(service["typicalUnitCostCents"], int)
    assert service["decisionUnit"] == "2,500 vehicle-hours"


def test_list_sources_returns_all_thirty_six(client):
    response = client.get("/api/v1/sources")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 36


def test_sources_preserve_null_publication_dates(client):
    """14 of the 36 sources have no publicationDate on file -- rule 6: stays null."""
    body = client.get("/api/v1/sources").json()
    null_dates = [row for row in body if row["publicationDate"] is None]
    assert len(null_dates) == 14
    assert all(row["publicationDate"] != 0 for row in body)


def test_sources_have_urls_and_titles(client):
    body = client.get("/api/v1/sources").json()
    for row in body:
        assert row["url"]
        assert row["title"]
        assert row["sourceId"]
