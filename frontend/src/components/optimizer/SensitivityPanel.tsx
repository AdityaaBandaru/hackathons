"use client";

import { Chart } from "@/components/Chart";
import { formatCents, formatNumber } from "@/lib/format";
import type { SensitivityResult } from "@/lib/types";

export function SensitivityPanel({ result }: { result: SensitivityResult }) {
  return (
    <div className="space-y-6">
      <div
        className={`rounded-lg px-4 py-3 text-sm ${
          result.summary.portfolioStable
            ? "border border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
            : "border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
        }`}
      >
        <p className="font-semibold">
          {result.summary.portfolioStable
            ? "Portfolio is stable across all sensitivity points."
            : `Portfolio changed at ${result.summary.pointsWherePortfolioChanged.length} of ${result.summary.pointsEvaluated} points.`}
        </p>
        {result.summary.infeasiblePoints.length > 0 && (
          <p className="mt-1">
            {result.summary.infeasiblePoints.length} point(s) became
            infeasible: {result.summary.infeasiblePoints.join(", ")}.
          </p>
        )}
      </div>

      {result.axes.map((axis) => {
        const feasiblePoints = axis.points.filter((p) => p.feasible);
        const option = {
          tooltip: { trigger: "axis" as const },
          legend: { data: ["Spent", "Objective score"], top: 0 },
          grid: { left: 70, right: 70, top: 40, bottom: 32 },
          xAxis: {
            type: "category" as const,
            data: axis.points.map((p) => p.label),
          },
          yAxis: [
            {
              // A bar's length must read as a true proportion of spend, so
              // this axis is pinned to zero rather than auto-scaled to the
              // (often narrow) range of the three points.
              type: "value" as const,
              name: "Spent ($)",
              min: 0,
              axisLabel: { formatter: (v: number) => `$${(v / 1e8).toFixed(0)}M` },
            },
            { type: "value" as const, name: "Score" },
          ],
          series: [
            {
              name: "Spent",
              type: "bar" as const,
              yAxisIndex: 0,
              data: axis.points.map((p) => (p.feasible ? p.spentCents : null)),
              itemStyle: { color: "#2563eb" },
            },
            {
              name: "Objective score",
              type: "line" as const,
              yAxisIndex: 1,
              data: axis.points.map((p) => (p.feasible ? p.objectiveScore : null)),
              itemStyle: { color: "#f59e0b" },
            },
          ],
        };

        return (
          <div
            key={axis.axis}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {axis.axis}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {axis.description}
            </p>
            {feasiblePoints.length > 0 && (
              <Chart
                option={option}
                height={220}
                ariaLabel={`Spend and objective score across the ${axis.axis} sensitivity axis`}
              />
            )}
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {axis.points.map((point) => (
                <div
                  key={point.label}
                  className={`rounded-md border px-3 py-2 text-xs ${
                    !point.feasible
                      ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
                      : point.portfolioChanged
                        ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950"
                        : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  }`}
                >
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    {point.label} (×{point.multiplier})
                  </p>
                  {point.feasible ? (
                    <>
                      <p className="text-slate-600 dark:text-slate-400">
                        {formatCents(point.spentCents)} spent · score{" "}
                        {formatNumber(point.objectiveScore, 2)}
                      </p>
                      <p className="text-slate-500 dark:text-slate-500">
                        {point.portfolioChanged
                          ? `Portfolio changed (+${point.projectIdsAdded.length}/-${point.projectIdsRemoved.length} projects)`
                          : "Portfolio unchanged"}
                      </p>
                    </>
                  ) : (
                    <p className="text-red-700 dark:text-red-300">
                      Infeasible: {point.infeasibility.message}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
