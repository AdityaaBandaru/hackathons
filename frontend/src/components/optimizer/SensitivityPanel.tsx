"use client";

import { Chart } from "@/components/Chart";
import { formatCents, formatNumber } from "@/lib/format";
import type { SensitivityResult } from "@/lib/types";

export function SensitivityPanel({ result }: { result: SensitivityResult }) {
  return (
    <div className="space-y-6">
      <div
        className={`panel-note reveal ${
          result.summary.portfolioStable ? "note-ok" : "note-warn"
        }`}
      >
        <p className="font-semibold text-fg">
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

      {result.axes.map((axis, axisIndex) => {
        const feasiblePoints = axis.points.filter((p) => p.feasible);
        const option = {
          tooltip: { trigger: "axis" as const },
          legend: { data: ["Spent", "Objective score"], top: 0, icon: "circle", itemWidth: 8, itemHeight: 8 },
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
              itemStyle: { color: "#7c86ff", borderRadius: [3, 3, 0, 0] },
              barMaxWidth: 28,
            },
            {
              name: "Objective score",
              type: "line" as const,
              yAxisIndex: 1,
              data: axis.points.map((p) => (p.feasible ? p.objectiveScore : null)),
              itemStyle: { color: "#fbbf24" },
              lineStyle: { color: "#fbbf24" },
            },
          ],
        };

        return (
          <div
            key={axis.axis}
            className="card reveal p-5"
            style={{ "--i": axisIndex + 1 } as React.CSSProperties}
          >
            <h3 className="text-sm font-semibold text-fg">{axis.axis}</h3>
            <p className="mt-0.5 text-xs text-fg-subtle">{axis.description}</p>
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
                  className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                    !point.feasible
                      ? "border-danger/35 bg-danger/[0.07]"
                      : point.portfolioChanged
                        ? "border-warn/35 bg-warn/[0.07]"
                        : "border-border bg-surface-2"
                  }`}
                >
                  <p className="font-semibold text-fg">
                    {point.label} <span className="font-mono text-fg-subtle">×{point.multiplier}</span>
                  </p>
                  {point.feasible ? (
                    <>
                      <p className="mt-0.5 tabular-nums text-fg-muted">
                        {formatCents(point.spentCents)} spent · score{" "}
                        {formatNumber(point.objectiveScore, 2)}
                      </p>
                      <p className="text-fg-subtle">
                        {point.portfolioChanged
                          ? `Portfolio changed (+${point.projectIdsAdded.length}/-${point.projectIdsRemoved.length} projects)`
                          : "Portfolio unchanged"}
                      </p>
                    </>
                  ) : (
                    <p className="mt-0.5 text-danger">
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
