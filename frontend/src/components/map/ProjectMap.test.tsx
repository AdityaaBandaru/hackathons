/**
 * Proves the rendering path honours the selection rules, not just the pure
 * resolver in mapModes.test.ts.
 *
 * maplibre-gl needs WebGL, which jsdom has no implementation for, so the
 * library is replaced with a fake Map that records every addLayer/setFilter
 * call. That is exactly the surface that decides what is drawn, so asserting
 * on it is a real proof: if an unselected ID ever reached a "selected" layer's
 * filter, these tests fail.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { FeatureCollection } from "geojson";
import { resolveMapSelection, type MapMode } from "@/lib/mapModes";

interface RecordedLayer {
  id: string;
  filter: unknown;
}

const recorded = {
  layers: [] as RecordedLayer[],
  setFilters: [] as RecordedLayer[],
  removedLayers: [] as string[],
  centers: [] as unknown[],
  zooms: [] as number[],
  workerUrls: [] as string[],
};

vi.mock("maplibre-gl", () => {
  class FakeMap {
    private handlers = new Map<string, (() => void)[]>();
    private layerIds = new Set<string>();

    constructor(options: { center: unknown; zoom: number }) {
      recorded.centers.push(options.center);
      recorded.zooms.push(options.zoom);
    }
    on(event: string, layerOrCb: unknown, maybeCb?: unknown) {
      // Fire "load" immediately so layers are created during render.
      if (event === "load" && typeof layerOrCb === "function") {
        (layerOrCb as () => void)();
      }
      void maybeCb;
      void this.handlers;
      return this;
    }
    addControl() {
      return this;
    }
    addSource() {
      return this;
    }
    addLayer(layer: { id: string; filter: unknown }) {
      this.layerIds.add(layer.id);
      recorded.layers.push({ id: layer.id, filter: layer.filter });
      return this;
    }
    getLayer(id: string) {
      return this.layerIds.has(id) ? { id } : undefined;
    }
    removeLayer(id: string) {
      this.layerIds.delete(id);
      recorded.removedLayers.push(id);
      return this;
    }
    setFilter(id: string, filter: unknown) {
      recorded.setFilters.push({ id, filter });
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
  return {
    Map: FakeMap,
    NavigationControl: class {},
    AttributionControl: class {},
    ScaleControl: class {},
    setWorkerUrl: (url: string) => recorded.workerUrls.push(url),
  };
});

vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

// Imported after the mock so the component picks up the fake library.
const { ProjectMap, MEADOWLANDS_CENTER } = await import("./ProjectMap");

const CANDIDATE_IDS = [
  "nynj-service-TMP",
  "nynj-service-PERM",
  "nynj-station-TMP",
  "nynj-station-PERM",
  "nynj-bike-TMP",
  "nynj-bike-PERM",
];

const SCENARIO = [
  { projectId: "nynj-service-TMP", phase: "temporary" as const },
  { projectId: "nynj-service-PERM", phase: "permanent" as const },
  { projectId: "nynj-station-TMP", phase: "temporary" as const },
  { projectId: "nynj-station-PERM", phase: "permanent" as const },
];

/** bike was never selected by the scenario. */
const UNSELECTED_IDS = ["nynj-bike-TMP", "nynj-bike-PERM"];

const GEOJSON: FeatureCollection = {
  type: "FeatureCollection",
  features: CANDIDATE_IDS.map((project_id, i) => ({
    type: "Feature",
    properties: { project_id, color: "#F59E0B" },
    geometry: { type: "Point", coordinates: [-74.07 + i * 0.001, 40.807] },
  })),
};

function renderMode(mode: MapMode) {
  const selection = resolveMapSelection(mode, SCENARIO, CANDIDATE_IDS);
  render(
    <ProjectMap
      geojson={GEOJSON}
      selection={selection}
      activeProjectId={null}
      onSelectProject={() => {}}
    />,
  );
  return selection;
}

/** Pull the ID list out of an `["all", geomFilter, ["in", ..., ["literal", ids]]]`. */
function idsInFilter(filter: unknown): string[] {
  const all = filter as [string, unknown, [string, unknown, [string, string[]]]];
  return all[2][2][1];
}

function filtersFor(role: "selected" | "candidate") {
  return recorded.layers.filter((l) => l.id.endsWith(`-${role}`));
}

beforeEach(() => {
  recorded.layers = [];
  recorded.setFilters = [];
  recorded.removedLayers = [];
  recorded.centers = [];
  recorded.zooms = [];
  cleanup();
});

describe("ProjectMap", () => {
  it("centers on the Meadowlands complex", () => {
    renderMode("allPossibilities");
    expect(recorded.centers[0]).toEqual(MEADOWLANDS_CENTER);
    expect(MEADOWLANDS_CENTER[0]).toBeCloseTo(-74.0707, 3);
    expect(MEADOWLANDS_CENTER[1]).toBeCloseTo(40.8077, 3);
  });

  it("points MapLibre at a locally served worker rather than an empty URL", () => {
    // An empty worker URL silently breaks every GeoJSON source.
    expect(recorded.workerUrls[0]).toBe("/maplibre/maplibre-gl-worker.mjs");
  });

  it("creates one selected and one candidate layer per geometry type", () => {
    renderMode("allPossibilities");
    expect(filtersFor("selected")).toHaveLength(3); // fill, line, point
    expect(filtersFor("candidate")).toHaveLength(3);
  });

  // -------------------------------------------------------------------
  // Rule 12: baseline hides every proposal
  // -------------------------------------------------------------------

  it("baseline gives every layer a filter that matches no project", () => {
    renderMode("baseline");
    expect(recorded.layers.length).toBeGreaterThan(0);
    for (const layer of recorded.layers) {
      expect(idsInFilter(layer.filter)).toEqual([]);
    }
  });

  it("baseline never lets a candidate ID into any layer filter", () => {
    renderMode("baseline");
    const allIds = recorded.layers.flatMap((l) => idsInFilter(l.filter));
    for (const id of CANDIDATE_IDS) {
      expect(allIds).not.toContain(id);
    }
    expect(allIds).toEqual([]);
  });

  // -------------------------------------------------------------------
  // Rule 11/13: an unselected ID never renders as selected
  // -------------------------------------------------------------------

  it("never puts an unselected ID into a selected-layer filter, in any mode", () => {
    for (const mode of [
      "baseline",
      "temporaryOperations",
      "selectedLegacy",
      "allPossibilities",
    ] as MapMode[]) {
      recorded.layers = [];
      cleanup();
      renderMode(mode);
      for (const layer of filtersFor("selected")) {
        for (const unselectedId of UNSELECTED_IDS) {
          expect(idsInFilter(layer.filter)).not.toContain(unselectedId);
        }
      }
    }
  });

  it("draws only the scenario's temporary projects in Temporary Operations", () => {
    renderMode("temporaryOperations");
    for (const layer of filtersFor("selected")) {
      expect(idsInFilter(layer.filter)).toEqual([
        "nynj-service-TMP",
        "nynj-station-TMP",
      ]);
    }
    for (const layer of filtersFor("candidate")) {
      expect(idsInFilter(layer.filter)).toEqual([]);
    }
  });

  it("draws only the scenario's permanent projects in Selected Legacy", () => {
    renderMode("selectedLegacy");
    for (const layer of filtersFor("selected")) {
      expect(idsInFilter(layer.filter)).toEqual([
        "nynj-service-PERM",
        "nynj-station-PERM",
      ]);
    }
  });

  it("All Possibilities fills candidate layers with every ID, unconditionally", () => {
    renderMode("allPossibilities");
    for (const layer of filtersFor("candidate")) {
      expect(idsInFilter(layer.filter)).toEqual(CANDIDATE_IDS);
    }
  });

  it("All Possibilities layers the selected styling on top of the scenario's own picks", () => {
    renderMode("allPossibilities");
    // service and station were selected by SCENARIO; bike was not.
    for (const layer of filtersFor("selected")) {
      const ids = idsInFilter(layer.filter);
      expect(ids).toEqual([
        "nynj-service-TMP",
        "nynj-service-PERM",
        "nynj-station-TMP",
        "nynj-station-PERM",
      ]);
      expect(ids).not.toContain("nynj-bike-TMP");
      expect(ids).not.toContain("nynj-bike-PERM");
    }
    // Every highlighted feature is still present in the candidate layer too
    // -- the highlight is additive, not a replacement.
    for (const candidateLayer of filtersFor("candidate")) {
      const candidateIds = idsInFilter(candidateLayer.filter);
      for (const selectedLayer of filtersFor("selected")) {
        for (const id of idsInFilter(selectedLayer.filter)) {
          expect(candidateIds).toContain(id);
        }
      }
    }
  });

  it("All Possibilities highlights nothing when no scenario has been run", () => {
    const selection = resolveMapSelection("allPossibilities", null, CANDIDATE_IDS);
    render(
      <ProjectMap
        geojson={GEOJSON}
        selection={selection}
        activeProjectId={null}
        onSelectProject={() => {}}
      />,
    );
    for (const layer of filtersFor("selected")) {
      expect(idsInFilter(layer.filter)).toEqual([]);
    }
    // Candidates are still all drawn.
    for (const layer of filtersFor("candidate")) {
      expect(idsInFilter(layer.filter)).toEqual(CANDIDATE_IDS);
    }
  });

  it("restricts each layer to its own geometry type", () => {
    renderMode("allPossibilities");
    const byId = new Map(recorded.layers.map((l) => [l.id, l.filter]));
    const geometryOf = (id: string) =>
      ((byId.get(id) as [string, [string, unknown, string]])[1] as [
        string,
        unknown,
        string,
      ])[2];
    expect(geometryOf("proposals-fill-selected")).toBe("Polygon");
    expect(geometryOf("proposals-line-selected")).toBe("LineString");
    expect(geometryOf("proposals-point-selected")).toBe("Point");
  });

  it("re-filters existing layers when the selection changes", () => {
    const { rerender } = render(
      <ProjectMap
        geojson={GEOJSON}
        selection={resolveMapSelection("selectedLegacy", SCENARIO, CANDIDATE_IDS)}
        activeProjectId={null}
        onSelectProject={() => {}}
      />,
    );
    recorded.setFilters = [];
    rerender(
      <ProjectMap
        geojson={GEOJSON}
        selection={resolveMapSelection("baseline", SCENARIO, CANDIDATE_IDS)}
        activeProjectId={null}
        onSelectProject={() => {}}
      />,
    );
    expect(recorded.setFilters.length).toBeGreaterThan(0);
    for (const applied of recorded.setFilters) {
      expect(idsInFilter(applied.filter)).toEqual([]);
    }
  });
});
