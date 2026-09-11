import { describe, expect, it } from "vitest";
import type { FeatureCollection } from "geojson";
import {
  THREE_D_MODEL_ASSUMPTIONS,
  VOLUMETRIC_GEOMETRY_TYPES,
  buildFlatCollection,
  buildVolumeCollection,
  isVolumetric,
  rectangleFootprint,
} from "./map3d";

/**
 * The real intervention -> geometry type mapping from
 * reference/json/interventions.json, transcribed so a change to the bundle's
 * own taxonomy shows up here as a failure rather than silently changing what
 * the 3D view extrudes.
 */
const CATEGORY_GEOMETRY_TYPES: Record<string, string> = {
  service: "animated_route",
  buslane: "line_extrusion",
  signals: "point_model",
  hub: "polygon_extrusion",
  parkride: "polygon_extrusion",
  ped: "line_extrusion",
  bike: "line_extrusion",
  tnc: "polygon_extrusion",
  wayfinding: "point_model",
  station: "glb_model",
  toc: "glb_model",
  access: "line_extrusion",
};

describe("which categories extrude", () => {
  it("extrudes exactly the bundle's two volumetric geometry types", () => {
    expect([...VOLUMETRIC_GEOMETRY_TYPES].sort()).toEqual([
      "glb_model",
      "polygon_extrusion",
    ]);
  });

  it("extrudes the five volumetric categories and no others", () => {
    const extruded = Object.entries(CATEGORY_GEOMETRY_TYPES)
      .filter(([, geometryType]) => isVolumetric(geometryType))
      .map(([category]) => category)
      .sort();
    expect(extruded).toEqual(["hub", "parkride", "station", "tnc", "toc"]);
  });

  it("leaves surface treatments, equipment and operating plans flat", () => {
    // Extruding these would depict something that does not exist.
    for (const category of [
      "buslane",
      "ped",
      "bike",
      "access",
      "signals",
      "wayfinding",
      "service",
    ]) {
      expect(isVolumetric(CATEGORY_GEOMETRY_TYPES[category])).toBe(false);
    }
  });

  it("treats an unknown or missing geometry type as flat", () => {
    expect(isVolumetric("something_else")).toBe(false);
    expect(isVolumetric(undefined)).toBe(false);
    expect(isVolumetric(null)).toBe(false);
    expect(isVolumetric(42)).toBe(false);
  });
});

describe("rectangleFootprint", () => {
  const lon = -74.0699;
  const lat = 40.8078;

  it("centres the footprint on the project's own anchor", () => {
    const [ring] = rectangleFootprint(lon, lat, 120, 45, 0);
    const corners = ring.slice(0, 4);
    const meanLon = corners.reduce((s, c) => s + c[0], 0) / 4;
    const meanLat = corners.reduce((s, c) => s + c[1], 0) / 4;
    expect(meanLon).toBeCloseTo(lon, 10);
    expect(meanLat).toBeCloseTo(lat, 10);
  });

  it("returns a closed ring of five positions", () => {
    const [ring] = rectangleFootprint(lon, lat, 120, 45, 32);
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[4]);
  });

  it("sizes the rectangle from length_m and width_m, at bearing 0", () => {
    const lengthM = 120;
    const widthM = 45;
    const [ring] = rectangleFootprint(lon, lat, lengthM, widthM, 0);
    const lats = ring.slice(0, 4).map((c) => c[1]);
    const lons = ring.slice(0, 4).map((c) => c[0]);

    // At bearing 0, length runs north-south and width east-west.
    const northSouthM = (Math.max(...lats) - Math.min(...lats)) * 111_320;
    const eastWestM =
      (Math.max(...lons) - Math.min(...lons)) *
      111_320 *
      Math.cos((lat * Math.PI) / 180);

    expect(northSouthM).toBeCloseTo(lengthM, 1);
    expect(eastWestM).toBeCloseTo(widthM, 1);
  });

  it("rotates with bearing_deg, preserving its dimensions", () => {
    const [straight] = rectangleFootprint(lon, lat, 120, 45, 0);
    const [rotated] = rectangleFootprint(lon, lat, 120, 45, 90);
    expect(rotated).not.toEqual(straight);

    // A 90-degree rotation swaps which axis carries the length.
    const lats = rotated.slice(0, 4).map((c) => c[1]);
    const northSouthM = (Math.max(...lats) - Math.min(...lats)) * 111_320;
    expect(northSouthM).toBeCloseTo(45, 1);
  });

  it("is deterministic", () => {
    expect(rectangleFootprint(lon, lat, 120, 45, 32)).toEqual(
      rectangleFootprint(lon, lat, 120, 45, 32),
    );
  });
});

describe("splitting geometry into volumes and flats", () => {
  const collection: FeatureCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          project_id: "hub",
          geometry_type: "polygon_extrusion",
          height_m: 6,
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-74.07, 40.807],
              [-74.069, 40.807],
              [-74.069, 40.808],
              [-74.07, 40.807],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          project_id: "station",
          geometry_type: "glb_model",
          height_m: 18,
          length_m: 120,
          width_m: 45,
          bearing_deg: 32,
        },
        geometry: { type: "Point", coordinates: [-74.0699, 40.8078] },
      },
      {
        type: "Feature",
        properties: {
          project_id: "bike",
          geometry_type: "line_extrusion",
          height_m: 0.1,
        },
        geometry: {
          type: "LineString",
          coordinates: [
            [-74.075, 40.805],
            [-74.073, 40.806],
          ],
        },
      },
    ],
  };

  it("puts only volumetric categories in the volume collection", () => {
    const volumes = buildVolumeCollection(collection);
    expect(volumes.features.map((f) => f.properties?.project_id)).toEqual([
      "hub",
      "station",
    ]);
  });

  it("converts point-stored volumes to a polygon so fill-extrusion can draw them", () => {
    const volumes = buildVolumeCollection(collection);
    const station = volumes.features.find(
      (f) => f.properties?.project_id === "station",
    )!;
    expect(station.geometry.type).toBe("Polygon");
    // Its own height is carried through untouched.
    expect(station.properties?.height_m).toBe(18);
  });

  it("leaves already-polygonal volumes exactly as they were", () => {
    const volumes = buildVolumeCollection(collection);
    const hub = volumes.features.find((f) => f.properties?.project_id === "hub")!;
    expect(hub.geometry).toEqual(collection.features[0].geometry);
  });

  it("carries project_id through so the ID filters behave as on the flat view", () => {
    const volumes = buildVolumeCollection(collection);
    for (const feature of volumes.features) {
      expect(typeof feature.properties?.project_id).toBe("string");
    }
  });

  it("puts everything non-volumetric in the flat collection, geometry untouched", () => {
    const flats = buildFlatCollection(collection);
    expect(flats.features.map((f) => f.properties?.project_id)).toEqual(["bike"]);
    expect(flats.features[0].geometry).toEqual(collection.features[2].geometry);
  });

  it("partitions the input with no feature lost or duplicated", () => {
    const volumes = buildVolumeCollection(collection);
    const flats = buildFlatCollection(collection);
    expect(volumes.features.length + flats.features.length).toBe(
      collection.features.length,
    );
  });

  it("drops a volume whose height is missing rather than inventing one", () => {
    const missingHeight: FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { project_id: "hub", geometry_type: "polygon_extrusion" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-74.07, 40.807],
                [-74.069, 40.807],
                [-74.069, 40.808],
                [-74.07, 40.807],
              ],
            ],
          },
        },
      ],
    };
    expect(buildVolumeCollection(missingHeight).features).toEqual([]);
  });

  it("drops a point volume missing its footprint dimensions rather than guessing", () => {
    const missingDimensions: FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            project_id: "station",
            geometry_type: "glb_model",
            height_m: 18,
          },
          geometry: { type: "Point", coordinates: [-74.0699, 40.8078] },
        },
      ],
    };
    expect(buildVolumeCollection(missingDimensions).features).toEqual([]);
  });
});

describe("disclosure", () => {
  it("states that the view is assumptions, not observation", () => {
    expect(THREE_D_MODEL_ASSUMPTIONS.note).toMatch(/not a survey/i);
    expect(THREE_D_MODEL_ASSUMPTIONS.heightSource).toMatch(/height_m/);
    expect(THREE_D_MODEL_ASSUMPTIONS.extrusionRule).toMatch(
      /defaultGeometryType/,
    );
  });

  it("discloses that nothing is drawn above ground and why", () => {
    expect(THREE_D_MODEL_ASSUMPTIONS.groundLevel).toMatch(/no elevation data/i);
    expect(THREE_D_MODEL_ASSUMPTIONS.groundLevel).toMatch(/zOffsetM/);
  });

  it("names what the view deliberately does not represent", () => {
    const notRepresented = THREE_D_MODEL_ASSUMPTIONS.notRepresented.join(" ");
    expect(notRepresented).toMatch(/bridge/i);
    expect(notRepresented).toMatch(/flyover/i);
    expect(notRepresented).toMatch(/above ground level/i);
  });
});
