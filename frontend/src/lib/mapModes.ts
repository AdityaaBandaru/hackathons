/**
 * Map display modes and the rule for what each one may render.
 *
 * This module is the single place that decides which project IDs the map is
 * allowed to draw, and it is deliberately pure so the invariant can be proven
 * by test rather than by inspecting a WebGL canvas.
 *
 * Two rules from CLAUDE.md are enforced here and nowhere else:
 *
 *   Rule 12 -- Baseline mode hides every modeled proposal.
 *   Rule 13 -- Selected Legacy mode renders only IDs returned by the current
 *              scenario.
 *
 * And the rule that makes both of them safe (rule 11): the optimizer's
 * response is the *only* source of "selected". Nothing here derives, guesses,
 * or falls back to a default portfolio. With no scenario, nothing is selected.
 */

export const MAP_MODES = [
  "baseline",
  "temporaryOperations",
  "selectedLegacy",
  "allPossibilities",
] as const;

export type MapMode = (typeof MAP_MODES)[number];

export const MAP_MODE_LABELS: Record<MapMode, string> = {
  baseline: "Baseline",
  temporaryOperations: "Temporary Operations",
  selectedLegacy: "Selected Legacy",
  allPossibilities: "All Possibilities",
};

export const MAP_MODE_DESCRIPTIONS: Record<MapMode, string> = {
  baseline: "Today's network. No modeled proposal is drawn.",
  temporaryOperations:
    "Only the temporary-phase projects the current optimizer scenario selected.",
  selectedLegacy:
    "Only the permanent-phase projects the current optimizer scenario selected.",
  allPossibilities:
    "Every candidate project the optimizer could choose from, drawn translucently. None is marked as selected.",
};

/** Modes that draw nothing at all unless an optimizer scenario exists. */
export const SCENARIO_DEPENDENT_MODES: readonly MapMode[] = [
  "temporaryOperations",
  "selectedLegacy",
];

export function isScenarioDependent(mode: MapMode): boolean {
  return SCENARIO_DEPENDENT_MODES.includes(mode);
}

/** The minimum a scenario project needs for the map to place it. */
export interface ScenarioProject {
  projectId: string;
  phase: "temporary" | "permanent";
}

export interface MapSelection {
  /** Drawn in full-strength "selected" styling. */
  selectedIds: string[];
  /** Drawn translucently as an unselected candidate. */
  candidateIds: string[];
}

const EMPTY_SELECTION: MapSelection = { selectedIds: [], candidateIds: [] };

/**
 * Decide which project IDs the map may draw, and in which role.
 *
 * @param mode              the active display mode
 * @param scenarioProjects  projects returned by the current optimizer run, or
 *                          null when no scenario has been run. Never a default.
 * @param allCandidateIds   every project ID the loaded geometry actually has.
 *                          An ID the map has no geometry for is dropped: the
 *                          map cannot render what it was not given.
 */
export function resolveMapSelection(
  mode: MapMode,
  scenarioProjects: readonly ScenarioProject[] | null,
  allCandidateIds: readonly string[],
): MapSelection {
  const available = new Set(allCandidateIds);

  switch (mode) {
    case "baseline":
      // Rule 12: nothing modeled is drawn, whatever the scenario says.
      return EMPTY_SELECTION;

    case "allPossibilities":
      // Every candidate, translucent. Nothing is styled as selected here --
      // "possible" is not "chosen", and the two must not look alike.
      return { selectedIds: [], candidateIds: [...allCandidateIds] };

    case "temporaryOperations":
    case "selectedLegacy": {
      if (!scenarioProjects) return EMPTY_SELECTION;
      const phase = mode === "temporaryOperations" ? "temporary" : "permanent";
      const selectedIds = scenarioProjects
        .filter(
          (project) =>
            project.phase === phase && available.has(project.projectId),
        )
        .map((project) => project.projectId);
      return { selectedIds, candidateIds: [] };
    }
  }
}

/**
 * MapLibre filter expressions for the two proposal layers.
 *
 * An empty ID list yields a filter that matches nothing, so a layer with no
 * IDs renders no features rather than falling through to "match everything".
 */
export function buildLayerFilters(selection: MapSelection) {
  return {
    selected: idFilter(selection.selectedIds),
    candidate: idFilter(selection.candidateIds),
  };
}

export function idFilter(ids: readonly string[]) {
  return ["in", ["get", "project_id"], ["literal", [...ids]]] as const;
}
