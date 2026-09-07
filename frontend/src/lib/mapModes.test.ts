import { describe, expect, it } from "vitest";
import {
  MAP_MODES,
  buildLayerFilters,
  idFilter,
  isScenarioDependent,
  resolveMapSelection,
  type MapMode,
  type ScenarioProject,
} from "./mapModes";

/** The 24 real nynj candidate IDs, as they appear in nynj_projects.geojson. */
const ALL_CANDIDATE_IDS = [
  "nynj-access-PERM",
  "nynj-access-TMP",
  "nynj-bike-PERM",
  "nynj-bike-TMP",
  "nynj-buslane-PERM",
  "nynj-buslane-TMP",
  "nynj-hub-PERM",
  "nynj-hub-TMP",
  "nynj-parkride-PERM",
  "nynj-parkride-TMP",
  "nynj-ped-PERM",
  "nynj-ped-TMP",
  "nynj-service-PERM",
  "nynj-service-TMP",
  "nynj-signals-PERM",
  "nynj-signals-TMP",
  "nynj-station-PERM",
  "nynj-station-TMP",
  "nynj-tnc-PERM",
  "nynj-tnc-TMP",
  "nynj-toc-PERM",
  "nynj-toc-TMP",
  "nynj-wayfinding-PERM",
  "nynj-wayfinding-TMP",
];

/**
 * A realistic scenario: the portfolio the optimizer actually returns for the
 * canonical nynj request (18 of the 24 candidates -- access, bike and
 * parkride are not funded).
 */
const SCENARIO: ScenarioProject[] = [
  { projectId: "nynj-service-TMP", phase: "temporary" },
  { projectId: "nynj-service-PERM", phase: "permanent" },
  { projectId: "nynj-buslane-TMP", phase: "temporary" },
  { projectId: "nynj-buslane-PERM", phase: "permanent" },
  { projectId: "nynj-signals-TMP", phase: "temporary" },
  { projectId: "nynj-signals-PERM", phase: "permanent" },
  { projectId: "nynj-hub-TMP", phase: "temporary" },
  { projectId: "nynj-hub-PERM", phase: "permanent" },
  { projectId: "nynj-ped-TMP", phase: "temporary" },
  { projectId: "nynj-ped-PERM", phase: "permanent" },
  { projectId: "nynj-tnc-TMP", phase: "temporary" },
  { projectId: "nynj-tnc-PERM", phase: "permanent" },
  { projectId: "nynj-wayfinding-TMP", phase: "temporary" },
  { projectId: "nynj-wayfinding-PERM", phase: "permanent" },
  { projectId: "nynj-station-TMP", phase: "temporary" },
  { projectId: "nynj-station-PERM", phase: "permanent" },
  { projectId: "nynj-toc-TMP", phase: "temporary" },
  { projectId: "nynj-toc-PERM", phase: "permanent" },
];

/** IDs the scenario did NOT select -- these must never render as selected. */
const UNSELECTED_IDS = ALL_CANDIDATE_IDS.filter(
  (id) => !SCENARIO.some((p) => p.projectId === id),
);

describe("resolveMapSelection", () => {
  // -------------------------------------------------------------------
  // Rule 12: Baseline hides every modeled proposal.
  // -------------------------------------------------------------------

  it("baseline draws nothing at all, even with a full scenario", () => {
    const selection = resolveMapSelection("baseline", SCENARIO, ALL_CANDIDATE_IDS);
    expect(selection.selectedIds).toEqual([]);
    expect(selection.candidateIds).toEqual([]);
  });

  it("baseline draws nothing for any scenario input whatsoever", () => {
    for (const scenario of [null, [], SCENARIO]) {
      const selection = resolveMapSelection(
        "baseline",
        scenario,
        ALL_CANDIDATE_IDS,
      );
      expect(selection.selectedIds).toHaveLength(0);
      expect(selection.candidateIds).toHaveLength(0);
    }
  });

  it("baseline hides every single candidate ID individually", () => {
    const selection = resolveMapSelection("baseline", SCENARIO, ALL_CANDIDATE_IDS);
    const drawn = new Set([...selection.selectedIds, ...selection.candidateIds]);
    for (const id of ALL_CANDIDATE_IDS) {
      expect(drawn.has(id)).toBe(false);
    }
  });

  // -------------------------------------------------------------------
  // Rule 11/13: an unselected ID never renders as selected.
  // -------------------------------------------------------------------

  it("never marks an unselected ID as selected, in any mode", () => {
    expect(UNSELECTED_IDS).toHaveLength(6); // access, bike, parkride x2 phases
    for (const mode of MAP_MODES) {
      const selection = resolveMapSelection(mode, SCENARIO, ALL_CANDIDATE_IDS);
      for (const unselectedId of UNSELECTED_IDS) {
        expect(selection.selectedIds).not.toContain(unselectedId);
      }
    }
  });

  it("only ever marks IDs the scenario actually returned", () => {
    const scenarioIds = new Set(SCENARIO.map((p) => p.projectId));
    for (const mode of MAP_MODES) {
      const selection = resolveMapSelection(mode, SCENARIO, ALL_CANDIDATE_IDS);
      for (const id of selection.selectedIds) {
        expect(scenarioIds.has(id)).toBe(true);
      }
    }
  });

  it("selects nothing in any mode when no scenario has been run", () => {
    for (const mode of MAP_MODES) {
      const selection = resolveMapSelection(mode, null, ALL_CANDIDATE_IDS);
      expect(selection.selectedIds).toEqual([]);
    }
  });

  it("selects nothing when the scenario selected nothing", () => {
    for (const mode of MAP_MODES) {
      const selection = resolveMapSelection(mode, [], ALL_CANDIDATE_IDS);
      expect(selection.selectedIds).toEqual([]);
    }
  });

  // -------------------------------------------------------------------
  // Phase separation
  // -------------------------------------------------------------------

  it("Temporary Operations shows only selected temporary-phase projects", () => {
    const selection = resolveMapSelection(
      "temporaryOperations",
      SCENARIO,
      ALL_CANDIDATE_IDS,
    );
    expect(selection.selectedIds).toHaveLength(9);
    expect(selection.selectedIds.every((id) => id.endsWith("-TMP"))).toBe(true);
    expect(selection.candidateIds).toEqual([]);
  });

  it("Selected Legacy shows only selected permanent-phase projects", () => {
    const selection = resolveMapSelection(
      "selectedLegacy",
      SCENARIO,
      ALL_CANDIDATE_IDS,
    );
    expect(selection.selectedIds).toHaveLength(9);
    expect(selection.selectedIds.every((id) => id.endsWith("-PERM"))).toBe(true);
    expect(selection.candidateIds).toEqual([]);
  });

  it("the two selected modes never share a project", () => {
    const temporary = resolveMapSelection(
      "temporaryOperations",
      SCENARIO,
      ALL_CANDIDATE_IDS,
    ).selectedIds;
    const permanent = resolveMapSelection(
      "selectedLegacy",
      SCENARIO,
      ALL_CANDIDATE_IDS,
    ).selectedIds;
    expect(temporary.filter((id) => permanent.includes(id))).toEqual([]);
  });

  it("trusts the scenario's phase field, not the ID suffix", () => {
    // A scenario claiming a -TMP id is permanent is routed by its phase field.
    const odd: ScenarioProject[] = [
      { projectId: "nynj-service-TMP", phase: "permanent" },
    ];
    expect(
      resolveMapSelection("selectedLegacy", odd, ALL_CANDIDATE_IDS).selectedIds,
    ).toEqual(["nynj-service-TMP"]);
    expect(
      resolveMapSelection("temporaryOperations", odd, ALL_CANDIDATE_IDS)
        .selectedIds,
    ).toEqual([]);
  });

  // -------------------------------------------------------------------
  // All Possibilities
  // -------------------------------------------------------------------

  it("All Possibilities draws every candidate translucently and selects none", () => {
    const selection = resolveMapSelection(
      "allPossibilities",
      SCENARIO,
      ALL_CANDIDATE_IDS,
    );
    expect(selection.candidateIds).toEqual(ALL_CANDIDATE_IDS);
    expect(selection.candidateIds).toHaveLength(24);
    // "possible" must never be styled as "chosen"
    expect(selection.selectedIds).toEqual([]);
  });

  it("All Possibilities does not depend on a scenario existing", () => {
    const withScenario = resolveMapSelection(
      "allPossibilities",
      SCENARIO,
      ALL_CANDIDATE_IDS,
    );
    const without = resolveMapSelection(
      "allPossibilities",
      null,
      ALL_CANDIDATE_IDS,
    );
    expect(without).toEqual(withScenario);
  });

  // -------------------------------------------------------------------
  // The map cannot render geometry it does not have
  // -------------------------------------------------------------------

  it("drops a selected ID the loaded geometry has no feature for", () => {
    // e.g. an Atlanta scenario against the nynj map.
    const foreign: ScenarioProject[] = [
      { projectId: "atlanta-service-TMP", phase: "temporary" },
      { projectId: "nynj-service-TMP", phase: "temporary" },
    ];
    const selection = resolveMapSelection(
      "temporaryOperations",
      foreign,
      ALL_CANDIDATE_IDS,
    );
    expect(selection.selectedIds).toEqual(["nynj-service-TMP"]);
  });

  it("renders nothing when the whole scenario belongs to another city", () => {
    const atlanta: ScenarioProject[] = [
      { projectId: "atlanta-service-TMP", phase: "temporary" },
      { projectId: "atlanta-service-PERM", phase: "permanent" },
    ];
    for (const mode of MAP_MODES) {
      expect(
        resolveMapSelection(mode, atlanta, ALL_CANDIDATE_IDS).selectedIds,
      ).toEqual([]);
    }
  });

  it("handles empty geometry without selecting anything", () => {
    for (const mode of MAP_MODES) {
      const selection = resolveMapSelection(mode, SCENARIO, []);
      expect(selection.selectedIds).toEqual([]);
      expect(selection.candidateIds).toEqual([]);
    }
  });
});

describe("isScenarioDependent", () => {
  it("marks exactly the two selected modes as scenario-dependent", () => {
    expect(isScenarioDependent("temporaryOperations")).toBe(true);
    expect(isScenarioDependent("selectedLegacy")).toBe(true);
    expect(isScenarioDependent("baseline")).toBe(false);
    expect(isScenarioDependent("allPossibilities")).toBe(false);
  });
});

describe("buildLayerFilters", () => {
  it("produces a filter that matches nothing when no IDs are selected", () => {
    const filters = buildLayerFilters(
      resolveMapSelection("baseline", SCENARIO, ALL_CANDIDATE_IDS),
    );
    expect(filters.selected).toEqual([
      "in",
      ["get", "project_id"],
      ["literal", []],
    ]);
    expect(filters.candidate).toEqual([
      "in",
      ["get", "project_id"],
      ["literal", []],
    ]);
  });

  it("lists exactly the selected IDs in the selected-layer filter", () => {
    const selection = resolveMapSelection(
      "selectedLegacy",
      SCENARIO,
      ALL_CANDIDATE_IDS,
    );
    const filters = buildLayerFilters(selection);
    expect(filters.selected[2][1]).toEqual(selection.selectedIds);
    for (const unselectedId of UNSELECTED_IDS) {
      expect(filters.selected[2][1]).not.toContain(unselectedId);
    }
  });

  it("idFilter copies its input so later mutation cannot leak into a layer", () => {
    const ids = ["nynj-ped-PERM"];
    const filter = idFilter(ids);
    ids.push("nynj-bike-PERM");
    expect(filter[2][1]).toEqual(["nynj-ped-PERM"]);
  });
});

/** Guard: every mode must be handled, so adding one cannot silently no-op. */
describe("mode coverage", () => {
  it("resolves every declared mode", () => {
    for (const mode of MAP_MODES satisfies readonly MapMode[]) {
      expect(
        resolveMapSelection(mode, SCENARIO, ALL_CANDIDATE_IDS),
      ).toBeDefined();
    }
    expect(MAP_MODES).toHaveLength(4);
  });
});
