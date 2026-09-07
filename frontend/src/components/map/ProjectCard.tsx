"use client";

import { EvidenceBadge } from "@/components/EvidenceBadge";
import { formatCents } from "@/lib/format";
import type { OptimizeResult, Project3D } from "@/lib/types";

/**
 * Detail card for a clicked project.
 *
 * Attributes come from GET /api/v1/cities/nynj/projects -- the same query the
 * city evidence page reads, sharing one TanStack Query cache entry, so the map
 * and the evidence page can never disagree about a project.
 *
 * Cost is deliberately shown twice when the two differ, because they are two
 * different claims: the bundle's own modeled allocation (an engineering
 * assumption, with a source) and this scenario's allocation (a model output of
 * the run you just did). Collapsing them into one number would present a model
 * output as if it were the seeded figure (CLAUDE.md rule 8).
 */
export function ProjectCard({
  project,
  scenario,
  isSelectedInScenario,
  onClose,
}: {
  project: Project3D;
  scenario: OptimizeResult | null;
  isSelectedInScenario: boolean;
  onClose: () => void;
}) {
  const scenarioProject = scenario?.selectedProjects.find(
    (p) => p.projectId === project.projectId,
  );

  return (
    <aside
      aria-label={`Project detail: ${project.categoryName}`}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-slate-400">{project.projectId}</p>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {project.categoryName}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close project detail"
          className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {project.phase}
        </span>
        {isSelectedInScenario ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
            Selected in current scenario
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            Not selected in current scenario
          </span>
        )}
      </div>

      <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
        {project.designDescription}
      </p>

      <dl className="mt-4 space-y-3 text-sm">
        {scenarioProject && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              This scenario&apos;s allocation
            </dt>
            <dd className="font-semibold text-slate-900 dark:text-slate-100">
              {formatCents(scenarioProject.allocationCents)}
              <span className="ml-2 text-xs font-normal text-slate-500">
                {scenarioProject.units} × {scenarioProject.decisionUnit}
              </span>
            </dd>
            <dd className="mt-1">
              <EvidenceBadge evidenceClass={scenario!.evidenceClass} />
            </dd>
          </div>
        )}

        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Seeded allocation
          </dt>
          <dd className="font-semibold text-slate-900 dark:text-slate-100">
            {formatCents(project.allocationCents)}
            {project.allocationCents === 0 && (
              <span className="ml-2 text-xs font-normal text-slate-500">
                not funded in the bundle&apos;s own demonstration portfolio
              </span>
            )}
          </dd>
          <dd className="mt-1">
            <EvidenceBadge
              evidenceClass={project.evidenceClass}
              sourceUrl={project.sourceUrl}
            />
          </dd>
        </div>

        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Location basis
          </dt>
          <dd className="text-slate-700 dark:text-slate-300">
            {project.exactAreaName}
          </dd>
          <dd className="text-xs text-slate-500 dark:text-slate-400">
            {project.spatialPrecision} — a conceptual planning anchor, not a
            surveyed location.
          </dd>
        </div>

        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Status
          </dt>
          <dd className="text-slate-700 dark:text-slate-300">
            <code className="text-xs">{project.implementationStatus}</code> — a
            modeled proposal, not a funded or approved project.
          </dd>
        </div>
      </dl>
    </aside>
  );
}
