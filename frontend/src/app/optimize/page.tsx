"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ApiError,
  getCities,
  getInterventions,
  optimize,
  optimizeSensitivity,
} from "@/lib/api";
import { LoadingBlock, ErrorBlock, InfeasibleBlock } from "@/components/StatusStates";
import { WeightSliders } from "@/components/optimizer/WeightSliders";
import {
  ConstraintsForm,
  constraintsFormToRequest,
  type ConstraintsFormState,
} from "@/components/optimizer/ConstraintsForm";
import { ResultsPanel } from "@/components/optimizer/ResultsPanel";
import { SensitivityPanel } from "@/components/optimizer/SensitivityPanel";
import { formatCents } from "@/lib/format";
import type { OptimizeRequestBody, OptimizeWeights } from "@/lib/types";

// Matches reference/examples/nynj_optimize_request.json -- the canonical
// example request the backend's own tests are built against.
const DEFAULT_WEIGHTS: OptimizeWeights = {
  travelTime: 0.25,
  vehicleCongestion: 0.15,
  emissions: 0.12,
  accessibility: 0.2,
  reliability: 0.15,
  permanentLegacy: 0.13,
};

const DEFAULT_CONSTRAINTS: ConstraintsFormState = {
  minimumAccessibilityShare: 0.1,
  maximumTemporaryShare: 0.55,
  minimumPermanentShare: 0.35,
  maximumMajorConstructionProjects: 4,
  requiredInterventionIds: [],
  excludedInterventionIds: [],
};

export default function OptimizePage() {
  const citiesQuery = useQuery({ queryKey: ["cities"], queryFn: getCities });
  const interventionsQuery = useQuery({
    queryKey: ["interventions"],
    queryFn: getInterventions,
  });

  const [cityId, setCityId] = useState("nynj");
  // null means "use the selected city's official budget" -- an explicit
  // override only exists once the user types their own value. Derived, not
  // synced via an effect: switching cities is just clearing the override.
  const [budgetOverrideCents, setBudgetOverrideCents] = useState<number | null>(
    null,
  );
  const [weights, setWeights] = useState<OptimizeWeights>(DEFAULT_WEIGHTS);
  const [constraintsForm, setConstraintsForm] =
    useState<ConstraintsFormState>(DEFAULT_CONSTRAINTS);

  const selectedCity = citiesQuery.data?.find((c) => c.cityId === cityId);
  const budgetCents = useMemo(
    () => budgetOverrideCents ?? selectedCity?.funding.officialBudgetCents ?? null,
    [budgetOverrideCents, selectedCity],
  );

  const requestBody: OptimizeRequestBody | null = useMemo(() => {
    if (budgetCents === null) return null;
    return {
      cityId,
      budgetCents,
      weights,
      constraints: constraintsFormToRequest(constraintsForm),
    };
  }, [cityId, budgetCents, weights, constraintsForm]);

  const optimizeMutation = useMutation({
    mutationFn: (body: OptimizeRequestBody) => optimize(body),
  });
  const sensitivityMutation = useMutation({
    mutationFn: (body: OptimizeRequestBody) => optimizeSensitivity(body),
  });

  function runOptimize() {
    if (!requestBody) return;
    sensitivityMutation.reset();
    optimizeMutation.mutate(requestBody);
  }

  function runSensitivity() {
    if (!requestBody) return;
    sensitivityMutation.mutate(requestBody);
  }

  if (citiesQuery.isPending || interventionsQuery.isPending) {
    return <LoadingBlock label="Loading cities and interventions…" />;
  }
  if (citiesQuery.isError || interventionsQuery.isError) {
    const error = citiesQuery.error ?? interventionsQuery.error;
    return (
      <ErrorBlock
        message={error instanceof Error ? error.message : "Failed to load."}
        onRetry={() => {
          citiesQuery.refetch();
          interventionsQuery.refetch();
        }}
      />
    );
  }

  const cities = citiesQuery.data!;
  const interventions = interventionsQuery.data!;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Mobility investment optimizer
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Set an objective and constraints, then run the real backend
          mixed-integer solver at{" "}
          <code className="text-xs">POST /api/v1/optimize</code>. Nothing is
          computed in the browser — every number below comes straight from
          the API response.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <label
              htmlFor="city-select"
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Host region
            </label>
            <select
              id="city-select"
              value={cityId}
              onChange={(e) => {
                setCityId(e.target.value);
                setBudgetOverrideCents(null);
              }}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              {cities.map((city) => (
                <option key={city.cityId} value={city.cityId}>
                  {city.hostRegion}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="budget-input"
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Budget (whole dollars)
            </label>
            <input
              id="budget-input"
              type="number"
              min={0}
              step={1}
              value={budgetCents !== null ? Math.round(budgetCents / 100) : ""}
              onChange={(e) => {
                const dollars = Number(e.target.value);
                setBudgetOverrideCents(
                  Number.isFinite(dollars) ? Math.round(dollars * 100) : 0,
                );
              }}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {budgetCents !== null && `= ${formatCents(budgetCents)} · `}
              official budget:{" "}
              {selectedCity ? formatCents(selectedCity.funding.officialBudgetCents) : "—"}
              {selectedCity && (
                <button
                  type="button"
                  className="ml-2 text-blue-600 hover:underline dark:text-blue-400"
                  onClick={() => setBudgetOverrideCents(null)}
                >
                  reset
                </button>
              )}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Objective weights
            </p>
            <div className="mt-2">
              <WeightSliders weights={weights} onChange={setWeights} />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Constraints
            </p>
            <div className="mt-2">
              <ConstraintsForm
                form={constraintsForm}
                onChange={setConstraintsForm}
                interventions={interventions}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={runOptimize}
              disabled={!requestBody || optimizeMutation.isPending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {optimizeMutation.isPending ? "Solving…" : "Run optimizer"}
            </button>
            <button
              type="button"
              onClick={runSensitivity}
              disabled={
                !requestBody ||
                sensitivityMutation.isPending ||
                !optimizeMutation.isSuccess
              }
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              title={
                !optimizeMutation.isSuccess
                  ? "Run the optimizer first"
                  : undefined
              }
            >
              {sensitivityMutation.isPending
                ? "Sweeping…"
                : "Run sensitivity analysis"}
            </button>
          </div>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Result
            </h2>
            <div className="mt-3">
              {optimizeMutation.isIdle && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Set your objective and constraints, then run the optimizer.
                </p>
              )}
              {optimizeMutation.isPending && (
                <LoadingBlock label="Solving the mixed-integer program…" />
              )}
              {optimizeMutation.isError && (
                <OptimizeErrorDisplay error={optimizeMutation.error} onRetry={runOptimize} />
              )}
              {optimizeMutation.isSuccess && (
                <ResultsPanel result={optimizeMutation.data} />
              )}
            </div>
          </section>

          {(sensitivityMutation.isPending ||
            sensitivityMutation.isSuccess ||
            sensitivityMutation.isError) && (
            <section>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Sensitivity analysis
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Re-solves the same scenario across attendance, budget,
                intervention-cost, transit-capacity, and visitor
                transit-usage assumptions (
                <code className="text-xs">POST /api/v1/optimize/sensitivity</code>
                ).
              </p>
              <div className="mt-3">
                {sensitivityMutation.isPending && (
                  <LoadingBlock label="Running sensitivity sweep (15 solves)…" />
                )}
                {sensitivityMutation.isError && (
                  <OptimizeErrorDisplay
                    error={sensitivityMutation.error}
                    onRetry={runSensitivity}
                  />
                )}
                {sensitivityMutation.isSuccess && (
                  <SensitivityPanel result={sensitivityMutation.data} />
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function OptimizeErrorDisplay({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  if (error instanceof ApiError && error.isInfeasible) {
    return (
      <InfeasibleBlock
        message={error.body?.message ?? error.message}
        diagnostics={error.body?.diagnostics ?? []}
      />
    );
  }
  if (error instanceof ApiError && error.isInvalidScenario) {
    return (
      <ErrorBlock
        title="Invalid scenario"
        message={error.body?.message ?? error.message}
        onRetry={onRetry}
      />
    );
  }
  return (
    <ErrorBlock
      message={error instanceof Error ? error.message : "The optimizer request failed."}
      onRetry={onRetry}
    />
  );
}
