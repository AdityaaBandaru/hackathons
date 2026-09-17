# World Cup 2026 Hackathon Data Bundle

This bundle is the code-ready data layer for the **World Cup 2026 Host-City Mobility Investment and 3D Legacy Optimizer**.

## Start here

For the fastest New York/New Jersey demo, load:

`json/nynjHackathonContext.json`

It contains the host budget, category allocations, two pedestrian areas, 2026 evidence, match-level evidence, analog events, all New York/New Jersey temporary/permanent 3D records, and legacy-ID aliases.

For the all-city comparison page, load:

`json/allHostSummary.json`

For the 3D map, load:

`geojson/nynj_projects.geojson`

and filter features by `properties.project_id` using the IDs returned by the optimizer.

## Data directories

- `csv/`: ten flat import-ready datasets.
- `json/`: normalized application seed data in camelCase.
- `geojson/`: EPSG:4326 conceptual project and pedestrian-area geometry.
- `types/`: TypeScript interfaces.
- `schemas/`: JSON Schemas for funding and 3D project records.
- `examples/`: New York/New Jersey context and optimizer request.
- `scripts/`: zero-dependency validation script.
- `reference/`: original workbooks, ML CSV, optimizer script/results, and Claude runbook.

## Critical evidence rule

Official allocations and published observations remain source-backed facts. Category allocations, temporary/permanent splits, most design pedestrian volumes, coordinates, dimensions, and generated GeoJSON geometry are assumptions or conceptual designs. Preserve `evidenceClass`, qualifiers, source URLs, and `spatialPrecision` in the UI.

Coordinates are planning anchors, not surveyed construction coordinates.

## Money

Normalized JSON stores money in integer cents:

- Official FTA total: `10025021200`
- Temporary allocation: `4412800000`
- Permanent allocation: `5555200000`
- Reserve: `57021200`

## Validation

Run from this bundle directory:

```bash
python scripts/validate_bundle.py
```

The script checks counts, exact funding reconciliation, unique project IDs, spatial joins, ML area-code joins, and city area shares.

## Renderer contract

1. The optimizer returns canonical project IDs.
2. Baseline mode displays no modeled proposal.
3. Temporary mode filters to selected `-TMP` records.
4. Permanent mode filters to selected `-PERM` records.
5. All Possibilities mode may display every candidate translucently.
6. Never render a project as selected when its ID is absent from the scenario response.

## Recommended hackathon scope

Build New York/New Jersey as the polished hero scenario. Use all 11 regions only for comparison. Start with static MapLibre lines, polygons, points, and extrusions. Add procedural Three.js objects only after project-ID filtering works.
