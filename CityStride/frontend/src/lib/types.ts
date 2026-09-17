/**
 * Types for the Phase 1-3 backend responses.
 *
 * These mirror what backend/app/api/v1/*.py actually returns -- not
 * reference/types/datasets.ts, which describes the target contract loosely.
 * Money is always integer cents; a field the seed can leave null is typed
 * `| null`, never defaulted to 0 (CLAUDE.md rule 6).
 */

// ---------------------------------------------------------------------------
// Cities
// ---------------------------------------------------------------------------

export interface CityFunding {
  officialBudgetCents: number;
  temporaryAllocationCents: number | null;
  permanentAllocationCents: number | null;
  reserveCents: number | null;
}

export interface CitySummary {
  cityId: string;
  hostRegionCode: number;
  hostRegion: string;
  matches: number | null;
  stadiumCapacity: number | null;
  tournamentDemand: number | null;
  demandClass: string;
  venueAccessType: string;
  adjacentRailStops: number | null;
  transferStructure: string;
  dominantBottleneck: string;
  pedestrianAreaIds: string[];
  evidenceRecordCount: number;
  funding: CityFunding;
  enabledProjectCount: number | null;
  analogEventCount: number | null;
  airGateways: string | null;
  ftaUsdPerAttendee: number | null;
  fundingSourceId: string | null;
}

// ---------------------------------------------------------------------------
// Evidence records (each dataset keeps its own native field names)
// ---------------------------------------------------------------------------

export interface Evidence2026Record {
  evidenceId: string;
  hostRegion: string;
  dateOrScope: string;
  metric: string;
  value: number;
  unit: string;
  qualifier: string;
  evidenceClass: string;
  sourceUrl: string;
}

export interface ObservedSummaryRecord {
  observationId: string;
  region: string;
  dateOrScope: string;
  metric: string;
  value: number;
  unit: string;
  qualifier: string;
  evidenceClass: string;
  modelUse: string;
  sourceId: string;
  sourceUrl: string;
}

export interface AnalogEventRecord {
  analogEventId: string;
  hostRegion: string;
  venue: string;
  event: string;
  eventType: string;
  dateOrPeriod: string;
  eventDays: number;
  totalAttendance: number | null;
  perEventAttendance: number | null;
  transitBoardings: number | null;
  pedestrianProxy: number | null;
  qualifier: string;
  recommendedModelUse: string;
  evidenceClass: string;
  attendanceSourceUrl: string;
  transitSourceUrl: string | null;
}

export interface PedestrianAreaRecord {
  areaCode: number;
  areaShortCode: string;
  areaId: string;
  cityId: string;
  hostRegion: string;
  exactAreaName: string;
  areaType: string;
  latitude: number;
  longitude: number;
  analysisRadiusM: number;
  cityEventPedDesignTotal: number;
  areaShare: number;
  areaDesignPedestrians: number;
  volumeUnit: string;
  volumeBasis: string;
  comparatorMetric: string;
  comparatorValue: number | null;
  comparatorQualifier: string | null;
  comparatorScopeNote: string | null;
  temporaryAreaFix: string;
  permanentAreaFix: string;
  spatialPrecision: string;
  evidenceClass: string;
  sourceUrl: string;
}

export interface MatchDataRecord {
  recordType: string;
  matchNo: number | string;
  fixture: string;
  ticketHolders: number;
  uberCount: number;
  uberEgressMin: number;
  hostShuttles: number;
  shuttleEgressMin: number;
  njtIngress: number;
  njtEgress: number;
  njtEgressMin: number;
  americanDreamBus: number;
  americanDreamParking: number;
  americanDreamPedestrians: number;
  unallocated: number;
  mathematicalDropoff: number | null;
  likelyHospitality: number | null;
  likelyDropoff: number | null;
  uberVsPlan: number;
  pedestriansVsPlan: number;
  railEgressPeoplePerHour: number;
  evidenceClass: string;
  sourceId: string;
  sourceUrl: string;
}

export interface FundingRecord {
  hostRegionCode: number;
  cityId: string;
  hostRegion: string;
  category: string;
  categoryName: string;
  selectedUnits: number;
  decisionUnit: string;
  temporaryShare: number;
  shareOfHostBudget: number;
  temporaryFix: string;
  permanentFix: string;
  usefulLifeYears: number;
  evidenceClass: string;
  fundingSourceId: string;
  sourceUrl: string;
  officialHostBudgetCents: number;
  typicalUnitCostCents: number | null;
  modeledCategoryAllocationCents: number;
  temporaryAllocationCents: number;
  permanentAllocationCents: number;
}

export interface CityEvidence {
  cityId: string;
  hostRegion: string;
  evidence2026: Evidence2026Record[];
  observedSummary: ObservedSummaryRecord[];
  analogEvents: AnalogEventRecord[];
  pedestrianAreas: PedestrianAreaRecord[];
  matchData: MatchDataRecord[];
  funding: FundingRecord[];
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export interface Project3D {
  projectId: string;
  hostRegionCode: number;
  cityId: string;
  hostRegion: string;
  category: string;
  categoryName: string;
  phase: "temporary" | "permanent";
  areaId: string;
  areaShortCode: string;
  exactAreaName: string;
  latitude: number;
  longitude: number;
  analysisRadiusM: number;
  geometryType: string;
  lengthM: number;
  widthM: number;
  heightM: number;
  bearingDeg: number;
  zOffsetM: number;
  colorHex: string;
  opacity: number;
  renderEnabled: "Yes" | "No";
  designDescription: string;
  implementationStatus: string;
  spatialPrecision: string;
  evidenceClass: string;
  sourceUrl: string;
  allocationCents: number;
}

export interface LegacyProject {
  projectId: string;
  cityId: string;
  interventionId: string;
  projectName: string;
  visualType: string;
  latitude: number;
  longitude: number;
  bearingDeg: number;
  usefulLifeYears: number;
  quantity: number;
  unit: string;
  conceptualDesign: string;
  implementationStatus: string;
  evidenceClass: string;
  evidenceSourceId: string;
  geometryUrl: string;
  modelUrl: string | null;
  canonicalProjectId: string | null;
}

export interface CityProjects {
  cityId: string;
  hostRegion: string;
  projects: Project3D[];
  legacyProjects: LegacyProject[];
}

// ---------------------------------------------------------------------------
// Interventions and sources
// ---------------------------------------------------------------------------

export interface Intervention {
  categoryCode: number;
  category: string;
  categoryName: string;
  decisionUnit: string;
  temporaryShare: number;
  permanentShare: number;
  usefulLifeYears: number;
  defaultAreaTarget: string;
  defaultGeometryType: string;
  temporaryFix: string;
  permanentFix: string;
  evidenceClass: string;
  typicalUnitCostCents: number | null;
}

export interface Source {
  sourceId: string;
  title: string;
  publisher: string;
  publicationDate: string | null;
  documentType: string;
  usedFor: string;
  url: string;
}

// ---------------------------------------------------------------------------
// Optimizer
// ---------------------------------------------------------------------------

export interface OptimizeWeights {
  travelTime: number;
  vehicleCongestion: number;
  emissions: number;
  accessibility: number;
  reliability: number;
  permanentLegacy: number;
}

export interface OptimizeConstraints {
  minimumAccessibilityShare?: number | null;
  maximumTemporaryShare?: number | null;
  minimumPermanentShare?: number | null;
  maximumMajorConstructionProjects?: number | null;
  requiredInterventionIds?: string[];
  excludedInterventionIds?: string[];
}

export interface OptimizeRequestBody {
  cityId: string;
  budgetCents: number;
  weights: OptimizeWeights;
  constraints?: OptimizeConstraints;
  assumptionsOverride?: Record<string, number>;
}

export interface SelectedProject {
  projectId: string;
  cityId: string;
  category: string;
  categoryName: string;
  phase: "temporary" | "permanent";
  units: number;
  decisionUnit: string;
  allocationCents: number;
  usefulLifeYears: number;
  isMajorConstruction: boolean;
  isAccessibility: boolean;
}

export interface PhaseSplit {
  temporaryCents: number;
  permanentCents: number;
  temporaryShare: number | null;
  permanentShare: number | null;
}

export interface AccessibilitySpend {
  cents: number;
  share: number | null;
  categories: string[];
}

export interface Benefits {
  passengerHoursSaved: number;
  avgMinutesSavedPerAttendee: number | null;
  vehicleHoursAvoided: number;
  co2TonnesAvoided: number;
  accessibleTripsImproved: number;
  reliabilityRiskPpReduction: number;
  permanentLegacyValue: number;
}

export interface NextBest {
  interventionId: string;
  categoryName: string | null;
  unitNumber: number;
  unitCostCents: number;
  decisionUnit: string | null;
  utilityPerMillionCents: number;
}

export interface ModelAssumptions {
  note: string;
  benefitCoefficientsSource: string;
  diminishingReturns: { form: string; segmentFactors: number[] };
  interactionEffects: {
    form: string;
    pairs: { a: string; b: string; factor: number }[];
  };
  accessibilityCategories: string[];
  majorConstructionGeometryTypes: string[];
  demandScale: number;
  transitProductivityScale: number;
}

export interface OptimizeResult {
  cityId: string;
  hostRegion: string;
  budgetCents: number;
  requestedBudgetCents: number;
  spentCents: number;
  unspentCents: number;
  objectiveScore: number;
  selectedProjectIds: string[];
  selectedProjects: SelectedProject[];
  quantitiesByCategory: Record<string, number>;
  phaseSplit: PhaseSplit;
  accessibilitySpend: AccessibilitySpend;
  majorConstructionProjectCount: number;
  benefits: Benefits;
  nextBest: NextBest | null;
  normalizedWeights: Record<string, number>;
  appliedAssumptions: Record<string, number>;
  modelVersion: string;
  evidenceClass: string;
  solverStatus: number;
  modelAssumptions: ModelAssumptions;
}

export interface SensitivityPointFeasible {
  label: string;
  multiplier: number;
  feasible: true;
  budgetCents: number;
  spentCents: number;
  unspentCents: number;
  objectiveScore: number;
  quantitiesByCategory: Record<string, number>;
  selectedProjectIds: string[];
  phaseSplit: PhaseSplit;
  benefits: Benefits;
  portfolioChanged: boolean;
  projectIdsAdded: string[];
  projectIdsRemoved: string[];
}

export interface SensitivityPointInfeasible {
  label: string;
  multiplier: number;
  feasible: false;
  infeasibility: OptimizerErrorBody;
}

export type SensitivityPoint =
  | SensitivityPointFeasible
  | SensitivityPointInfeasible;

export interface SensitivityAxisResult {
  axis: string;
  assumptionKey: string;
  description: string;
  points: SensitivityPoint[];
}

export interface SensitivityResult {
  cityId: string;
  hostRegion: string;
  baseline: OptimizeResult;
  axes: SensitivityAxisResult[];
  summary: {
    axesTested: number;
    pointsEvaluated: number;
    pointsWherePortfolioChanged: string[];
    infeasiblePoints: string[];
    portfolioStable: boolean;
  };
  evidenceClass: string;
  modelVersion: string;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export interface Diagnostic {
  code: string;
  message: string;
  detail: Record<string, unknown>;
}

export interface OptimizerErrorBody {
  error: "invalid_scenario" | "infeasible_scenario";
  message: string;
  diagnostics: Diagnostic[];
}

/** FastAPI's own request-validation failure shape (Pydantic, not ours). */
export interface ValidationErrorBody {
  detail: { type: string; loc: (string | number)[]; msg: string }[];
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export interface HealthResponse {
  status: string;
  version: string;
  bundleVersion: string;
  canonicalCrs: string;
  heroScenarioCityId: string;
  seed: {
    datasets: number;
    recordCounts: Record<string, number>;
    integrityChecksPassed: number;
    cityIds: string[];
  };
}
