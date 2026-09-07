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
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-900 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-200">
        <div className="flex flex-wrap items-center gap-2">
          <EvidenceBadge evidenceClass={result.evidenceClass} />
          <span className="font-mono text-xs">{result.modelVersion}</span>
        </div>
        <p className="mt-1">{result.modelAssumptions.note}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="Budget" value={formatCents(result.budgetCents)} />
        <MetricTile label="Spent" value={formatCents(result.spentCents)} />
        <MetricTile label="Unspent" value={formatCents(result.unspentCents)} />
        <MetricTile
          label="Objective score"
          value={formatNumber(result.objectiveScore, 3)}
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Selected portfolio ({result.selectedProjectIds.length} project IDs)
        </h3>
        <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2">Project ID</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Phase</th>
                <th className="px-3 py-2">Units</th>
                <th className="px-3 py-2">Allocation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {result.selectedProjects.map((project) => (
                <tr key={project.projectId}>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {project.projectId}
                  </td>
                  <td className="px-3 py-2 text-slate-800 dark:text-slate-200">
                    {project.categoryName}
                    {project.isAccessibility && (
                      <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        accessibility
                      </span>
                    )}
                    {project.isMajorConstruction && (
                      <span className="ml-1.5 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                        construction
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 capitalize text-slate-600 dark:text-slate-400">
                    {project.phase}
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                    {project.units}
                  </td>
                  <td className="px-3 py-2 text-slate-800 dark:text-slate-200">
                    {formatCents(project.allocationCents)}
                  </td>
                </tr>
              ))}
              {result.selectedProjects.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-4 text-center text-slate-400"
                  >
                    No projects funded at this budget.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Phase split
          </h3>
          <dl className="mt-2 space-y-1 text-sm">
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
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Modeled benefits
          </h3>
          <dl className="mt-2 space-y-1 text-sm">
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
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="font-semibold text-slate-700 dark:text-slate-300">
            Next dollar goes to: {result.nextBest.categoryName}
          </p>
          <p className="text-slate-600 dark:text-slate-400">
            Unit #{result.nextBest.unitNumber} ({result.nextBest.decisionUnit}) —{" "}
            {formatCents(result.nextBest.unitCostCents)}, utility{" "}
            {formatNumber(result.nextBest.utilityPerMillionCents, 4)} per $1M
          </p>
        </div>
      )}
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-dashed border-slate-200 py-1 dark:border-slate-800">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-800 dark:text-slate-200">{value}</dd>
    </div>
  );
}
