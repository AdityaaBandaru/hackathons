import { describe, expect, it } from "vitest";
import { Box3, Vector3, Mesh } from "three";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildProjectModel, disposeObject } from "./projectModels";
import { studioDimensions, studioProjects, displayProjects } from "./studio";
import type { Project3D, SelectedProject } from "./types";

const projects: Project3D[] = JSON.parse(readFileSync(resolve(process.cwd(), "../backend/app/data/seed/projects3d.json"), "utf8"));
const nynj = projects.filter((project) => project.cityId === "nynj");
const selection = [nynj.find((project) => project.projectId === "nynj-station-PERM")!, nynj.find((project) => project.projectId === "nynj-hub-TMP")!] as unknown as SelectedProject[];

describe("3D model integrity", () => {
  it("builds all 264 supplied concepts within their dimension envelopes and retains provenance", () => {
    for (const project of projects) {
      const dimensions = studioDimensions(project);
      const model = buildProjectModel(project);
      const bounds = new Box3().setFromObject(model);
      const size = bounds.getSize(new Vector3());
      expect(model.children.length, project.projectId).toBeGreaterThan(1);
      expect(size.x, project.projectId).toBeLessThanOrEqual(dimensions.length + 0.001);
      expect(size.z, project.projectId).toBeLessThanOrEqual(dimensions.width + 0.001);
      expect(size.y, project.projectId).toBeLessThanOrEqual(dimensions.height + 0.001);
      expect(bounds.min.y, project.projectId).toBeGreaterThanOrEqual(-0.001);
      expect(model.userData.projectId).toBe(project.projectId);
      expect(model.userData.sourceUrl).toBe(project.sourceUrl);
      expect(model.userData.evidenceClass).toBe(project.evidenceClass);
      expect(model.userData.fullLengthM).toBe(project.lengthM);
      expect(model.userData.implementationStatus).toBe(project.implementationStatus);
      expect(model.userData.spatialPrecision).toBe(project.spatialPrecision);
      expect(model.userData.exactAreaName).toBe(project.exactAreaName);
      disposeObject(model);
    }
  });
  it.each(["station", "hub"])("uses distinct %s geometry for all eleven cities", (category) => {
    const signatures = new Set<string>();
    for (const project of projects.filter((p) => p.category === category && p.phase === "permanent")) {
      const model = buildProjectModel(project);
      const parts: unknown[] = [];
      model.traverse((child) => { if (child instanceof Mesh) parts.push([child.position.toArray(), Array.from(child.geometry.getAttribute("position").array)]); });
      signatures.add(JSON.stringify(parts)); disposeObject(model);
    }
    expect(signatures.size).toBe(11);
  });
  it("does not invent rail at SoFi, Arlington, Arrowhead or Miami", () => {
    for (const city of ["los-angeles", "dallas", "kansas-city", "miami"]) {
      const model = buildProjectModel(projects.find((p) => p.projectId === `${city}-station-PERM`)!);
      expect(model.getObjectByName("Illustrative rail")).toBeUndefined();
      expect(model.getObjectByName("Shuttle stopping bay")).toBeDefined(); disposeObject(model);
    }
    const hub = buildProjectModel(projects.find((p) => p.projectId === "los-angeles-hub-PERM")!);
    expect(hub.getObjectByName("Interchange rail edge")).toBeDefined(); disposeObject(hub);
  });
  it("builds full site corridors without changing the studio section", () => {
    const project = nynj.find((p) => p.category === "bike")!;
    const model = buildProjectModel(project, { fullLength: true });
    expect(new Box3().setFromObject(model).getSize(new Vector3()).x).toBeCloseTo(project.lengthM);
    expect(model.userData.isSection).toBe(false); expect(studioDimensions(project).length).toBe(80); disposeObject(model);
  });
  it("labels shortened corridors and never exaggerates their height", () => {
    const project = nynj.find((record) => record.category === "bike")!;
    expect(studioDimensions(project)).toMatchObject({ isSection: true, length: 80, fullLength: 3200, height: 0.1 });
  });
  it("rejects missing or nonpositive dimensions instead of inventing an asset", () => {
    for (const heightM of [NaN, 0, -1, Infinity]) expect(() => buildProjectModel({ ...nynj[0], heightM })).toThrow(/incomplete dimensions/);
  });
});

describe("Studio scenario permissions", () => {
  it("baseline always contains no proposed models", () => {
    expect(studioProjects(nynj, selection, "baseline")).toEqual([]);
  });
  it("selected legacy shows only permanent IDs from the current optimizer response", () => {
    expect(studioProjects(nynj, selection, "selectedLegacy").map((project) => project.projectId)).toEqual(["nynj-station-PERM"]);
    expect(studioProjects(nynj, null, "selectedLegacy")).toEqual([]);
    expect(studioProjects(projects.filter((project) => project.cityId === "atlanta"), selection, "selectedLegacy")).toEqual([]);
  });
  it("comparison cannot resurrect an unselected temporary counterpart", () => {
    const allowed = studioProjects(nynj, selection, "selectedLegacy");
    expect(displayProjects(allowed, "station", "compare").map((project) => project.phase)).toEqual(["permanent"]);
  });
  it("candidate comparison orders temporary on the left and permanent on the right", () => {
    expect(displayProjects(studioProjects(nynj, null, "allPossibilities"), "station", "compare").map((project) => project.phase)).toEqual(["temporary", "permanent"]);
  });
  it("keeps all 24 candidates including phases unfunded in the seed demonstration", () => {
    expect(studioProjects(nynj, null, "allPossibilities")).toHaveLength(24);
  });
  it("never lets a historical render flag suppress a current pick or invent one", () => {
    const project = { ...nynj.find((p) => p.phase === "permanent")!, renderEnabled: "No" as const };
    expect(studioProjects([project], [project] as unknown as SelectedProject[], "selectedLegacy")).toEqual([project]);
    expect(studioProjects([project], null, "selectedLegacy")).toEqual([]);
    expect(studioProjects([project], [project] as unknown as SelectedProject[], "baseline")).toEqual([]);
  });
});
