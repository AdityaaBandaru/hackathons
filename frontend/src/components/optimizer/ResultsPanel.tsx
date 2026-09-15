"use client";

import { EvidenceBadge } from "@/components/EvidenceBadge";
import { formatCents, formatNumber, formatPercent } from "@/lib/format";
import type { OptimizeResult } from "@/lib/types";

/**
 * Renders exactly what POST /api/v1/optimize returned. selectedProjectIds
 * and selectedProjects come straight from the response -- this component
 * never invents a selected object (CLAUDE.md rule 11).
 */
export function ResultsPanel({ result }: { result: OptimizeResult }) {
  const spentShare =
    result.budgetCents > 0 ? result.spentCents / result.budgetCents : 0;

  return (
    <div className="space-y-6">
      <div className="panel-note note-model reveal">
        <div className="flex flex-wrap items-center gap-2">
          <EvidenceBadge evidenceClass={result.evidenceClass} />
          <span className="font-mono text-[11px] opacity-80">{result.modelVersion}</span>
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed opacity-90">
          {result.modelAssumptions.note}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile i={1} label="Budget" value={formatCents(result.budgetCents)} />
        <MetricTile i={2} label="Spent" value={formatCents(result.spentCents)} />
        <MetricTile i={3} label="Unspent" value={formatCents(result.unspentCents)} />
        <MetricTile
          i={4}
          label="Objective score"
          value={formatNumber(result.objectiveScore, 3)}
        />
      </div>

      {/* Budget utilisation bar */}
      <div className="reveal" style={{ "--i": 5 } as React.CSSProperties}>
        <div className="flex items-baseline justify-between text-[11px] text-fg-subtle">
          <span>Budget utilisation</span>
          <span className="font-mono tabular-nums">{formatPercent(spentShare)}</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-model transition-[width] duration-1000 ease-[var(--ease-out-quint)]"
            style={{ width: `${Math.min(100, spentShare * 100)}%` }}
          />
        </div>
      </div>

      <div className="reveal" style={{ "--i": 6 } as React.CSSProperties}>
        <h3 className="text-sm font-semibold text-fg">
          Selected portfolio ({result.selectedProjectIds.length} project IDs)
        </h3>
        <div className="table-wrap mt-2">
          <table className="table">
            <thead>
              <tr>
                <th>Project ID</th>
                <th>Category</th>
                <th>Phase</th>
                <th>Units</th>
                <th>Allocation</th>
              </tr>
            </thead>
            <tbody>
              {result.selectedProjects.map((project) => (
                <tr key={project.projectId}>
                  <td className="whitespace-nowrap font-mono text-[11px] text-fg-subtle">
                    {project.projectId}
                  </td>
                  <td className="text-fg">
                    {project.categoryName}
                    {project.isAccessibility && (
                      <span className="ml-1.5 rounded-full bg-sky-400/10 px-1.5 py-0.5 text-[10px] text-sky-300 ring-1 ring-inset ring-sky-400/30">
                        accessibility
                      </span>
                    )}
                    {project.isMajorConstruction && (
                      <span className="ml-1.5 rounded-full bg-orange-400/10 px-1.5 py-0.5 text-[10px] text-orange-300 ring-1 ring-inset ring-orange-400/30">
                        construction
                      </span>
                    )}
                  </td>
                  <td className="capitalize">{project.phase}</td>
                  <td className="tabular-nums">{project.units}</td>
                  <td className="whitespace-nowrap tabular-nums text-fg">
                    {formatCents(project.allocationCents)}
                  </td>
                </tr>
              ))}
              {result.selectedProjects.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-fg-subtle">
                    No projects funded at this budget.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div
        className="grid gap-4 sm:grid-cols-2 reveal"
        style={{ "--i": 7 } as React.CSSProperties}
      >
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-fg">Phase split</h3>
          <dl className="mt-2 text-[13px]">
            <Row
              label="Temporary"
              value={`${formatCents(result.phaseSplit.temporaryCents)} (${formatPercent(result.phaseSplit.temporaryShare)})`}
            />
            <Row
              label="Permanent"
              value={`${formatCents(result.phaseSplit.permanentCents)} (${formatPercent(result.phaseSplit.permanentShare)})`}
            />
            <Row
              label="Accessibility spend"
              value={`${formatCents(result.accessibilitySpend.cents)} (${formatPercent(result.accessibilitySpend.share)})`}
            />
            <Row
              label="Major-construction projects"
              value={String(result.majorConstructionProjectCount)}
            />
          </dl>
        </div>
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-fg">Modeled benefits</h3>
          <dl className="mt-2 text-[13px]">
            <Row
              label="Passenger-hours saved"
              value={formatNumber(result.benefits.passengerHoursSaved, 0)}
            />
            <Row
              label="Avg. minutes saved / attendee"
              value={formatNumber(result.benefits.avgMinutesSavedPerAttendee, 2)}
            />
            <Row
              label="Vehicle-hours avoided"
              value={formatNumber(result.benefits.vehicleHoursAvoided, 0)}
            />
            <Row
              label="CO₂ tonnes avoided"
              value={formatNumber(result.benefits.co2TonnesAvoided, 1)}
            />
            <Row
              label="Accessible trips improved"
              value={formatNumber(result.benefits.accessibleTripsImproved, 0)}
            />
            <Row
              label="Reliability risk reduction"
              value={`${formatNumber(result.benefits.reliabilityRiskPpReduction, 1)} pp`}
            />
          </dl>
        </div>
      </div>

      {result.nextBest && (
        <div
          className="card reveal flex items-start gap-3 px-4 py-3 text-[13px]"
          style={{ "--i": 8 } as React.CSSProperties}
        >
          <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-md bg-accent-soft text-accent-fg">
            →
          </span>
          <div>
            <p className="font-semibold text-fg">
              Next dollar goes to: {result.nextBest.categoryName}
            </p>
            <p className="mt-0.5 text-fg-muted">
              Unit #{result.nextBest.unitNumber} ({result.nextBest.decisionUnit}) —{" "}
              {formatCents(result.nextBest.unitCostCents)}, utility{" "}
              {formatNumber(result.nextBest.utilityPerMillionCents, 4)} per $1M
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricTile({ label, value, i }: { label: string; value: string; i: number }) {
  return (
    <div className="metric reveal" style={{ "--i": i } as React.CSSProperties}>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border py-1.5 last:border-b-0">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-right font-medium tabular-nums text-fg">{value}</dd>
    </div>
  );
}
