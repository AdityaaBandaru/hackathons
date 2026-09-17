"""GET /api/v1/cities and /api/v1/cities/{city_id}."""

from __future__ import annotations

EXPECTED_CITY_IDS = {
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
}


def test_list_cities_returns_all_eleven(client):
    response = client.get("/api/v1/cities")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 11
    assert {city["cityId"] for city in body} == EXPECTED_CITY_IDS


def test_list_cities_preserves_funding_breakdown(client):
    body = client.get("/api/v1/cities").json()
    atlanta = next(city for city in body if city["cityId"] == "atlanta")
    assert atlanta["hostRegion"] == "Atlanta"
    assert atlanta["funding"]["officialBudgetCents"] == 939_101_800
    assert atlanta["funding"]["temporaryAllocationCents"] == 398_100_000
    assert atlanta["funding"]["permanentAllocationCents"] == 540_900_000
    assert atlanta["funding"]["reserveCents"] == 101_800
    # integer cents, never floats
    for field in ("officialBudgetCents", "temporaryAllocationCents", "permanentAllocationCents"):
        assert isinstance(atlanta["funding"][field], int)


def test_list_cities_funding_reconciles_per_city(client):
    """Every city's funding breakdown in the API reconciles the same way the seed does."""
    body = client.get("/api/v1/cities").json()
    for city in body:
        funding = city["funding"]
        assert (
            funding["temporaryAllocationCents"]
            + funding["permanentAllocationCents"]
            + funding["reserveCents"]
            == funding["officialBudgetCents"]
        )


def test_get_city_matches_list_entry(client):
    list_body = client.get("/api/v1/cities").json()
    detail_body = client.get("/api/v1/cities/nynj").json()
    from_list = next(city for city in list_body if city["cityId"] == "nynj")
    assert detail_body == from_list


def test_get_city_unknown_returns_404_with_valid_ids(client):
    response = client.get("/api/v1/cities/atlantis")
    assert response.status_code == 404
    detail = response.json()["detail"]
    assert detail["error"] == "city_not_found"
    assert detail["cityId"] == "atlantis"
    assert set(detail["validCityIds"]) == EXPECTED_CITY_IDS


def test_nynj_city_summary_has_the_hero_scenario_shape(client):
    body = client.get("/api/v1/cities/nynj").json()
    assert body["hostRegion"] == "New York/New Jersey"
    assert body["stadiumCapacity"] == 80663
    assert body["matches"] == 8
    assert body["pedestrianAreaIds"] == [
        "nynj-meadowlands-station",
        "nynj-american-dream-corridor",
    ]
