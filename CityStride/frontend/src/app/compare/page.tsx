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
    grid: { left: 140, right: 24, top: 12, bottom: 28 },
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
        itemStyle: { color: "#7c86ff" },
        barMaxWidth: 14,
      },
    ],
  };

  const phaseSplitOption = {
    tooltip: { trigger: "axis" as const, valueFormatter: (v: unknown) => formatCents(v as number) },
    legend: { data: ["Temporary", "Permanent", "Reserve"], top: 0, icon: "circle", itemWidth: 8, itemHeight: 8 },
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
        itemStyle: { color: "#fbbf24" },
      },
      {
        name: "Permanent",
        type: "bar" as const,
        stack: "total",
        data: sortedByBudget
          .map((c) => c.funding.permanentAllocationCents ?? 0)
          .reverse(),
        itemStyle: { color: "#34d399" },
      },
      {
        name: "Reserve",
        type: "bar" as const,
        stack: "total",
        data: sortedByBudget.map((c) => c.funding.reserveCents ?? 0).reverse(),
        itemStyle: { color: "#3f434a" },
      },
    ],
  };

  return (
    <div className="space-y-10">
      <header className="reveal">
        <p className="eyebrow">Host regions</p>
        <h1 className="display mt-2 text-3xl text-fg sm:text-4xl">
          Compare all 11 host regions
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-muted">
          Official federal transportation allocations and demand for every
          2026 U.S. host region, from{" "}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-[11px] text-fg">GET /api/v1/cities</code>.
          Funding evidence classes below are pulled from each city&apos;s
          underlying funding-category records.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card reveal p-5" style={{ "--i": 1 } as React.CSSProperties}>
          <h2 className="text-sm font-semibold text-fg">
            Official transportation budget by host region
          </h2>
          <p className="mt-0.5 text-xs text-fg-subtle">Axis starts at zero; bar length is a true proportion.</p>
          <Chart
            option={budgetChartOption}
            ariaLabel="Bar chart of official transportation budget in dollars by host region"
          />
        </section>
        <section className="card reveal p-5" style={{ "--i": 2 } as React.CSSProperties}>
          <h2 className="text-sm font-semibold text-fg">
            Temporary / permanent / reserve split
          </h2>
          <p className="mt-0.5 text-xs text-fg-subtle">Modeled split of each official total.</p>
          <Chart
            option={phaseSplitOption}
            ariaLabel="Stacked bar chart of temporary, permanent, and reserve allocation by host region"
          />
        </section>
      </div>

      <div className="table-wrap reveal" style={{ "--i": 3 } as React.CSSProperties}>
        <table className="table">
          <thead>
            <tr>
              <th>Host region</th>
              <th>Matches</th>
              <th>Stadium capacity</th>
              <th>Tournament demand</th>
              <th>Official budget</th>
              <th>Temporary / permanent</th>
              <th>Enabled projects</th>
            </tr>
          </thead>
          <tbody>
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
    <tr className={city.cityId === "nynj" ? "is-hero" : undefined}>
      <td>
        <Link href={`/cities/${city.cityId}`} className="link font-medium">
          {city.hostRegion}
        </Link>
        {city.cityId === "nynj" && (
          <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-fg">
            Hero scenario
          </span>
        )}
      </td>
      <td className="tabular-nums">{formatInt(city.matches)}</td>
      <td className="tabular-nums">{formatInt(city.stadiumCapacity)}</td>
      <td>
        <div className="flex flex-col gap-1.5">
          <span className="tabular-nums">{formatInt(city.tournamentDemand)}</span>
          <EvidenceBadge evidenceClass={city.demandClass} />
        </div>
      </td>
      <td>
        <div className="flex flex-col gap-1.5">
          <span className="font-medium tabular-nums text-fg">
            {formatCents(city.funding.officialBudgetCents)}
          </span>
          {funding ? (
            <EvidenceBadgeGroup records={funding} />
          ) : (
            <span className="text-xs text-fg-subtle">loading evidence…</span>
          )}
        </div>
      </td>
      <td>
        {tempShare !== null ? (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-emerald-400/30">
              <div
                className="h-full rounded-full bg-amber-400 transition-[width] duration-700 ease-[var(--ease-out-quint)]"
                style={{ width: `${tempShare * 100}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-fg-subtle">
              {formatPercent(tempShare, 0)} temp
            </span>
          </div>
        ) : (
          "—"
        )}
        <div className="mt-1 text-xs tabular-nums text-fg-subtle">
          {formatCents(temp)} / {formatCents(perm)}
        </div>
      </td>
      <td className="tabular-nums">{formatInt(city.enabledProjectCount)}</td>
    </tr>
  );
}
