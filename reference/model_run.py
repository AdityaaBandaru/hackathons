from __future__ import annotations

import json
from dataclasses import dataclass

import numpy as np
from scipy.optimize import Bounds, LinearConstraint, milp


@dataclass(frozen=True)
class Intervention:
    label: str
    unit: str
    cost_m: float
    max_units: int
    # passenger-minutes, vehicle-hours, CO2 tonnes, accessible passenger-trips,
    # reliability-risk percentage points
    metrics: tuple[float, float, float, float, float]


I = {
    "service": Intervention("Extra transit service", "2,500 vehicle-hours", 0.55, 5, (180_000, 4_000, 45, 8_000, 1.7)),
    "buslane": Intervention("Temporary transit lanes", "2 lane-miles", 0.36, 4, (210_000, 8_000, 70, 10_000, 1.1)),
    "signals": Intervention("Event signal plans", "20 intersections", 0.09, 4, (70_000, 7_000, 30, 2_000, 0.5)),
    "hub": Intervention("Hub-to-stadium shuttle", "one hub package", 0.75, 4, (190_000, 6_000, 60, 14_000, 1.3)),
    "parkride": Intervention("Pop-up park-and-ride", "500 spaces", 0.45, 3, (80_000, 5_000, 15, 6_000, 0.5)),
    "ped": Intervention("Pedestrian corridor", "1 tactical mile", 0.60, 3, (55_000, 1_500, 12, 9_000, 0.7)),
    "bike": Intervention("Protected bike access", "2 route-miles", 0.65, 2, (35_000, 1_000, 18, 3_000, 0.2)),
    "tnc": Intervention("Geofenced rideshare hub", "one managed hub", 0.40, 3, (120_000, 11_000, -5, 4_000, 0.8)),
    "wayfinding": Intervention("Multilingual wayfinding", "city event package", 0.30, 2, (45_000, 500, 4, 7_000, 0.6)),
    "station": Intervention("Station capacity package", "one station", 1.25, 3, (240_000, 2_500, 25, 18_000, 2.4)),
    "toc": Intervention("Integrated traffic operations", "city event package", 0.75, 2, (150_000, 13_000, 45, 5_000, 1.5)),
    "access": Intervention("ADA/microtransit access", "city event package", 0.50, 2, (40_000, 400, 1, 8_000, 0.4)),
}

BUDGET = {
    "Atlanta": 9.391018,
    "Boston": 8.671598,
    "Dallas": 10.033037,
    "Houston": 9.092387,
    "Kansas City": 8.632123,
    "Los Angeles": 9.603284,
    "Miami": 8.697430,
    "New York/New Jersey": 10.438681,
    "Philadelphia": 8.474327,
    "San Francisco Bay Area": 8.807888,
    "Seattle": 8.408439,
}

ATTENDANCE = {
    "Atlanta": 543_182,
    "Boston": 447_283,
    "Dallas": 632_662,
    "Houston": 479_032,
    "Kansas City": 412_199,
    "Los Angeles": 560_000,
    "Miami": 449_157,
    "New York/New Jersey": 620_555,
    "Philadelphia": 407_894,
    "San Francisco Bay Area": 410_000,
    "Seattle": 399_542,
}

# Relative productivity by intervention, grounded in each venue's transit topology.
MULT = {
    "Atlanta": dict(service=1.4, buslane=.7, signals=.8, hub=.6, parkride=.5, ped=1.1, bike=.8, tnc=.8, wayfinding=1.2, station=1.5, toc=1.2, access=1.0),
    "Boston": dict(service=1.5, buslane=1.2, signals=.8, hub=1.7, parkride=1.4, ped=.6, bike=.5, tnc=1.0, wayfinding=1.1, station=1.0, toc=1.1, access=1.0),
    "Dallas": dict(service=1.7, buslane=1.5, signals=1.4, hub=1.6, parkride=1.5, ped=.5, bike=.3, tnc=1.2, wayfinding=1.0, station=.3, toc=1.3, access=1.0),
    "Houston": dict(service=1.3, buslane=1.1, signals=1.2, hub=1.1, parkride=1.0, ped=.9, bike=.6, tnc=1.1, wayfinding=1.1, station=1.2, toc=1.3, access=1.0),
    "Kansas City": dict(service=1.7, buslane=1.5, signals=1.4, hub=1.7, parkride=1.5, ped=.5, bike=.3, tnc=1.3, wayfinding=1.0, station=.2, toc=1.3, access=1.0),
    "Los Angeles": dict(service=1.7, buslane=1.6, signals=1.3, hub=1.6, parkride=1.2, ped=.7, bike=.5, tnc=1.4, wayfinding=1.1, station=.5, toc=1.5, access=1.0),
    "Miami": dict(service=1.6, buslane=1.3, signals=1.2, hub=1.7, parkride=1.4, ped=.6, bike=.4, tnc=1.4, wayfinding=1.2, station=.5, toc=1.5, access=1.0),
    "New York/New Jersey": dict(service=1.4, buslane=.7, signals=.8, hub=1.1, parkride=.3, ped=1.7, bike=.6, tnc=1.7, wayfinding=1.3, station=1.5, toc=1.7, access=1.1),
    "Philadelphia": dict(service=1.5, buslane=.8, signals=.8, hub=.6, parkride=.5, ped=1.4, bike=1.0, tnc=.8, wayfinding=1.3, station=1.6, toc=1.2, access=1.0),
    "San Francisco Bay Area": dict(service=1.6, buslane=.8, signals=.9, hub=.8, parkride=1.0, ped=1.1, bike=1.3, tnc=1.0, wayfinding=1.3, station=1.5, toc=1.3, access=1.0),
    "Seattle": dict(service=1.6, buslane=.8, signals=.8, hub=.6, parkride=.5, ped=1.5, bike=1.4, tnc=.8, wayfinding=1.3, station=1.4, toc=1.3, access=1.0),
}

SEG_FACTORS = [1.0, .74, .53, .37, .25]
WEIGHTS = np.array([.30, .20, .15, .20, .15])
# Denominators make one unit's five metric families commensurate.
DENOM = np.array([200_000, 8_000, 50, 10_000, 1.5])
SYNERGIES = {
    ("service", "buslane"): .22,
    ("service", "hub"): .18,
    ("service", "station"): .15,
    ("tnc", "toc"): .18,
    ("wayfinding", "station"): .08,
}


def solve(city: str, budget_mult: float = 1.0, cost_mult: float = 1.0, demand_mult: float = 1.0,
          min_quantities: dict[str, int] | None = None):
    segments: list[tuple[str, int]] = []
    for key, intervention in I.items():
        segments.extend((key, s) for s in range(intervention.max_units))
    pairs = list(SYNERGIES)
    names = [("seg", *x) for x in segments] + [("pair", *x) for x in pairs]
    n = len(names)
    c = np.zeros(n)
    costs = np.zeros(n)
    metric_vectors: list[np.ndarray] = []
    dscale = (ATTENDANCE[city] / 500_000) * demand_mult
    for j, (kind, *rest) in enumerate(names):
        if kind == "seg":
            key, s = rest
            iv = I[key]
            vec = np.array(iv.metrics, float) * MULT[city][key] * dscale * SEG_FACTORS[s]
            metric_vectors.append(vec)
            c[j] = -float(WEIGHTS @ (vec / DENOM))
            costs[j] = iv.cost_m * cost_mult
        else:
            a, b = rest
            # Complementarity benefit is conservative: a share of the smaller first-unit benefit.
            va = np.array(I[a].metrics, float) * MULT[city][a] * dscale
            vb = np.array(I[b].metrics, float) * MULT[city][b] * dscale
            vec = np.minimum(va, vb) * SYNERGIES[(a, b)]
            metric_vectors.append(vec)
            c[j] = -float(WEIGHTS @ (vec / DENOM))
    constraints: list[LinearConstraint] = [LinearConstraint(costs, -np.inf, BUDGET[city] * budget_mult)]
    # Later marginal segments require all earlier segments.
    idx = {name: j for j, name in enumerate(names)}
    for key, iv in I.items():
        for s in range(1, iv.max_units):
            row = np.zeros(n)
            row[idx[("seg", key, s)]] = 1
            row[idx[("seg", key, s - 1)]] = -1
            constraints.append(LinearConstraint(row, -np.inf, 0))
    # Pair active only when both first units are selected.
    for a, b in pairs:
        z = idx[("pair", a, b)]
        for key in (a, b):
            row = np.zeros(n)
            row[z] = 1
            row[idx[("seg", key, 0)]] = -1
            constraints.append(LinearConstraint(row, -np.inf, 0))
        row = np.zeros(n)
        row[z] = -1
        row[idx[("seg", a, 0)]] = 1
        row[idx[("seg", b, 0)]] = 1
        constraints.append(LinearConstraint(row, -np.inf, 1))
    lower = np.zeros(n)
    if min_quantities:
        for key, q in min_quantities.items():
            for s in range(q):
                lower[idx[("seg", key, s)]] = 1
    res = milp(c, integrality=np.ones(n), bounds=Bounds(lower, np.ones(n)), constraints=constraints,
               options={"time_limit": 10})
    x = np.rint(res.x).astype(int)
    quantities = {k: 0 for k in I}
    for j, (kind, *rest) in enumerate(names):
        if kind == "seg" and x[j]:
            quantities[rest[0]] += 1
    raw = np.sum([metric_vectors[j] * x[j] for j in range(n)], axis=0)
    spent = float(costs @ x)
    score = float(-c @ x)
    # Best next unused segment by city utility per cost, ignoring new synergy.
    candidates = []
    for key, iv in I.items():
        q = quantities[key]
        if q < iv.max_units:
            vec = np.array(iv.metrics) * MULT[city][key] * dscale * SEG_FACTORS[q]
            util = float(WEIGHTS @ (vec / DENOM))
            candidates.append((util / (iv.cost_m * cost_mult), key, q + 1, iv.cost_m * cost_mult))
    next_best = max(candidates) if candidates else (0.0, "none", 0, 0.0)
    return {
        "city": city,
        "budget_m": BUDGET[city] * budget_mult,
        "spent_m": spent,
        "score": score,
        "quantities": {k: v for k, v in quantities.items() if v},
        "passenger_hours_saved": raw[0] / 60,
        "avg_minutes_saved_per_attendee": raw[0] / (ATTENDANCE[city] * demand_mult),
        "vehicle_hours_avoided": raw[1],
        "co2_tonnes_avoided": raw[2],
        "accessible_trips_improved": raw[3],
        "reliability_risk_pp_reduction": raw[4],
        "next_best": {"intervention": next_best[1], "unit_number": next_best[2], "cost_m": next_best[3], "utility_per_m": next_best[0]},
    }


def main():
    base = [solve(c) for c in BUDGET]
    sensitivity = {}
    for city in BUDGET:
        sensitivity[city] = {
            "attendance_-20": solve(city, demand_mult=.8)["score"],
            "attendance_+20": solve(city, demand_mult=1.2)["score"],
            "budget_-20": solve(city, budget_mult=.8)["score"],
            "budget_+20": solve(city, budget_mult=1.2)["score"],
            "costs_-25": solve(city, cost_mult=.75)["score"],
            "costs_+25": solve(city, cost_mult=1.25)["score"],
        }
    print(json.dumps({"base": base, "sensitivity": sensitivity}, indent=2))


if __name__ == "__main__":
    main()
