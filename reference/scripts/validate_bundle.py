#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def load(name):
    return json.loads((ROOT / "json" / name).read_text(encoding="utf-8"))

hosts = load("hostRegions.json")
funding = load("funding.json")
areas = load("pedestrianAreas.json")
projects = load("projects3d.json")
analogs = load("analogEvents.json")
ml = load("mlScenarios.json")
sources = load("sources.json")

checks = []
def check(name, condition, detail=""):
    checks.append((name, bool(condition), detail))

check("host regions", len(hosts) == 11, str(len(hosts)))
check("funding rows", len(funding) == 143, str(len(funding)))
check("pedestrian areas", len(areas) == 22, str(len(areas)))
check("3D phase records", len(projects) == 264, str(len(projects)))
check("analog events", len(analogs) == 14, str(len(analogs)))
check("ML scenarios", len(ml) == 768, str(len(ml)))

official_total = sum(h["officialBudgetCents"] for h in hosts)
category_total = sum(r["modeledCategoryAllocationCents"] for r in funding)
temporary_total = sum(r["temporaryAllocationCents"] for r in funding)
permanent_total = sum(r["permanentAllocationCents"] for r in funding)
reserve_total = sum(r["modeledCategoryAllocationCents"] for r in funding if r["category"] == "reserve")
check("official funding cents", official_total == 10_025_021_200, str(official_total))
check("category plus reserve reconciliation", category_total == official_total, str(category_total))
check("phase plus reserve reconciliation", temporary_total + permanent_total + reserve_total == official_total, str(temporary_total + permanent_total + reserve_total))
check("temporary total cents", temporary_total == 4_412_800_000, str(temporary_total))
check("permanent total cents", permanent_total == 5_555_200_000, str(permanent_total))
check("reserve cents", reserve_total == 57_021_200, str(reserve_total))

area_ids = {a["areaId"] for a in areas}
area_codes = {a["areaCode"] for a in areas}
project_ids = [p["projectId"] for p in projects]
check("unique 3D IDs", len(project_ids) == len(set(project_ids)))
check("3D area joins", all(p["areaId"] in area_ids for p in projects))
check("ML area joins", all(r["primaryAreaCode"] in area_codes for r in ml))
check("source registry nonempty", len(sources) > 0, str(len(sources)))

for city in {a["cityId"] for a in areas}:
    share = sum(a["areaShare"] for a in areas if a["cityId"] == city)
    check(f"area share {city}", abs(share - 1.0) < 1e-9, str(share))

failures = [item for item in checks if not item[1]]
for name, passed, detail in checks:
    print(("PASS" if passed else "FAIL"), name, detail)
if failures:
    raise SystemExit(1)
print(f"PASS all {len(checks)} validation checks")
