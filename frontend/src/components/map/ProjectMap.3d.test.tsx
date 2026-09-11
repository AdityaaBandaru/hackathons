/**
 * The 3D perspective view of ProjectMap.
 *
 * Kept separate from ProjectMap.test.tsx, which covers the flat view and is
 * unchanged. This file proves that switching the same map into 3D keeps every
 * selection invariant already proven for the flat view, and that the
 * extrusion layers -- the only new rendering surface -- are wired to the same
 * project-ID filters as everything else.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import type { FeatureCollection } from "geojson";
import { MAP_MODES, resolveMapSelection, type MapMode } from "@/lib/mapModes";
import type { MapView } from "@/lib/map3d";

interface RecordedLayer {
  id: string;
  filter: unknown;
  type?: string;
  paint?: Record<string, unknown>;
}

const recorded = {
  layers: [] as RecordedLayer[],
  removedLayers: [] as string[],
  setFilters: [] as RecordedLayer[],
  sources: [] as { id: string; data: FeatureCollection }[],
  removedSources: [] as string[],
  eases: [] as Record<string, unknown>[],
  skies: [] as unknown[],
  controls: [] as Record<string, unknown>[],
  removedControls: [] as unknown[],
};

vi.mock("maplibre-gl", () => {
  class FakeMap {
    private layerIds = new Set<string>();
    private sourceIds = new Set<string>();
    private currentLayers = new Map<string, RecordedLayer>();
    on(event: string, layerOrCb: unknown) {
      if (event === "load" && typeof layerOrCb === "function") {
        (layerOrCb as () => void)();
      }
      return this;
    }
    addControl(control: unknown) {
      recorded.controls.push(control as Record<string, unknown>);
      return this;
    }
    removeControl(control: unknown) {
      recorded.removedControls.push(control);
      return this;
    }
    addSource(id: string, source: { data: FeatureCollection }) {
      this.sourceIds.add(id);
      const stale = recorded.removedSources.indexOf(id);
      if (stale !== -1) recorded.removedSources.splice(stale, 1);
      recorded.sources = recorded.sources.filter((s) => s.id !== id);
      recorded.sources.push({ id, data: source.data });
      return this;
    }
    getSource(id: string) {
      return this.sourceIds.has(id) ? { id } : undefined;
    }
    removeSource(id: string) {
      this.sourceIds.delete(id);
      recorded.removedSources.push(id);
      return this;
    }
    addLayer(layer: RecordedLayer) {
      this.layerIds.add(layer.id);
      this.currentLayers.set(layer.id, layer);
      // Re-adding an ID that was removed earlier resurrects it: drop the
      // stale removal record so "live" accounting stays correct across
      // repeated toggles.
      const stale = recorded.removedLayers.indexOf(layer.id);
      if (stale !== -1) recorded.removedLayers.splice(stale, 1);
      recorded.layers = recorded.layers.filter((l) => l.id !== layer.id);
      recorded.layers.push(layer);
      return this;
    }
    getLayer(id: string) {
      return this.layerIds.has(id) ? { id } : undefined;
    }
    removeLayer(id: string) {
      this.layerIds.delete(id);
      this.currentLayers.delete(id);
      recorded.removedLayers.push(id);
      return this;
    }
    setFilter(id: string, filter: unknown) {
      recorded.setFilters.push({ id, filter });
      const layer = this.currentLayers.get(id);
      if (layer) layer.filter = filter;
      return this;
    }
    easeTo(options: Record<string, unknown>) {
      recorded.eases.push(options);
      return this;
    }
    setSky(sky: unknown) {
      recorded.skies.push(sky);
      return this;
    }
    getCanvas() {
      return { style: {} };
    }
    queryRenderedFeatures() {
      return [];
    }
    remove() {}
  }
  class FakeControl {
    constructor(public options?: Record<string, unknown>) {}
  }
  return {
    Map: FakeMap,
    NavigationControl: FakeControl,
    AttributionControl: FakeControl,
    ScaleControl: FakeControl,
    setWorkerUrl: () => {},
  };
});

vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

const { ProjectMap, PERSPECTIVE_PITCH, PERSPECTIVE_BEARING, MEADOWLANDS_ZOOM } =
  await import("./ProjectMap");

/**
 * Six candidates spanning both sides of the extrusion rule:
 *   hub     polygon_extrusion -> extrudes (stored as a Polygon)
 *   station glb_model         -> extrudes (stored as a Point; footprint built)
 *   bike    line_extrusion    -> stays flat
 */
const CANDIDATE_IDS = [
  "nynj-hub-TMP",
  "nynj-hub-PERM",
  "nynj-station-TMP",
  "nynj-station-PERM",
  "nynj-bike-TMP",
  "nynj-bike-PERM",
];

const SCENARIO = [
  { projectId: "nynj-hub-TMP", phase: "temporary" as const },
  { projectId: "nynj-hub-PERM", phase: "permanent" as const },
  { projectId: "nynj-station-TMP", phase: "temporary" as const },
  { projectId: "nynj-station-PERM", phase: "permanent" as const },
];

const UNSELECTED_IDS = ["nynj-bike-TMP", "nynj-bike-PERM"];

function feature(
  project_id: string,
  geometry_type: string,
  geometry: FeatureCollection["features"][number]["geometry"],
  height_m: number,
) {
  return {
    type: "Feature" as const,
    properties: {
      project_id,
      geometry_type,
      color: "#F59E0B",
      height_m,
      length_m: 120,
      width_m: 45,
      bearing_deg: 32,
    },
    geometry,
  };
}

const square = (lon: number, lat: number) => ({
  type: "Polygon" as const,
  coordinates: [
    [
      [lon, lat],
      [lon + 0.001, lat],
      [lon + 0.001, lat + 0.001],
      [lon, lat + 0.001],
      [lon, lat],
    ],
  ],
});

const GEOJSON: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    feature("nynj-hub-TMP", "polygon_extrusion", square(-74.07, 40.807), 3),
    feature("nynj-hub-PERM", "polygon_extrusion", square(-74.072, 40.807), 6),
    feature("nynj-station-TMP", "glb_model", { type: "Point", coordinates: [-74.0698, 40.8077] }, 6),
    feature("nynj-station-PERM", "glb_model", { type: "Point", coordinates: [-74.0699, 40.8078] }, 18),
    feature("nynj-bike-TMP", "line_extrusion", { type: "LineString", coordinates: [[-74.075, 40.805], [-74.073, 40.806]] }, 0.1),
    feature("nynj-bike-PERM", "line_extrusion", { type: "LineString", coordinates: [[-74.076, 40.805], [-74.074, 40.806]] }, 0.1),
  ],
};

function mapFor(mode: MapMode, view: MapView, scenario = SCENARIO) {
  const selection = resolveMapSelection(mode, scenario, CANDIDATE_IDS);
  return (
    <ProjectMap
      geojson={GEOJSON}
      selection={selection}
      activeProjectId={null}
      onSelectProject={() => {}}
      view={view}
    />
  );
}

/** Mount flat, then switch to 3D -- the transition the real page performs. */
function renderInto3D(mode: MapMode, scenario = SCENARIO) {
  const utils = render(mapFor(mode, "flat", scenario));
  act(() => {
    utils.rerender(mapFor(mode, "threeD", scenario));
  });
  return utils;
}

/** IDs in a filter of the form ["all", ...clauses] where one clause is the ID list. */
function idsInFilter(filter: unknown): string[] {
  const clauses = (filter as unknown[]).slice(1) as unknown[];
  const idClause = clauses.find(
    (c) => Array.isArray(c) && c[0] === "in" && Array.isArray(c[1]) && c[1][1] === "project_id",
  ) as [string, unknown, [string, string[]]] | undefined;
  return idClause ? idClause[2][1] : [];
}

const volumeLayers = () =>
  recorded.layers.filter((l) => l.id.startsWith("proposals-volume-"));
const liveVolumeLayers = () => {
  // A layer is live if added and not subsequently removed.
  const removed = new Set(recorded.removedLayers);
  return volumeLayers().filter((l) => !removed.has(l.id));
};

beforeEach(() => {
  for (const key of Object.keys(recorded) as (keyof typeof recorded)[]) {
    (recorded[key] as unknown[]).length = 0;
  }
  cleanup();
});

describe("entering and leaving the 3D view", () => {
  it("a flat mount adds no volume layers, no volume source and no compass", () => {
    render(mapFor("allPossibilities", "flat"));
    expect(volumeLayers()).toHaveLength(0);
    expect(recorded.sources.map((s) => s.id)).not.toContain("nynj-proposals-volumes");
    expect(recorded.eases).toHaveLength(0); // no camera animation on load
    expect(recorded.controls.some((c) => (c.options as Record<string, unknown>)?.showCompass === true)).toBe(false);
  });

  it("switching to 3D tilts the camera and adds the pitch/bearing control", () => {
    renderInto3D("allPossibilities");
    const ease = recorded.eases.at(-1)!;
    expect(ease.pitch).toBe(PERSPECTIVE_PITCH);
    expect(ease.bearing).toBe(PERSPECTIVE_BEARING);
    expect(PERSPECTIVE_PITCH).toBeGreaterThan(0);
    const compass = recorded.controls.find(
      (c) => (c.options as Record<string, unknown>)?.showCompass === true,
    );
    expect(compass).toBeDefined();
    expect((compass!.options as Record<string, unknown>).visualizePitch).toBe(true);
  });

  it("switching to 3D adds a selected and a candidate extrusion layer", () => {
    renderInto3D("allPossibilities");
    const ids = liveVolumeLayers().map((l) => l.id).sort();
    expect(ids).toEqual(["proposals-volume-candidate", "proposals-volume-selected"]);
    for (const layer of liveVolumeLayers()) {
      expect(layer.type).toBe("fill-extrusion");
    }
  });

  it("extrusion height comes from each project's own height_m, base at ground", () => {
    renderInto3D("allPossibilities");
    for (const layer of liveVolumeLayers()) {
      expect(layer.paint?.["fill-extrusion-height"]).toEqual(["get", "height_m"]);
      expect(layer.paint?.["fill-extrusion-base"]).toBe(0);
    }
  });

  it("the volume source holds only volumetric categories, all as polygons", () => {
    renderInto3D("allPossibilities");
    const source = recorded.sources.find((s) => s.id === "nynj-proposals-volumes")!;
    expect(source.data.features.map((f) => f.properties?.project_id).sort()).toEqual([
      "nynj-hub-PERM",
      "nynj-hub-TMP",
      "nynj-station-PERM",
      "nynj-station-TMP",
    ]);
    expect(source.data.features.every((f) => f.geometry.type === "Polygon")).toBe(true);
  });

  it("switching back to flat removes the volumes, the compass, and resets the camera", () => {
    const utils = renderInto3D("allPossibilities");
    act(() => {
      utils.rerender(mapFor("allPossibilities", "flat"));
    });
    expect(liveVolumeLayers()).toHaveLength(0);
    expect(recorded.removedSources).toContain("nynj-proposals-volumes");
    expect(recorded.removedControls).toHaveLength(1);
    const ease = recorded.eases.at(-1)!;
    expect(ease.pitch).toBe(0);
    expect(ease.bearing).toBe(0);
    expect(ease.zoom).toBe(MEADOWLANDS_ZOOM);
  });

  it("survives repeated toggling without duplicating layers or sources", () => {
    const utils = renderInto3D("allPossibilities");
    for (let i = 0; i < 3; i++) {
      act(() => utils.rerender(mapFor("allPossibilities", "flat")));
      act(() => utils.rerender(mapFor("allPossibilities", "threeD")));
    }
    expect(liveVolumeLayers()).toHaveLength(2);
    // Adds dedupe by id and removals are cleared on re-add, so a live source
    // appears exactly once and a dead one is listed in removedSources.
    expect(recorded.sources.filter((s) => s.id === "nynj-proposals-volumes")).toHaveLength(1);
    expect(recorded.removedSources).not.toContain("nynj-proposals-volumes");
  });
});

describe("3D selection invariants", () => {
  // -------------------------------------------------------------------
  // Rule 12: baseline hides every proposal -- in 3D too.
  // -------------------------------------------------------------------

  it("baseline gives every extrusion layer a filter matching nothing", () => {
    renderInto3D("baseline");
    expect(liveVolumeLayers()).toHaveLength(2);
    for (const layer of liveVolumeLayers()) {
      expect(idsInFilter(layer.filter)).toEqual([]);
    }
  });

  it("baseline never lets a candidate ID into any layer, flat or extruded", () => {
    renderInto3D("baseline");
    const removed = new Set(recorded.removedLayers);
    const live = recorded.layers.filter((l) => !removed.has(l.id));
    const allIds = live.flatMap((l) => idsInFilter(l.filter));
    expect(allIds).toEqual([]);
  });

  // -------------------------------------------------------------------
  // Rule 11/13: an unselected ID is never extruded as selected.
  // -------------------------------------------------------------------

  it("never extrudes an unselected ID as selected, in any mode", () => {
    for (const mode of MAP_MODES) {
      cleanup();
      recorded.layers.length = 0;
      recorded.removedLayers.length = 0;
      renderInto3D(mode);
      const selected = liveVolumeLayers().find((l) => l.id.endsWith("-selected"))!;
      const ids = idsInFilter(selected.filter);
      for (const unselectedId of UNSELECTED_IDS) {
        expect(ids).not.toContain(unselectedId);
      }
      for (const id of ids) {
        expect(SCENARIO.map((p) => p.projectId)).toContain(id);
      }
    }
  });

  it("selects nothing in any mode when no scenario has been run", () => {
    for (const mode of MAP_MODES) {
      cleanup();
      recorded.layers.length = 0;
      recorded.removedLayers.length = 0;
      renderInto3D(mode, null as never);
      for (const layer of liveVolumeLayers().filter((l) => l.id.endsWith("-selected"))) {
        expect(idsInFilter(layer.filter)).toEqual([]);
      }
    }
  });

  it("Temporary Operations extrudes only the scenario's temporary volumes", () => {
    renderInto3D("temporaryOperations");
    const selected = liveVolumeLayers().find((l) => l.id.endsWith("-selected"))!;
    expect(idsInFilter(selected.filter)).toEqual(["nynj-hub-TMP", "nynj-station-TMP"]);
  });

  it("Selected Legacy extrudes only the scenario's permanent volumes", () => {
    renderInto3D("selectedLegacy");
    const selected = liveVolumeLayers().find((l) => l.id.endsWith("-selected"))!;
    expect(idsInFilter(selected.filter)).toEqual(["nynj-hub-PERM", "nynj-station-PERM"]);
  });

  it("All Possibilities extrudes every volume and highlights only the scenario's picks", () => {
    renderInto3D("allPossibilities");
    const candidate = liveVolumeLayers().find((l) => l.id.endsWith("-candidate"))!;
    const selected = liveVolumeLayers().find((l) => l.id.endsWith("-selected"))!;
    expect(idsInFilter(candidate.filter)).toEqual(CANDIDATE_IDS);
    expect(idsInFilter(selected.filter)).toEqual(SCENARIO.map((p) => p.projectId));
  });

  it("produces the same selected-ID set as the flat view for every mode", () => {
    for (const mode of MAP_MODES) {
      cleanup();
      recorded.layers.length = 0;
      recorded.removedLayers.length = 0;
      const selection = resolveMapSelection(mode, SCENARIO, CANDIDATE_IDS);
      renderInto3D(mode);
      const removed = new Set(recorded.removedLayers);
      const selectedLayers = recorded.layers.filter(
        (l) => !removed.has(l.id) && l.id.endsWith("-selected"),
      );
      const ids = new Set(selectedLayers.flatMap((l) => idsInFilter(l.filter)));
      expect([...ids].sort()).toEqual([...new Set(selection.selectedIds)].sort());
    }
  });
});

describe("flat layers in 3D", () => {
  it("hide volumetric categories so they are not drawn flat under their extrusion", () => {
    renderInto3D("allPossibilities");
    const removed = new Set(recorded.removedLayers);
    const flatLayers = recorded.layers.filter(
      (l) => !removed.has(l.id) && !l.id.startsWith("proposals-volume-") && !l.id.includes("active"),
    );
    expect(flatLayers.length).toBeGreaterThan(0);
    for (const layer of flatLayers) {
      const clauses = (layer.filter as unknown[]).slice(1);
      const excludesVolumetric = clauses.some(
        (c) => Array.isArray(c) && c[0] === "!" && JSON.stringify(c).includes("geometry_type"),
      );
      expect(excludesVolumetric).toBe(true);
    }
  });

  it("do not carry that exclusion in the flat view", () => {
    render(mapFor("allPossibilities", "flat"));
    for (const layer of recorded.layers) {
      expect(JSON.stringify(layer.filter)).not.toContain("geometry_type");
    }
  });
});
