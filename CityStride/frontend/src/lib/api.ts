/**
 * Typed client for the Phase 1-3 backend.
 *
 * Every function here does exactly one HTTP call and returns exactly what the
 * backend returned -- no client-side computation, no re-deriving a number the
 * backend already produced. The optimizer endpoints in particular must always
 * be called through here; the browser never computes an optimization result.
 */

import type {
  CityEvidence,
  CityProjects,
  CitySummary,
  HealthResponse,
  Intervention,
  OptimizeRequestBody,
  OptimizeResult,
  SensitivityResult,
  Source,
} from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/** The backend's structured invalid/infeasible scenario body, or a fallback. */
export interface ApiErrorBody {
  error?: string;
  message?: string;
  diagnostics?: { code: string; message: string; detail: Record<string, unknown> }[];
  detail?: unknown;
}

/**
 * Raised for any non-2xx response. Carries the parsed body when the backend
 * sent one, so callers (the optimizer page especially) can render the
 * structured infeasibility explanation instead of a generic failure.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | null;

  constructor(status: number, body: ApiErrorBody | null, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  /** True for a 422 from our optimizer (a well-formed but unsolvable scenario). */
  get isInfeasible(): boolean {
    return this.status === 422 && this.body?.error === "infeasible_scenario";
  }

  /** True for a 400/422 the request itself caused (bad city, bad override key). */
  get isInvalidScenario(): boolean {
    return this.body?.error === "invalid_scenario";
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(
      0,
      null,
      `could not reach the API at ${API_BASE_URL} -- is the backend running?`,
    );
  }

  if (!response.ok) {
    let body: ApiErrorBody | null = null;
    try {
      const parsed = await response.json();
      // Our own errors nest under `detail`; FastAPI validation errors do too,
      // but as an array. Normalise both into ApiErrorBody.
      body = typeof parsed?.detail === "object" && !Array.isArray(parsed.detail)
        ? (parsed.detail as ApiErrorBody)
        : { message: JSON.stringify(parsed?.detail ?? parsed), detail: parsed?.detail };
    } catch {
      // no JSON body
    }
    throw new ApiError(
      response.status,
      body,
      body?.message ?? `request to ${path} failed with status ${response.status}`,
    );
  }

  return (await response.json()) as T;
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

export function getCities(): Promise<CitySummary[]> {
  return request<CitySummary[]>("/api/v1/cities");
}

export function getCity(cityId: string): Promise<CitySummary> {
  return request<CitySummary>(`/api/v1/cities/${encodeURIComponent(cityId)}`);
}

export function getCityEvidence(cityId: string): Promise<CityEvidence> {
  return request<CityEvidence>(
    `/api/v1/cities/${encodeURIComponent(cityId)}/evidence`,
  );
}

export function getCityProjects(cityId: string): Promise<CityProjects> {
  return request<CityProjects>(
    `/api/v1/cities/${encodeURIComponent(cityId)}/projects`,
  );
}

export function getInterventions(): Promise<Intervention[]> {
  return request<Intervention[]>("/api/v1/interventions");
}

export function getSources(): Promise<Source[]> {
  return request<Source[]>("/api/v1/sources");
}

/** Solve one city's portfolio. Always calls the backend -- never computed locally. */
export function optimize(body: OptimizeRequestBody): Promise<OptimizeResult> {
  return request<OptimizeResult>("/api/v1/optimize", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export interface SensitivityRequestBody extends OptimizeRequestBody {
  axes?: string[];
}

export function optimizeSensitivity(
  body: SensitivityRequestBody,
): Promise<SensitivityResult> {
  return request<SensitivityResult>("/api/v1/optimize/sensitivity", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export { API_BASE_URL };
