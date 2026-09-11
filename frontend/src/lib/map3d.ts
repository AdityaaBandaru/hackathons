/**
 * The 3D perspective view's extrusion rules.
 *
 * Kept pure and separate from the flat map so the flat view's behaviour and
 * tests are untouched, and so the one thing that must not be arbitrary here --
 * how tall a project is drawn -- can be proven by test.
 *
 * WHERE THE NUMBERS COME FROM
 *
 * Every extruded volume's height is the project's own `height_m`, a real field
 * on each of the 264 records in the seed bundle's 3D Projects sheet. Nothing
 * here scales, guesses at, or invents a height. The spread is meaningful and
 * differs by phase, e.g. for New York/New Jersey:
 *
 *     station  18 m permanent /  6 m temporary
 *     toc      12 m           /  4 m
 *     hub       6 m           /  3 m
 *     parkride  0.2 m         /  0.2 m   (a surface lot, correctly near-flat)
 *
 * WHICH CATEGORIES EXTRUDE
 *
 * Not a hand-picked list: it is the bundle's own `defaultGeometryType` on each
 * intervention (reference/json/interventions.json). Two of its five values
 * describe a built volume, and only those extrude:
 *
 *     polygon_extrusion -> hub, parkride, tnc      (a footprint with height)
 *     glb_model         -> station, toc            (a modelled structure)
 *
 * The other three describe things that are not volumes, and stay flat exactly
 * as they render in the flat view -- extruding them would depict something
 * that does not exist:
 *
 *     line_extrusion    -> buslane, ped, bike, access   (surface treatments)
 *     point_model       -> signals, wayfinding          (equipment)
 *     animated_route    -> service                      (an operating plan)
 *
 * WHAT THIS VIEW DELIBERATELY DOES NOT SHOW
 *
 * Nothing is drawn above ground level. The bundle has no elevation data: the
 * only vertical offset field, `zOffsetM`, holds 0.05 or 0.1 m on all 264
 * records -- a 5-10 cm draw-order nudge to stop coincident layers flickering,
 * not a height above grade. There is likewise no bridge, elevated-crossing or
 * flyover intervention in the 12-category library. Rendering any project as an
 * elevated span would mean inventing both the structure and its elevation.
 */

import type { Feature, FeatureCollection, Polygon, Position } from "geojson";

/** `defaultGeometryType` values that describe a built volume. */
export const VOLUMETRIC_GEOMETRY_TYPES: ReadonlySet<string> = new Set([
  "polygon_extrusion",
  "glb_model",
]);

/** True when the bundle marks this project's geometry type as a volume. */
export function isVolumetric(geometryType: unknown): boolean {
  return typeof geometryType === "string" &&
    VOLUMETRIC_GEOMETRY_TYPES.has(geometryType);
}

/**
 * Disclosure for the 3D view, in the same spirit as the optimizer's
 * `modelAssumptions` block: every rendering choice stated, with its source,
 * and an explicit list of what is *not* depicted (CLAUDE.md rule 8).
 */
export const THREE_D_MODEL_ASSUMPTIONS = {
  note:
    "The 3D view is a rendering of engineering assumptions, not a survey or " +
    "a design. Nothing here is an observed structure.",
  heightSource:
    "Each volume's height is the project's own height_m field from the seed " +
    "bundle's 3D Projects records. No height is scaled, inferred or invented.",
  extrusionRule:
    "A project is extruded only when its intervention category's " +
    "defaultGeometryType is polygon_extrusion or glb_model -- the bundle's " +
    "own two volumetric types. line_extrusion, point_model and animated_route " +
    "categories stay flat, identically to the flat view.",
  footprintSource:
    "Categories stored as polygons (hub, parkride, tnc) extrude their own " +
    "footprint. The two stored as points (station, toc) are given a rectangle " +
    "built from their own length_m, width_m and bearing_deg fields.",
  groundLevel:
    "Every volume sits on the ground. The bundle contains no elevation data: " +
    "zOffsetM is 0.05 or 0.1 m on all 264 records, a draw-order nudge rather " +
    "than a height above grade.",
  notRepresented: [
    "Elevated pedestrian bridges and grade-separated crossings -- the " +
      "intervention library has no such category; its pedestrian category is " +
      "a ground-level protected corridor (widened sidewalk, lighting, " +
      "drainage and separation).",
    "Flyovers -- no flyover, overpass or viaduct appears anywhere in the seed " +
      "bundle.",
    "Any structure above ground level, for the reason given in groundLevel.",
  ],
  spatialPrecision:
    "Footprints sit on conceptual planning anchors, not surveyed locations " +
    "(CLAUDE.md rule 9). Shape and orientation are illustrative.",
} as const;

// ---------------------------------------------------------------------------
// Footprint synthesis for volumetric categories stored as points
// ---------------------------------------------------------------------------

/** Metres per degree of latitude (spherical approximation). */
const METRES_PER_DEGREE_LAT = 111_320;

/**
 * A rectangle centred on a point, sized and oriented by the project's own
 * length_m, width_m and bearing_deg.
 *
 * The metre-to-degree conversion is a local flat-earth approximation, which is
 * accurate to well under a metre at the scale these footprints are drawn
 * (tens to low hundreds of metres, at this latitude). Bearing is degrees
 * clockwise from north, matching the bundle's bearing_deg.
 */
export function rectangleFootprint(
  lon: number,
  lat: number,
  lengthM: number,
  widthM: number,
  bearingDeg: number,
): Position[][] {
  const latRadians = (lat * Math.PI) / 180;
  const metresPerDegreeLon =
    METRES_PER_DEGREE_LAT * Math.max(Math.cos(latRadians), 1e-6);

  const bearingRadians = (bearingDeg * Math.PI) / 180;
  const sin = Math.sin(bearingRadians);
  const cos = Math.cos(bearingRadians);

  const halfLength = lengthM / 2;
  const halfWidth = widthM / 2;

  // Corners in a local metre frame: +along is the bearing direction,
  // +across is 90 degrees clockwise from it.
  const corners: [number, number][] = [
    [+halfLength, +halfWidth],
    [+halfLength, -halfWidth],
    [-halfLength, -halfWidth],
    [-halfLength, +halfWidth],
  ];

  const ring: Position[] = corners.map(([along, across]) => {
    // Rotate the local frame onto the compass bearing.
    const east = along * sin + across * cos;
    const north = along * cos - across * sin;
    return [
      lon + east / metresPerDegreeLon,
      lat + north / METRES_PER_DEGREE_LAT,
    ];
  });
  ring.push(ring[0]); // close the ring

  return [ring];
}

// ---------------------------------------------------------------------------
// Splitting the loaded geometry into what extrudes and what stays flat
// ---------------------------------------------------------------------------

function numberProp(feature: Feature, key: string): number | null {
  const value = feature.properties?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * The subset of features that extrude, with point-stored volumes converted to
 * their own rectangular footprint so fill-extrusion (which only renders
 * polygons) can draw them.
 *
 * A feature is dropped rather than guessed at if the data it needs is absent:
 * a missing height_m, or a point volume missing its footprint dimensions.
 * Properties are carried through untouched so the ID filters behave exactly
 * as they do on the flat view.
 */
export function buildVolumeCollection(
  source: FeatureCollection,
): FeatureCollection {
  const features: Feature[] = [];

  for (const feature of source.features) {
    if (!isVolumetric(feature.properties?.geometry_type)) continue;
    if (numberProp(feature, "height_m") === null) continue;

    if (feature.geometry.type === "Polygon") {
      features.push(feature);
      continue;
    }

    if (feature.geometry.type === "Point") {
      const lengthM = numberProp(feature, "length_m");
      const widthM = numberProp(feature, "width_m");
      const bearingDeg = numberProp(feature, "bearing_deg") ?? 0;
      if (lengthM === null || widthM === null) continue;

      const [lon, lat] = feature.geometry.coordinates;
      const polygon: Polygon = {
        type: "Polygon",
        coordinates: rectangleFootprint(lon, lat, lengthM, widthM, bearingDeg),
      };
      features.push({ ...feature, geometry: polygon });
    }
  }

  return { type: "FeatureCollection", features };
}

/** The complement: everything the 3D view keeps flat, geometry untouched. */
export function buildFlatCollection(
  source: FeatureCollection,
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: source.features.filter(
      (feature) => !isVolumetric(feature.properties?.geometry_type),
    ),
  };
}

// ---------------------------------------------------------------------------
// View selection
// ---------------------------------------------------------------------------

export const MAP_VIEWS = ["flat", "threeD"] as const;
export type MapView = (typeof MAP_VIEWS)[number];

export const MAP_VIEW_LABELS: Record<MapView, string> = {
  flat: "Flat",
  threeD: "3D perspective",
};

/**
 * Both views honour all four display modes identically -- the perspective
 * toggle changes how a project is drawn, never which projects are drawn.
 */
export const MAP_VIEW_DESCRIPTIONS: Record<MapView, string> = {
  flat: "Overhead view. Every project drawn as a flat line, polygon or point.",
  threeD:
    "Tilted camera. Categories the bundle marks as built volumes are extruded " +
    "to their own recorded height; everything else stays flat.",
};
