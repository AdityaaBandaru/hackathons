# Project Instructions

Build the World Cup 2026 Host-City Mobility Investment and Legacy Optimizer.

Authoritative requirements: reference/Research_and_Modeling_Task.md
Authoritative seed data: reference/json/*.json (already normalized and validated — do not re-derive from the xlsx workbooks)
Already-generated map geometry: reference/geojson/*.geojson (do not regenerate from scratch for v1)
Reference optimizer: reference/model_run.py and reference/model_results.json
Background runbook (for context only, not the authoritative spec): reference/Claude_Code_Execution_Runbook.md

Rules:
1. Keep the repository runnable after every phase.
2. Implement only the requested phase before expanding scope.
3. Run relevant tests and report their output before claiming completion.
4. Store money as integer cents in application code.
5. Assert the 11 official allocations total exactly 10,025,021,200 cents.
6. Never convert missing values to zero.
7. Preserve evidenceClass, qualifier, methodology note, and source URL on every record.
8. Never present engineering assumptions or model outputs as observed facts.
9. Treat GeoJSON coordinates as conceptual planning anchors, not surveyed locations.
10. Treat projectId (3D Projects) as the canonical renderer identifier.
11. The optimizer returns project IDs; the frontend must not invent selected objects.
12. Baseline mode hides every modeled proposal.
13. Selected Legacy mode renders only IDs returned by the current scenario.
14. Do not add paid API requirements.
15. Do not build authentication, payments, Docker, or PostgreSQL for v1 — load JSON seed data in memory.
16. Do not build a Three.js/Blender 3D scene or animation until Phases 1-5 are complete and tested.
17. Add tests with each feature instead of postponing all tests.
18. Do not delete reference files or overwrite raw evidence.
