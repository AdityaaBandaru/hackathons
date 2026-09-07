/**
 * Fixture data shaped exactly like the real Phase 1-3 backend responses.
 * Official budget figures are the bundle's real values (verified live against
 * the running backend during development), not arbitrary test numbers.
 */

import type {
  CitySummary,
  FundingRecord,
  Intervention,
  OptimizeResult,
} from "@/lib/types";

export const CITY_OFFICIAL_BUDGET_CENTS: Record<string, number> = {
  atlanta: 939_101_800,
  boston: 867_159_800,
  dallas: 1_003_303_700,
  houston: 909_238_700,
  "kansas-city": 863_212_300,
  "los-angeles": 960_328_400,
  miami: 869_743_000,
  nynj: 1_043_868_100,
  philadelphia: 847_432_700,
  "sf-bay": 880_788_800,
  seattle: 840_843_900,
};

const HOST_REGION_NAMES: Record<string, string> = {
  atlanta: "Atlanta",
  boston: "Boston",
  dallas: "Dallas",
  houston: "Houston",
  "kansas-city": "Kansas City",
  "los-angeles": "Los Angeles",
  miami: "Miami",
  nynj: "New York/New Jersey",
  philadelphia: "Philadelphia",
  "sf-bay": "San Francisco Bay Area",
  seattle: "Seattle",
};

export const CITY_IDS = Object.keys(CITY_OFFICIAL_BUDGET_CENTS);

export function makeCitySummary(cityId: string, index: number): CitySummary {
  const officialBudgetCents = CITY_OFFICIAL_BUDGET_CENTS[cityId];
  const temporaryAllocationCents = Math.round(officialBudgetCents * 0.42);
  const permanentAllocationCents =
    officialBudgetCents - temporaryAllocationCents - 100_000;
  return {
    cityId,
    hostRegionCode: index + 1,
    hostRegion: HOST_REGION_NAMES[cityId],
    matches: 8,
    stadiumCapacity: 65_000 + index * 1_000,
    tournamentDemand: 400_000 + index * 20_000,
    demandClass: cityId === "nynj" ? "observed_final" : "capacity_proxy",
    venueAccessType: "Downtown; nearby rail stations",
    adjacentRailStops: 2,
    transferStructure: "Airport rail spine; downtown station distribution",
    dominantBottleneck: "Station/platform circulation and wayfinding",
    pedestrianAreaIds: [`${cityId}-area-1`, `${cityId}-area-2`],
    evidenceRecordCount: 4,
    funding: {
      officialBudgetCents,
      temporaryAllocationCents,
      permanentAllocationCents,
      reserveCents: 100_000,
    },
    enabledProjectCount: 16,
    analogEventCount: 1,
    airGateways: "XXX",
    ftaUsdPerAttendee: 17.3,
    fundingSourceId: "fta-world-cup-2026",
  };
}

export function makeCities(): CitySummary[] {
  return CITY_IDS.map((cityId, index) => makeCitySummary(cityId, index));
}

const FUNDING_CATEGORIES = [
  "service",
  "buslane",
  "signals",
  "hub",
  "parkride",
  "ped",
  "bike",
  "tnc",
  "wayfinding",
  "station",
  "toc",
  "access",
] as const;

export function makeFundingForCity(cityId: string): FundingRecord[] {
  const official = CITY_OFFICIAL_BUDGET_CENTS[cityId];
  const perCategory = Math.floor((official * 0.99) / FUNDING_CATEGORIES.length);
  const rows: FundingRecord[] = FUNDING_CATEGORIES.map((category) => ({
    hostRegionCode: 1,
    cityId,
    hostRegion: HOST_REGION_NAMES[cityId],
    category,
    categoryName: category,
    selectedUnits: 2,
    decisionUnit: "unit",
    temporaryShare: 0.5,
    shareOfHostBudget: perCategory / official,
    temporaryFix: "temporary fix",
    permanentFix: "permanent fix",
    usefulLifeYears: 10,
    evidenceClass: "engineering_assumption",
    fundingSourceId: "fta-wc26",
    sourceUrl:
      "https://www.transit.dot.gov/funding/apportionments/fta-world-cup-funding-apportionment-table",
    officialHostBudgetCents: official,
    typicalUnitCostCents: 50_000_000,
    modeledCategoryAllocationCents: perCategory,
    temporaryAllocationCents: Math.round(perCategory * 0.5),
    permanentAllocationCents: perCategory - Math.round(perCategory * 0.5),
  }));
  const reserveCents = official - perCategory * FUNDING_CATEGORIES.length;
  rows.push({
    hostRegionCode: 1,
    cityId,
    hostRegion: HOST_REGION_NAMES[cityId],
    category: "reserve",
    categoryName: "Unassigned program reserve",
    selectedUnits: 1,
    decisionUnit: "residual",
    temporaryShare: 0,
    shareOfHostBudget: reserveCents / official,
    temporaryFix: "n/a",
    permanentFix: "n/a",
    usefulLifeYears: 1,
    evidenceClass: "formula_residual",
    fundingSourceId: "fta-wc26",
    sourceUrl:
      "https://www.transit.dot.gov/funding/apportionments/fta-world-cup-funding-apportionment-table",
    officialHostBudgetCents: official,
    typicalUnitCostCents: null,
    modeledCategoryAllocationCents: reserveCents,
    temporaryAllocationCents: 0,
    permanentAllocationCents: 0,
  });
  return rows;
}

export function makeInterventions(): Intervention[] {
  return FUNDING_CATEGORIES.map((category, i) => ({
    categoryCode: i + 1,
    category,
    categoryName: `${category} category`,
    decisionUnit: "unit",
    temporaryShare: 0.5,
    permanentShare: 0.5,
    usefulLifeYears: 10,
    defaultAreaTarget: "transit",
    defaultGeometryType: "line_extrusion",
    temporaryFix: "temp fix",
    permanentFix: "perm fix",
    evidenceClass: "engineering_assumption",
    typicalUnitCostCents: 50_000_000,
  }));
}

/** Shaped like a real POST /api/v1/optimize response for nynj. */
export function makeOptimizeResult(
  overrides: Partial<OptimizeResult> = {},
): OptimizeResult {
  return {
    cityId: "nynj",
    hostRegion: "New York/New Jersey",
    budgetCents: 1_043_868_100,
    requestedBudgetCents: 1_043_868_100,
    spentCents: 1_033_000_000,
    unspentCents: 10_868_100,
    objectiveScore: 19.351,
    selectedProjectIds: [
      "nynj-service-TMP",
      "nynj-service-PERM",
      "nynj-buslane-TMP",
      "nynj-buslane-PERM",
    ],
    selectedProjects: [
      {
        projectId: "nynj-service-TMP",
        cityId: "nynj",
        category: "service",
        categoryName: "Extra transit service",
        phase: "temporary",
        units: 3,
        decisionUnit: "2,500 vehicle-hours",
        allocationCents: 132_000_000,
        usefulLifeYears: 1,
        isMajorConstruction: false,
        isAccessibility: false,
      },
      {
        projectId: "nynj-service-PERM",
        cityId: "nynj",
        category: "service",
        categoryName: "Extra transit service",
        phase: "permanent",
        units: 3,
        decisionUnit: "2,500 vehicle-hours",
        allocationCents: 33_000_000,
        usefulLifeYears: 1,
        isMajorConstruction: false,
        isAccessibility: false,
      },
      {
        projectId: "nynj-buslane-TMP",
        cityId: "nynj",
        category: "buslane",
        categoryName: "Transit-priority lanes",
        phase: "temporary",
        units: 2,
        decisionUnit: "2 lane-miles",
        allocationCents: 32_400_000,
        usefulLifeYears: 10,
        isMajorConstruction: false,
        isAccessibility: false,
      },
      {
        projectId: "nynj-buslane-PERM",
        cityId: "nynj",
        category: "buslane",
        categoryName: "Transit-priority lanes",
        phase: "permanent",
        units: 2,
        decisionUnit: "2 lane-miles",
        allocationCents: 39_600_000,
        usefulLifeYears: 10,
        isMajorConstruction: false,
        isAccessibility: false,
      },
    ],
    quantitiesByCategory: { service: 3, buslane: 2 },
    phaseSplit: {
      temporaryCents: 415_400_000,
      permanentCents: 617_600_000,
      temporaryShare: 0.4021,
      permanentShare: 0.5979,
    },
    accessibilitySpend: {
      cents: 340_000_000,
      share: 0.3291,
      categories: ["access", "ped", "station", "wayfinding"],
    },
    majorConstructionProjectCount: 4,
    benefits: {
      passengerHoursSaved: 65_647.686,
      avgMinutesSavedPerAttendee: 6.347,
      vehicleHoursAvoided: 180_671.485,
      co2TonnesAvoided: 791.538,
      accessibleTripsImproved: 220_195.254,
      reliabilityRiskPpReduction: 33.679,
      permanentLegacyValue: 1234.5,
    },
    nextBest: {
      interventionId: "buslane",
      categoryName: "Transit-priority lanes",
      unitNumber: 3,
      unitCostCents: 36_000_000,
      decisionUnit: "2 lane-miles",
      utilityPerMillionCents: 0.012,
    },
    normalizedWeights: {
      travelTime: 0.25,
      vehicleCongestion: 0.15,
      emissions: 0.12,
      accessibility: 0.2,
      reliability: 0.15,
      permanentLegacy: 0.13,
    },
    appliedAssumptions: {
      attendanceMultiplier: 1,
      budgetMultiplier: 1,
      costMultiplier: 1,
      transitCapacityMultiplier: 1,
      visitorTransitUsageMultiplier: 1,
    },
    modelVersion: "milp-v1",
    evidenceClass: "model_output",
    solverStatus: 0,
    modelAssumptions: {
      note: "Every figure in this response is a model output computed from engineering assumptions, not an observed measurement.",
      benefitCoefficientsSource: "reference/model_run.py intervention metric vectors",
      diminishingReturns: { form: "per-unit segment factors", segmentFactors: [1, 0.74, 0.53, 0.37, 0.25] },
      interactionEffects: {
        form: "pairwise complementarity",
        pairs: [{ a: "service", b: "buslane", factor: 0.22 }],
      },
      accessibilityCategories: ["access", "ped", "station", "wayfinding"],
      majorConstructionGeometryTypes: ["polygon_extrusion", "glb_model"],
      demandScale: 1.24,
      transitProductivityScale: 1,
    },
    ...overrides,
  };
}
