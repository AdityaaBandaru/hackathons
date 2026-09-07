import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import {
  makeCities,
  makeFundingForCity,
  makeInterventions,
  makeNynjGeoJson,
  makeNynjProjects,
  makeOptimizeResult,
} from "./fixtures";

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
      projects: cityId === "nynj" ? makeNynjProjects() : [],
      legacyProjects: [],
    });
  }),
  // The map fetches its geometry as a static asset from the frontend origin.
  http.get("/geojson/nynj_projects.geojson", () =>
    HttpResponse.json(makeNynjGeoJson()),
  ),
  http.get(`${API_BASE}/api/v1/interventions`, () =>
    HttpResponse.json(makeInterventions()),
  ),
  http.post(`${API_BASE}/api/v1/optimize`, async () =>
    HttpResponse.json(makeOptimizeResult()),
  ),
];

export const server = setupServer(...defaultHandlers);
