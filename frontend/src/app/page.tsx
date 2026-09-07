"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getHealth } from "@/lib/api";
import { LoadingBlock, ErrorBlock } from "@/components/StatusStates";
import { formatInt } from "@/lib/format";

const cards = [
  {
    href: "/compare",
    title: "Compare all 11 host regions",
    body: "Official budgets, funding-phase splits, and demand for every 2026 U.S. host city side by side.",
  },
  {
    href: "/cities/nynj",
    title: "City evidence — New York/New Jersey",
    body: "The hero scenario: observed after-action match data, analog events, and funding, each with its evidence class and source.",
  },
  {
    href: "/optimize",
    title: "Run the optimizer",
    body: "Set objective weights and constraints, call the real mixed-integer optimizer, and see the selected portfolio and its sensitivity.",
  },
];

export default function HomePage() {
  const healthQuery = useQuery({ queryKey: ["health"], queryFn: getHealth });

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          World Cup 2026 Host-City Mobility Investment &amp; Legacy Optimizer
        </h1>
        <p className="mt-3 max-w-3xl text-base text-slate-600 dark:text-slate-400">
          Given a fixed transportation budget, which mix of interventions — extra
          transit service, bus lanes, signal plans, mobility hubs, and more —
          produces the largest measurable improvement in travel time,
          congestion, emissions, and accessibility for a FIFA World Cup 2026
          host region? This is a demonstration model: every number below is
          either linked, sourced evidence or a clearly labeled engineering
          assumption or model output — never presented as an observed fact
          unless it is one.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
          >
            <h2 className="font-semibold text-slate-900 group-hover:text-slate-950 dark:text-slate-100">
              {card.title}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {card.body}
            </p>
          </Link>
        ))}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Backend connection
        </h2>
        <div className="mt-2">
          {healthQuery.isPending && <LoadingBlock label="Checking backend…" />}
          {healthQuery.isError && (
            <ErrorBlock
              message={
                healthQuery.error instanceof Error
                  ? healthQuery.error.message
                  : "Could not reach the API."
              }
              onRetry={() => healthQuery.refetch()}
            />
          )}
          {healthQuery.data && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
              Connected to bundle{" "}
              <span className="font-mono">{healthQuery.data.bundleVersion}</span>{" "}
              — {formatInt(healthQuery.data.seed.recordCounts.hostRegions)} host
              regions, {formatInt(healthQuery.data.seed.recordCounts.funding)}{" "}
              funding rows,{" "}
              {formatInt(healthQuery.data.seed.recordCounts.projects3d)} 3D
              projects,{" "}
              {formatInt(healthQuery.data.seed.integrityChecksPassed)} startup
              integrity checks passed.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
