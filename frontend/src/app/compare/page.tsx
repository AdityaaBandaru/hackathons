"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { getCities, getCityEvidence } from "@/lib/api";
import { LoadingBlock, ErrorBlock } from "@/components/StatusStates";
import { EvidenceBadge, EvidenceBadgeGroup } from "@/components/EvidenceBadge";
import { Chart } from "@/components/Chart";
import { formatCents, formatInt, formatPercent } from "@/lib/format";
import type { CitySummary, FundingRecord } from "@/lib/types";

export default function ComparePage() {
  const citiesQuery = useQuery({ queryKey: ["cities"], queryFn: getCities });

  // Stable empty-array reference while pending, so downstream useMemo/useQueries
  // dependency arrays don't see a "new" cities array on every render.
  const cities = useMemo(() => citiesQuery.data ?? [], [citiesQuery.data]);
  const evidenceQueries = useQueries({
    queries: cities.map((city) => ({
      queryKey: ["cityEvidence", city.cityId],
      queryFn: () => getCityEvidence(city.cityId),
      enabled: cities.length > 0,
      staleTime: 60_000,
    })),
  });

  const fundingByCity = useMemo(() => {
    const map = new Map<string, FundingRecord[]>();
    evidenceQueries.forEach((query, index) => {
      const city = cities[index];
      if (city && query.data) map.set(city.cityId, query.data.funding);
    });
    return map;
  }, [evidenceQueries, cities]);

  const sortedByBudget = useMemo(
    () =>
      [...cities].sort(
        (a, b) => b.funding.officialBudgetCents - a.funding.officialBudgetCents,
      ),
    [cities],
  );

  if (citiesQuery.isPending) {
    return <LoadingBlock label="Loading host-region comparison…" />;
  }
  if (citiesQuery.isError) {
    return (
      <ErrorBlock
        message={
          citiesQuery.error instanceof Error
            ? citiesQuery.error.message
            : "Failed to load cities."
        }
        onRetry={() => citiesQuery.refetch()}
      />
    );
  }

  const budgetChartOption = {
    tooltip: { trigger: "axis" as const, valueFormatter: (v: unknown) => formatCents(v as number) },
    grid: { left: 140, right: 24, top: 16, bottom: 24 },
    xAxis: {
      type: "value" as const,
      // ECharts auto-scales a value axis to the data's own range by default,
      // which for these budgets (all $8.4M-$10.4M) puts the axis minimum
      // near $8M -- every bar would be a barely-visible sliver above that
      // baseline. Force it to start at zero so bar length reads as a true
      // proportion of the budget.
      min: 0,
      axisLabel: { formatter: (v: number) => `$${(v / 1e8).toFixed(0)}M` },
    },
    yAxis: {
      type: "category" as const,
      data: sortedByBudget.map((c) => c.hostRegion).reverse(),
    },
    series: [
      {
        type: "bar" as const,
        data: sortedByBudget.map((c) => c.funding.officialBudgetCents).reverse(),
        itemStyle: { color: "#2563eb" },
        barMaxWidth: 18,
      },
    ],
  };

  const phaseSplitOption = {
    tooltip: { trigger: "axis" as const, valueFormatter: (v: unknown) => formatCents(v as number) },
    legend: { data: ["Temporary", "Permanent", "Reserve"], top: 0 },
    grid: { left: 140, right: 24, top: 40, bottom: 24 },
    xAxis: {
      type: "value" as const,
      min: 0,
      axisLabel: { formatter: (v: number) => `$${(v / 1e8).toFixed(0)}M` },
    },
    yAxis: {
      type: "category" as const,
      data: sortedByBudget.map((c) => c.hostRegion).reverse(),
    },
    series: [
      {
        name: "Temporary",
        type: "bar" as const,
        stack: "total",
        data: sortedByBudget
          .map((c) => c.funding.temporaryAllocationCents ?? 0)
          .reverse(),
        itemStyle: { color: "#f59e0b" },
      },
      {
        name: "Permanent",
        type: "bar" as const,
        stack: "total",
        data: sortedByBudget
          .map((c) => c.funding.permanentAllocationCents ?? 0)
          .reverse(),
        itemStyle: { color: "#059669" },
      },
      {
        name: "Reserve",
        type: "bar" as const,
        stack: "total",
        data: sortedByBudget.map((c) => c.funding.reserveCents ?? 0).reverse(),
        itemStyle: { color: "#94a3b8" },
      },
    ],
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Compare all 11 host regions
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Official federal transportation allocations and demand for every
          2026 U.S. host region, from{" "}
          <code className="text-xs">GET /api/v1/cities</code>. Funding
          evidence classes below are pulled from each city&apos;s underlying
          funding-category records.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Official transportation budget by host region
          </h2>
          <Chart
            option={budgetChartOption}
            ariaLabel="Bar chart of official transportation budget in dollars by host region"
          />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Temporary / permanent / reserve split
          </h2>
          <Chart
            option={phaseSplitOption}
            ariaLabel="Stacked bar chart of temporary, permanent, and reserve allocation by host region"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <th className="px-4 py-3">Host region</th>
              <th className="px-4 py-3">Matches</th>
              <th className="px-4 py-3">Stadium capacity</th>
              <th className="px-4 py-3">Tournament demand</th>
              <th className="px-4 py-3">Official budget</th>
              <th className="px-4 py-3">Temporary / permanent</th>
              <th className="px-4 py-3">Enabled projects</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {sortedByBudget.map((city) => (
              <CityRow
                key={city.cityId}
                city={city}
                funding={fundingByCity.get(city.cityId)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CityRow({
  city,
  funding,
}: {
  city: CitySummary;
  funding: FundingRecord[] | undefined;
}) {
  const temp = city.funding.temporaryAllocationCents;
  const perm = city.funding.permanentAllocationCents;
  const total = city.funding.officialBudgetCents;
  const tempShare = temp !== null && total > 0 ? temp / total : null;

  return (
    <tr
      className={
        city.cityId === "nynj"
          ? "bg-blue-50/60 dark:bg-blue-950/30"
          : "hover:bg-slate-50 dark:hover:bg-slate-900/50"
      }
    >
      <td className="px-4 py-3">
        <Link
          href={`/cities/${city.cityId}`}
          className="font-medium text-blue-700 hover:underline dark:text-blue-400"
        >
          {city.hostRegion}
        </Link>
        {city.cityId === "nynj" && (
          <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            Hero scenario
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
        {formatInt(city.matches)}
      </td>
      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
        {formatInt(city.stadiumCapacity)}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="text-slate-700 dark:text-slate-300">
            {formatInt(city.tournamentDemand)}
          </span>
          <EvidenceBadge evidenceClass={city.demandClass} />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {formatCents(city.funding.officialBudgetCents)}
          </span>
          {funding ? (
            <EvidenceBadgeGroup records={funding} />
          ) : (
            <span className="text-xs text-slate-400">loading evidence…</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {tempShare !== null ? (
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 overflow-hidden rounded-full bg-emerald-200 dark:bg-emerald-900">
              <div
                className="h-full bg-amber-500"
                style={{ width: `${tempShare * 100}%` }}
              />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {formatPercent(tempShare, 0)} temp
            </span>
          </div>
        ) : (
          "—"
        )}
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {formatCents(temp)} / {formatCents(perm)}
        </div>
      </td>
      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
        {formatInt(city.enabledProjectCount)}
      </td>
    </tr>
  );
}
