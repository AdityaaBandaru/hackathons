# Flagship 3D models

Open either `.glb` file in Blender using **File → Import → glTF 2.0** or in any compatible GLB viewer.

| Asset | Recorded dimensions | Meaning |
| --- | --- | --- |
| `nynj-station-TMP.glb` | 120 × 45 × 6 metres | Temporary station concept |
| `nynj-station-PERM.glb` | 120 × 45 × 18 metres | Permanent station concept |

The origin is at ground level at the center of the footprint. X is the length axis; Y is up. These assets are isolated concept studies, not geographically placed or surveyed buildings. Phase accents are amber for temporary and blue for permanent.

Dimensions and provenance come from the supplied `projects3d.json` records. Architectural details are illustrative. The GLB node metadata contains the canonical project ID, phase, evidence class, source URL, units and dimension basis. The supplied source URL grounds the planning anchor; it does not verify this architectural design.

The app's **Export GLB** button can generate the other concepts and phase comparisons from the same code. An exported corridor asset is the labeled 80 m detail shown in the viewer, with its full project length retained in metadata.
