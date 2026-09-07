export type EvidenceClass =
  | "observed_final"
  | "observed_preliminary"
  | "official_allocation"
  | "official_plan"
  | "derived"
  | "capacity_proxy"
  | "engineering_assumption"
  | "model_output"
  | "formula_residual";

export type ProjectPhase = "temporary" | "permanent";

export interface HostRegion {
  hostRegionCode: number;
  cityId: string;
  hostRegion: string;
  officialBudgetCents: number;
  matches: number | null;
  stadiumCapacity: number | null;
  pedestrianAreaIds: string[];
  evidenceRecordCount: number;
}

export interface FundingCategory {
  hostRegionCode: number;
  cityId: string;
  hostRegion: string;
  category: string;
  officialHostBudgetCents: number;
  selectedUnits: number;
  typicalUnitCostCents: number | null;
  temporaryShare: number;
  modeledCategoryAllocationCents: number;
  temporaryAllocationCents: number;
  permanentAllocationCents: number;
  evidenceClass: string;
  sourceUrl: string;
}

export interface PedestrianArea {
  areaCode: number;
  areaId: string;
  cityId: string;
  hostRegion: string;
  exactAreaName: string;
  latitude: number;
  longitude: number;
  analysisRadiusM: number;
  areaDesignPedestrians: number;
  volumeBasis: string;
  spatialPrecision: string;
  sourceUrl: string;
}

export interface Project3D {
  projectId: string;
  cityId: string;
  category: string;
  phase: ProjectPhase;
  areaId: string;
  latitude: number;
  longitude: number;
  geometryType: string;
  lengthM: number;
  widthM: number;
  heightM: number;
  colorHex: string;
  opacity: number;
  allocationCents: number;
  renderEnabled: "Yes" | "No";
  implementationStatus: "concept_only";
  spatialPrecision: string;
  evidenceClass: string;
}

export interface OptimizeRequest {
  cityId: string;
  budgetCents: number;
  weights: {
    travelTime: number;
    vehicleCongestion: number;
    emissions: number;
    accessibility: number;
    reliability: number;
    permanentLegacy: number;
  };
  constraints: {
    minimumAccessibilityShare?: number;
    maximumTemporaryShare?: number;
    minimumPermanentShare?: number;
    maximumMajorConstructionProjects?: number;
    requiredInterventionIds?: string[];
    excludedInterventionIds?: string[];
  };
  assumptionsOverride?: Record<string, number>;
}
