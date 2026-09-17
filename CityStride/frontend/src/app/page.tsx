"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getHealth } from "@/lib/api";
import { LoadingBlock, ErrorBlock } from "@/components/StatusStates";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { ArrowRight, Bars, Cube, Layers, Sliders } from "@/components/ui/Icons";
import { formatInt } from "@/lib/format";

const cards = [
  {
    href: "/compare",
    icon: Bars,
    title: "Compare all 11 host regions",
    body: "Official budgets, funding-phase splits, and demand for every 2026 U.S. host city side by side.",
  },
  {
    href: "/cities/nynj",
    icon: Layers,
    title: "City evidence — New York/New Jersey",
    body: "The hero scenario: observed after-action match data, analog events, and funding, each with its evidence class and source.",
  },
  {
    href: "/optimize",
    icon: Sliders,
    title: "Run the optimizer",
    body: "Set objective weights and constraints, call the real mixed-integer optimizer, and see the selected portfolio and its sensitivity.",
  },
  {
    href: "/studio",
    icon: Cube,
    title: "Open the 3D design studio",
    body: "Concept models of every intervention, built from each record's own dimensions. Compare temporary and permanent at the same scale.",
  },
];

const principles = [
  ["Sourced or labeled", "Every number is linked evidence, or tagged as an assumption or model output."],
  ["Integer cents", "Money is never a float. The 11 official allocations reconcile to the cent."],
  ["Nothing invented", "Missing values stay missing. The studio shows as selected only what the optimizer returned."],
];

export default function HomePage() {
  const healthQuery = useQuery({ queryKey: ["health"], queryFn: getHealth });

  return (
    <div className="space-y-20">
      {/* Hero */}
      <section className="pt-8 sm:pt-16">
        <div className="reveal inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 py-1 pl-1.5 pr-3 text-xs text-fg-muted backdrop-blur">
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-fg">
            Demonstration model
          </span>
          FIFA World Cup 2026 · 11 U.S. host regions
        </div>

        <h1
          className="display display-gradient reveal mt-6 max-w-4xl text-4xl sm:text-6xl"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          Spend a fixed mobility budget where it moves the most people.
        </h1>

        <p
          className="reveal mt-6 max-w-2xl text-base leading-relaxed text-fg-muted sm:text-lg"
          style={{ "--i": 2 } as React.CSSProperties}
        >
          Given a host region&apos;s transportation budget, which mix of extra
          transit service, bus lanes, signal plans, mobility hubs and more
          produces the largest measurable improvement in travel time,
          congestion, emissions and accessibility — and what lasts after the
          final whistle?
        </p>

        <div
          className="reveal mt-8 flex flex-wrap items-center gap-3"
          style={{ "--i": 3 } as React.CSSProperties}
        >
          <Link href="/optimize" className="btn btn-primary">
            Run the optimizer
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/studio" className="btn btn-secondary">
            Open the 3D studio
          </Link>
          <span className="ml-1 hidden items-center gap-1.5 text-xs text-fg-subtle sm:inline-flex">
            <span className="kbd">POST</span> /api/v1/optimize
          </span>
        </div>
      </section>

      {/* Feature cards */}
      <section aria-label="Sections">
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="reveal block rounded-[14px] focus-visible:outline-none"
                style={{ "--i": i + 4 } as React.CSSProperties}
              >
                <SpotlightCard className="h-full p-6">
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface-2 text-accent-fg">
                      <Icon className="h-4 w-4" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-fg-subtle transition-transform duration-300 ease-[var(--ease-out-quint)] group-hover/spot:translate-x-1 group-hover/spot:text-fg" />
                  </div>
                  <h2 className="mt-5 text-[15px] font-semibold tracking-tight text-fg">
                    {card.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-fg-muted">
                    {card.body}
                  </p>
                </SpotlightCard>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Principles */}
      <section>
        <p className="eyebrow">How to read every number here</p>
        <div className="mt-4 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
          {principles.map(([title, body], i) => (
            <div
              key={title}
              className="reveal bg-surface p-5"
              style={{ "--i": i + 8 } as React.CSSProperties}
            >
              <p className="text-sm font-semibold text-fg">{title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Backend status */}
      <section>
        <p className="eyebrow">Backend connection</p>
        <div className="mt-3">
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
            <div className="card animate-scale-in flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-sm">
                <span className="dot" />
                <span className="text-fg">Connected</span>
                <span className="font-mono text-xs text-fg-subtle">
                  {healthQuery.data.bundleVersion}
                </span>
              </div>
              <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-fg-muted">
                <Stat
                  n={healthQuery.data.seed.recordCounts.hostRegions}
                  label="host regions"
                />
                <Stat
                  n={healthQuery.data.seed.recordCounts.funding}
                  label="funding rows"
                />
                <Stat
                  n={healthQuery.data.seed.recordCounts.projects3d}
                  label="3D projects"
                />
                <Stat
                  n={healthQuery.data.seed.integrityChecksPassed}
                  label="integrity checks"
                />
              </dl>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <dd className="font-semibold tabular-nums text-fg">{formatInt(n)}</dd>
      <dt>{label}</dt>
    </div>
  );
}
