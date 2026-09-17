"""GET /api/v1/cities/{city_id}/evidence.

The centerpiece of this file is the Match 104 acceptance check: the exact
record from reference/json/njMatchData.json must come back through the API
byte-for-byte on the fields that matter, labeled evidenceClass
"observed_final" -- an after-action report figure, not a model output.
"""

from __future__ import annotations


def test_evidence_endpoint_shape(client):
    response = client.get("/api/v1/cities/atlanta/evidence")
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {
        "cityId",
        "hostRegion",
        "evidence2026",
        "observedSummary",
        "analogEvents",
        "pedestrianAreas",
        "matchData",
        "funding",
    }
    assert body["cityId"] == "atlanta"
    assert body["hostRegion"] == "Atlanta"


def test_evidence_funding_section_has_evidence_class_and_source(client):
    """Every funding row carries the evidenceClass/sourceUrl the /cities
    summary's budget figures otherwise lack."""
    body = client.get("/api/v1/cities/atlanta/evidence").json()
    funding = body["funding"]
    assert len(funding) == 13  # 12 intervention categories + reserve
    categories = {row["category"] for row in funding}
    assert "reserve" in categories
    assert "service" in categories
    for row in funding:
        assert row["evidenceClass"]
        assert row["sourceUrl"]
        assert isinstance(row["modeledCategoryAllocationCents"], int)


def test_evidence_funding_reconciles_to_the_city_summary(client):
    evidence = client.get("/api/v1/cities/nynj/evidence").json()
    summary = client.get("/api/v1/cities/nynj").json()
    total = sum(row["modeledCategoryAllocationCents"] for row in evidence["funding"])
    assert total == summary["funding"]["officialBudgetCents"]


def test_unknown_city_evidence_returns_404(client):
    response = client.get("/api/v1/cities/nope/evidence")
    assert response.status_code == 404


def test_evidence_includes_tournament_wide_records(client):
    """Tournament-scope records (evidenceId WC26-MATCHES etc.) apply to every city."""
    body = client.get("/api/v1/cities/seattle/evidence").json()
    ids = {record["evidenceId"] for record in body["evidence2026"]}
    assert "WC26-MATCHES" in ids  # hostRegion == "Tournament"


def test_evidence_only_matches_this_citys_analog_events(client):
    atlanta = client.get("/api/v1/cities/atlanta/evidence").json()
    seattle = client.get("/api/v1/cities/seattle/evidence").json()
    assert all(e["hostRegion"] == "Atlanta" for e in atlanta["analogEvents"])
    assert all(e["hostRegion"] == "Seattle" for e in seattle["analogEvents"])
    assert atlanta["analogEvents"] != seattle["analogEvents"]


def test_analog_event_null_transit_boardings_preserved(client):
    """Rule 6: a missing transit-boardings figure stays null, not 0."""
    body = client.get("/api/v1/cities/atlanta/evidence").json()
    concert = next(e for e in body["analogEvents"] if e["analogEventId"] == "ATL-CON-2023")
    assert concert["transitBoardings"] is None
    assert concert["transitBoardings"] != 0
    assert concert["transitSourceUrl"] is None
    assert concert["evidenceClass"] == "venue expectation via local media"
    assert concert["qualifier"] == (
        "expected total from stadium officials; not audited observed count"
    )


def test_pedestrian_areas_scoped_to_city(client):
    body = client.get("/api/v1/cities/nynj/evidence").json()
    area_ids = {area["areaId"] for area in body["pedestrianAreas"]}
    assert area_ids == {"nynj-meadowlands-station", "nynj-american-dream-corridor"}
    for area in body["pedestrianAreas"]:
        assert area["evidenceClass"]
        assert area["sourceUrl"]


def test_evidence_2026_preserves_unit_and_qualifier(client):
    body = client.get("/api/v1/cities/nynj/evidence").json()
    matches_row = next(r for r in body["evidence2026"] if r["evidenceId"] == "WC26-MATCHES")
    assert matches_row["value"] == 104
    assert matches_row["unit"] == "matches"
    assert matches_row["qualifier"] == "exact"
    assert matches_row["evidenceClass"] == "observed_final"
    assert matches_row["sourceUrl"]


def test_non_nynj_city_has_no_match_data(client):
    """njMatchData is New Jersey Transit's after-action report -- it does not
    exist for any other host region, and the API must not invent it."""
    for city_id in ("atlanta", "boston", "seattle", "dallas"):
        body = client.get(f"/api/v1/cities/{city_id}/evidence").json()
        assert body["matchData"] == []


def test_nynj_match_data_has_all_nine_records(client):
    body = client.get("/api/v1/cities/nynj/evidence").json()
    assert len(body["matchData"]) == 9
    match_numbers = {row["matchNo"] for row in body["matchData"]}
    assert match_numbers == {"Plan", 7, 17, 41, 56, 67, 77, 91, 104}


def test_match_104_matches_the_source_record_exactly(client):
    """The acceptance check: Match 104 (Spain vs Argentina) must come back
    through the API exactly as recorded in the after-action report."""
    body = client.get("/api/v1/cities/nynj/evidence").json()
    match_104 = next(row for row in body["matchData"] if row["matchNo"] == 104)

    assert match_104["fixture"] == "Spain vs Argentina"
    assert match_104["ticketHolders"] == 80_663
    assert match_104["uberCount"] == 16_200
    assert match_104["hostShuttles"] == 11_168
    assert match_104["njtEgress"] == 21_024
    assert match_104["njtEgressMin"] == 60
    assert match_104["americanDreamPedestrians"] == 65_000

    # Not a modeled or planned figure -- an observed, final after-action number.
    assert match_104["recordType"] == "match"
    assert match_104["evidenceClass"] == "observed_final"
    assert match_104["sourceId"] == "njt-aar-2026"
    assert match_104["sourceUrl"] == (
        "https://www.njtransit.com/press-releases/"
        "new-jersey-interagency-transportation-after-action-report-aar-njny-stadium-fifa"
    )


def test_match_104_matches_reference_json_byte_for_byte(client, seed):
    """Cross-check the API response against the raw seed record directly,
    rather than against hand-transcribed expected values."""
    body = client.get("/api/v1/cities/nynj/evidence").json()
    api_match_104 = next(row for row in body["matchData"] if row["matchNo"] == 104)

    source_match_104 = next(
        dict(record) for record in seed.njMatchData if record["matchNo"] == 104
    )
    assert api_match_104 == source_match_104
