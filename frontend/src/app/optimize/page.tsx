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
import { useScenario } from "@/lib/scenario";
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
  const { publishScenario } = useScenario();
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
    // A successful run becomes the current scenario, which is the only thing
    // the map will draw as "selected" (CLAUDE.md rule 11).
    onSuccess: (result) => publishScenario(result),
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
      <header className="reveal">
        <p className="eyebrow">Optimizer</p>
        <h1 className="display mt-2 text-3xl text-fg sm:text-4xl">
          Mobility investment optimizer
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-muted">
          Set an objective and constraints, then run the real backend
          mixed-integer solver at{" "}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-[11px] text-fg">
            POST /api/v1/optimize
          </code>
          . Nothing is computed in the browser — every number below comes
          straight from the API response.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <div
          className="card reveal space-y-6 self-start p-5"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          <div>
            <label htmlFor="city-select" className="text-[13px] font-medium text-fg">
              Host region
            </label>
            <select
              id="city-select"
              value={cityId}
              onChange={(e) => {
                setCityId(e.target.value);
                setBudgetOverrideCents(null);
              }}
              className="field mt-1.5"
            >
              {cities.map((city) => (
                <option key={city.cityId} value={city.cityId}>
                  {city.hostRegion}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="budget-input" className="text-[13px] font-medium text-fg">
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
              className="field mt-1.5 tabular-nums"
            />
            <p className="mt-1.5 text-xs tabular-nums text-fg-subtle">
              {budgetCents !== null && `= ${formatCents(budgetCents)} · `}
              official budget:{" "}
              {selectedCity ? formatCents(selectedCity.funding.officialBudgetCents) : "—"}
              {selectedCity && (
                <button
                  type="button"
                  className="link ml-2"
                  onClick={() => setBudgetOverrideCents(null)}
                >
                  reset
                </button>
              )}
            </p>
          </div>

          <div className="divider" />

          <div>
            <p className="text-[13px] font-medium text-fg">Objective weights</p>
            <div className="mt-3">
              <WeightSliders weights={weights} onChange={setWeights} />
            </div>
          </div>

          <div className="divider" />

          <div>
            <p className="text-[13px] font-medium text-fg">Constraints</p>
            <div className="mt-3">
              <ConstraintsForm
                form={constraintsForm}
                onChange={setConstraintsForm}
                interventions={interventions}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={runOptimize}
              disabled={!requestBody || optimizeMutation.isPending}
              className="btn btn-primary"
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
              className="btn btn-secondary"
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

        <div className="min-w-0 space-y-10">
          <section className="reveal" style={{ "--i": 2 } as React.CSSProperties}>
            <h2 className="text-lg font-semibold tracking-tight text-fg">Result</h2>
            <div className="mt-3">
              {optimizeMutation.isIdle && (
                <div className="card flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
                  <span className="grid h-10 w-10 place-items-center rounded-full border border-border bg-surface-2 text-accent-fg">
                    <span className="kbd">↵</span>
                  </span>
                  <p className="text-sm text-fg-muted">
                    Set your objective and constraints, then run the optimizer.
                  </p>
                  <p className="text-xs text-fg-subtle">
                    The portfolio it returns becomes the scenario the map draws.
                  </p>
                </div>
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
            <section className="animate-fade-up">
              <h2 className="text-lg font-semibold tracking-tight text-fg">
                Sensitivity analysis
              </h2>
              <p className="mt-1 text-sm text-fg-muted">
                Re-solves the same scenario across attendance, budget,
                intervention-cost, transit-capacity, and visitor
                transit-usage assumptions (
                <code className="text-[11px] text-fg">POST /api/v1/optimize/sensitivity</code>
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
