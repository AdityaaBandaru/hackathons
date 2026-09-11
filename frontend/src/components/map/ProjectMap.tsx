"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AttributionControl,
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type AddLayerObject,
  type FilterSpecification,
  type MapLayerMouseEvent,
  type MapMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection } from "geojson";
import { buildLayerFilters, type MapSelection } from "@/lib/mapModes";
import {
  VOLUMETRIC_GEOMETRY_TYPES,
  buildVolumeCollection,
  type MapView,
} from "@/lib/map3d";

// Meadowlands Sports Complex: the centroid of the generated nynj geometry,
// which sits on the Meadowlands Rail Station planning anchor.
export const MEADOWLANDS_CENTER: [number, number] = [-74.070749, 40.807664];
export const MEADOWLANDS_ZOOM = 13.4;

// Keyless raster basemap (CLAUDE.md rule 14: no paid API requirements).
// OpenStreetMap's standard tiles need no account or key. CARTO's basemaps were
// tried first and now serve "API KEY REQUIRED" watermarks, which would have
// made the map depend on a paid service. Overridable for self-hosted tiles; if
// tiles fail entirely the proposal layers still draw over the background.
const BASEMAP_TILE_URL =
  process.env.NEXT_PUBLIC_BASEMAP_TILE_URL ??
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const BASEMAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const SOURCE_ID = "nynj-proposals";
const VOLUME_SOURCE_ID = "nynj-proposals-volumes";

// 3D perspective camera: same centre as the flat view, tilted and turned so
// the extruded volumes read as solids, and close enough that an 18 m station
// package is unmistakably a building rather than a smudge.
export const PERSPECTIVE_ZOOM = 15.3;
export const PERSPECTIVE_PITCH = 60;
export const PERSPECTIVE_BEARING = -30;

/**
 * Point MapLibre at its worker explicitly.
 *
 * MapLibre resolves its worker URL from `import.meta.url` and returns an empty
 * string when that is not an http(s) URL -- which is what happens once the
 * library is bundled. `new Worker("")` then fetches the HTML page instead of a
 * script, so the worker never starts and every GeoJSON source stays empty
 * forever: the layers exist and the filters are right, but nothing is ever
 * tiled, so nothing draws. `npm run copy:maplibre` (wired into predev,
 * prebuild and pretest) puts the worker bundle at this path.
 */
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

type LayerRole = "selected" | "candidate";

interface ProposalLayer {
  id: string;
  role: LayerRole;
  geometry: "Point" | "LineString" | "Polygon";
  spec: (filter: unknown) => AddLayerObject;
}

/**
 * One layer per (geometry type x role). Every layer is filtered by an explicit
 * project-ID list, so a layer with no IDs draws nothing -- there is no
 * "show everything" fallback anywhere in this file.
 */
const PROPOSAL_LAYERS: ProposalLayer[] = [
  {
    id: "proposals-fill-candidate",
    role: "candidate",
    geometry: "Polygon",
    spec: (filter) => ({
      id: "proposals-fill-candidate",
      type: "fill",
      source: SOURCE_ID,
      filter: filter as FilterSpecification,
      paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": 0.18,
        "fill-outline-color": ["get", "color"],
      },
    }),
  },
  {
    id: "proposals-fill-selected",
    role: "selected",
    geometry: "Polygon",
    spec: (filter) => ({
      id: "proposals-fill-selected",
      type: "fill",
      source: SOURCE_ID,
      filter: filter as FilterSpecification,
      paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": 0.55,
        "fill-outline-color": "#0f172a",
      },
    }),
  },
  {
    id: "proposals-line-candidate",
    role: "candidate",
    geometry: "LineString",
    spec: (filter) => ({
      id: "proposals-line-candidate",
      type: "line",
      source: SOURCE_ID,
      filter: filter as FilterSpecification,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": 3,
        "line-opacity": 0.3,
        "line-dasharray": [2, 2],
      },
    }),
  },
  {
    id: "proposals-line-selected",
    role: "selected",
    geometry: "LineString",
    spec: (filter) => ({
      id: "proposals-line-selected",
      type: "line",
      source: SOURCE_ID,
      filter: filter as FilterSpecification,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": 6,
        "line-opacity": 0.95,
      },
    }),
  },
  {
    id: "proposals-point-candidate",
    role: "candidate",
    geometry: "Point",
    spec: (filter) => ({
      id: "proposals-point-candidate",
      type: "circle",
      source: SOURCE_ID,
      filter: filter as FilterSpecification,
      paint: {
        "circle-radius": 6,
        "circle-color": ["get", "color"],
        "circle-opacity": 0.25,
        "circle-stroke-width": 1,
        "circle-stroke-color": ["get", "color"],
        "circle-stroke-opacity": 0.5,
      },
    }),
  },
  {
    id: "proposals-point-selected",
    role: "selected",
    geometry: "Point",
    spec: (filter) => ({
      id: "proposals-point-selected",
      type: "circle",
      source: SOURCE_ID,
      filter: filter as FilterSpecification,
      paint: {
        "circle-radius": 10,
        "circle-color": ["get", "color"],
        "circle-opacity": 0.9,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#0f172a",
      },
    }),
  },
];

/**
 * Extruded volumes, present only while the 3D view is active.
 *
 * Height is each feature's own `height_m`; base is ground level. See
 * lib/map3d.ts for why only some categories extrude and why nothing is
 * elevated. These are filtered by the same project-ID lists as every other
 * layer, so the selection invariants are unchanged in 3D.
 */
const VOLUME_LAYERS: ProposalLayer[] = [
  {
    id: "proposals-volume-candidate",
    role: "candidate",
    geometry: "Polygon",
    spec: (filter) => ({
      id: "proposals-volume-candidate",
      type: "fill-extrusion",
      source: VOLUME_SOURCE_ID,
      filter: filter as FilterSpecification,
      paint: {
        "fill-extrusion-color": ["get", "color"],
        "fill-extrusion-height": ["get", "height_m"],
        "fill-extrusion-base": 0,
        "fill-extrusion-opacity": 0.45,
        "fill-extrusion-vertical-gradient": true,
      },
    }),
  },
  {
    id: "proposals-volume-selected",
    role: "selected",
    geometry: "Polygon",
    spec: (filter) => ({
      id: "proposals-volume-selected",
      type: "fill-extrusion",
      source: VOLUME_SOURCE_ID,
      filter: filter as FilterSpecification,
      paint: {
        "fill-extrusion-color": ["get", "color"],
        "fill-extrusion-height": ["get", "height_m"],
        "fill-extrusion-base": 0,
        "fill-extrusion-opacity": 0.95,
        "fill-extrusion-vertical-gradient": true,
      },
    }),
  },
];

/** Compose the ID filter for a layer with its geometry-type restriction. */
function layerFilter(
  layer: ProposalLayer,
  selection: MapSelection,
  view: MapView = "flat",
) {
  const filters = buildLayerFilters(selection);
  const idPart = layer.role === "selected" ? filters.selected : filters.candidate;
  const clauses: unknown[] = [["==", ["geometry-type"], layer.geometry], idPart];
  // In 3D a volumetric project is drawn as an extrusion instead of flat, so
  // its flat rendering is suppressed here rather than drawn underneath. The
  // flat view is untouched: this clause only exists while view is "threeD".
  if (view === "threeD" && !layer.id.startsWith("proposals-volume-")) {
    clauses.push([
      "!",
      ["in", ["get", "geometry_type"], ["literal", [...VOLUMETRIC_GEOMETRY_TYPES]]],
    ]);
  }
  return ["all", ...clauses];
}

export function ProjectMap({
  geojson,
  selection,
  activeProjectId,
  onSelectProject,
  view = "flat",
}: {
  geojson: FeatureCollection;
  selection: MapSelection;
  activeProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
  /** Flat (default) or tilted with extruded volumes. Same map either way. */
  view?: MapView;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelectProject);
  const viewRef = useRef<MapView>(view);
  const previousViewRef = useRef<MapView>("flat");
  const compassRef = useRef<NavigationControl | null>(null);
  const [styleReady, setStyleReady] = useState(false);
  const volumes = useMemo(() => buildVolumeCollection(geojson), [geojson]);

  // Keep the latest click handler without re-initialising the map.
  useEffect(() => {
    onSelectRef.current = onSelectProject;
  }, [onSelectProject]);

  // Initialise once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      center: MEADOWLANDS_CENTER,
      zoom: MEADOWLANDS_ZOOM,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          basemap: {
            type: "raster",
            tiles: [BASEMAP_TILE_URL],
            tileSize: 256,
            attribution: BASEMAP_ATTRIBUTION,
          },
        },
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#e2e8f0" },
          },
          { id: "basemap", type: "raster", source: "basemap" },
        ],
      },
    });
    mapRef.current = map;

    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new AttributionControl({ compact: true }));
    map.addControl(new ScaleControl({ unit: "metric" }));

    map.on("load", () => {
      map.addSource(SOURCE_ID, { type: "geojson", data: geojson });

      for (const layer of PROPOSAL_LAYERS) {
        // Layers are created already filtered; there is never a frame in which
        // an unselected proposal is drawn as selected.
        map.addLayer(layer.spec(layerFilter(layer, selection)));
      }

      // Click/hover handlers for every layer that can ever exist, volumes
      // included. MapLibre only consults layers present at event time, so
      // registering for the 3D layers before they are added is safe.
      for (const layer of [...PROPOSAL_LAYERS, ...VOLUME_LAYERS]) {
        map.on("click", layer.id, (event: MapLayerMouseEvent) => {
          const feature = event.features?.[0];
          const projectId = feature?.properties?.project_id;
          if (typeof projectId === "string") onSelectRef.current(projectId);
        });
        map.on("mouseenter", layer.id, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer.id, () => {
          map.getCanvas().style.cursor = "";
        });
      }

      // Clicking empty map dismisses the card.
      map.on("click", (event: MapMouseEvent) => {
        const present = [...PROPOSAL_LAYERS, ...VOLUME_LAYERS]
          .map((l) => l.id)
          .filter((id) => map.getLayer(id));
        const hits = map.queryRenderedFeatures(event.point, { layers: present });
        if (hits.length === 0) onSelectRef.current(null);
      });

      setStyleReady(true);
    });

    return () => {
      setStyleReady(false);
      map.remove();
      mapRef.current = null;
    };
    // Geometry and the initial selection are captured on mount; selection
    // changes are applied by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geojson]);

  // Re-filter whenever the mode or scenario changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    for (const layer of [...PROPOSAL_LAYERS, ...VOLUME_LAYERS]) {
      if (!map.getLayer(layer.id)) continue;
      map.setFilter(
        layer.id,
        layerFilter(layer, selection, viewRef.current) as FilterSpecification,
      );
    }
  }, [selection, styleReady]);

  // Switch perspective in place on the same map instance. Tearing the map
  // down and rebuilding it for the other view was tried first and proved
  // unstable (a second WebGL context whose viewport never settled); moving
  // the camera and swapping layers on one live map is both simpler and how
  // 2D/3D toggles are normally done.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    const previous = previousViewRef.current;
    previousViewRef.current = view;
    viewRef.current = view;

    // A plain flat mount is a no-op: nothing to tear down, and animating the
    // camera on first paint would be wrong. Only an actual transition does
    // work here.
    if (view === previous) return;

    if (view === "threeD") {
      if (!map.getSource(VOLUME_SOURCE_ID)) {
        map.addSource(VOLUME_SOURCE_ID, { type: "geojson", data: volumes });
      }
      for (const layer of VOLUME_LAYERS) {
        if (!map.getLayer(layer.id)) {
          map.addLayer(layer.spec(layerFilter(layer, selection, view)));
        }
      }
      if (!compassRef.current) {
        compassRef.current = new NavigationControl({
          showZoom: false,
          showCompass: true,
          visualizePitch: true,
        });
        map.addControl(compassRef.current, "top-right");
      }
      // A little atmosphere so the tilted horizon reads as a scene.
      map.setSky({
        "sky-color": "#bfdbfe",
        "horizon-color": "#e2e8f0",
        "fog-color": "#f1f5f9",
        "sky-horizon-blend": 0.6,
        "horizon-fog-blend": 0.8,
        "fog-ground-blend": 0.9,
      });
      map.easeTo({
        zoom: PERSPECTIVE_ZOOM,
        pitch: PERSPECTIVE_PITCH,
        bearing: PERSPECTIVE_BEARING,
        duration: 900,
      });
    } else {
      for (const layer of VOLUME_LAYERS) {
        if (map.getLayer(layer.id)) map.removeLayer(layer.id);
      }
      if (map.getSource(VOLUME_SOURCE_ID)) map.removeSource(VOLUME_SOURCE_ID);
      if (compassRef.current) {
        map.removeControl(compassRef.current);
        compassRef.current = null;
      }
      map.setSky(undefined as never);
      map.easeTo({
        zoom: MEADOWLANDS_ZOOM,
        pitch: 0,
        bearing: 0,
        duration: 900,
      });
    }

    // The flat layers' filters depend on the view (volumetric features are
    // hidden from them in 3D), so refresh them too.
    for (const layer of PROPOSAL_LAYERS) {
      if (!map.getLayer(layer.id)) continue;
      map.setFilter(
        layer.id,
        layerFilter(layer, selection, view) as FilterSpecification,
      );
    }
    // selection is read here but intentionally not a dependency: the effect
    // above handles selection changes, and re-running the camera animation
    // on every selection change would be wrong.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, styleReady, volumes]);

  // Outline the project whose card is open.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    const highlightId = "proposals-active-highlight";
    if (map.getLayer(highlightId)) map.removeLayer(highlightId);
    if (!activeProjectId) return;
    map.addLayer({
      id: highlightId,
      type: "line",
      source: SOURCE_ID,
      filter: [
        "==",
        ["get", "project_id"],
        activeProjectId,
      ] as FilterSpecification,
      paint: { "line-color": "#0f172a", "line-width": 2, "line-dasharray": [1, 1] },
    });
  }, [activeProjectId, styleReady]);

  // Cleanup: releases the compass control reference with the map.
  useEffect(() => () => {
    compassRef.current = null;
  }, []);

  return (
    <div
      ref={containerRef}
      data-testid="maplibre-container"
      className="h-[540px] w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800"
    />
  );
}

export { PROPOSAL_LAYERS, layerFilter, SOURCE_ID };
