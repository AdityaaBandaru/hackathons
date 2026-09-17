import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Project3D } from "@/lib/types";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import {
  makeCities,
  makeFundingForCity,
  makeInterventions,
  makeNynjProjects,
  makeOptimizeResult,
} from "./fixtures";

const seedProjects: Project3D[] = JSON.parse(readFileSync(resolve(process.cwd(), "../backend/app/data/seed/projects3d.json"), "utf8"));
const API_BASE = "http://localhost:8000";

export const defaultHandlers = [
  http.get(`${API_BASE}/api/v1/cities`, () => HttpResponse.json(makeCities())),
  http.get(`${API_BASE}/api/v1/cities/:cityId`, ({ params }) => {
    const city = makeCities().find((c) => c.cityId === params.cityId);
    if (!city) {
      return HttpResponse.json(
        { detail: { error: "city_not_found", cityId: params.cityId, validCityIds: [] } },
        { status: 404 },
      );
    }
    return HttpResponse.json(city);
  }),
  http.get(`${API_BASE}/api/v1/cities/:cityId/evidence`, ({ params }) => {
    const cityId = String(params.cityId);
    return HttpResponse.json({
      cityId,
      hostRegion: cityId,
      evidence2026: [],
      observedSummary: [],
      analogEvents: [],
      pedestrianAreas: [],
      matchData: [],
      funding: makeFundingForCity(cityId),
    });
  }),
  http.get(`${API_BASE}/api/v1/cities/:cityId/projects`, ({ params }) => {
    const cityId = String(params.cityId);
    return HttpResponse.json({
      cityId,
      hostRegion: cityId,
      projects: cityId === "nynj" ? makeNynjProjects() : seedProjects.filter((p) => p.cityId === cityId),
      legacyProjects: [],
    });
  }),
  http.get(`${API_BASE}/api/v1/interventions`, () =>
    HttpResponse.json(makeInterventions()),
  ),
  http.post(`${API_BASE}/api/v1/optimize`, async () =>
    HttpResponse.json(makeOptimizeResult()),
  ),
];

export const server = setupServer(...defaultHandlers);
