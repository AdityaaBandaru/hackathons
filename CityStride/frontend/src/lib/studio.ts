import type { Project3D, SelectedProject } from "./types";
import { resolveMapSelection, type MapMode } from "./mapModes";

export type StudioPhase = "permanent" | "temporary" | "compare";

/** The same scenario permissions as the map, before any model is constructed. */
export function studioProjects(
  projects: readonly Project3D[],
  selected: readonly SelectedProject[] | null,
  mode: MapMode,
): Project3D[] {
  // Historical renderEnabled describes the seeded demonstration, not the current scenario.
  const selection = resolveMapSelection(mode, selected, projects.map((p) => p.projectId));
  const allowed = new Set([...selection.selectedIds, ...selection.candidateIds]);
  return projects.filter((project) => allowed.has(project.projectId));
}

export function studioDimensions(project: Project3D) {
  const { lengthM, widthM, heightM } = project;
  if (![lengthM, widthM, heightM].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error(`Project ${project.projectId} has incomplete dimensions.`);
  }
  const isCorridor = project.geometryType === "line_extrusion" || project.geometryType === "animated_route";
  return {
    length: isCorridor ? Math.min(lengthM, 80) : lengthM,
    width: widthM,
    height: heightM,
    fullLength: lengthM,
    isSection: isCorridor && lengthM > 80,
  };
}

export function displayProjects(
  available: readonly Project3D[],
  category: string,
  phase: StudioPhase,
): Project3D[] {
  const candidates = available.filter((project) => project.category === category);
  return candidates
    .filter((project) => phase === "compare" || project.phase === phase)
    .sort((a, b) => (a.phase === b.phase ? 0 : a.phase === "temporary" ? -1 : 1));
}

export const STUDIO_DISCLOSURE =
  "Concept models, not approved designs. Overall dimensions come from the supplied project records. " +
  "Roofs, glazing, supports and markings are illustrative. Models are presented on a studio base, " +
  "not at surveyed locations. Long corridors show a labeled 80 m section; heights are not exaggerated.";
