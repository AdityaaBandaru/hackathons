"use client";

import { EvidenceBadge } from "@/components/EvidenceBadge";
import { Close } from "@/components/ui/Icons";
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
      key={project.projectId}
      aria-label={`Project detail: ${project.categoryName}`}
      className="card animate-scale-in p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] text-fg-subtle">{project.projectId}</p>
          <h3 className="mt-0.5 text-base font-semibold tracking-tight text-fg">
            {project.categoryName}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close project detail"
          className="btn btn-ghost btn-sm -mr-1 -mt-1 h-7 w-7 px-0"
        >
          <Close className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium capitalize text-fg-muted">
          {project.phase}
        </span>
        {isSelectedInScenario ? (
          <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
            Selected in current scenario
          </span>
        ) : (
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-fg-subtle">
            Not selected in current scenario
          </span>
        )}
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-fg-muted">
        {project.designDescription}
      </p>

      <dl className="mt-4 space-y-4 text-sm">
        {scenarioProject && (
          <div>
            <dt className="metric-label">This scenario&apos;s allocation</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-fg">
              {formatCents(scenarioProject.allocationCents)}
              <span className="ml-2 text-xs font-normal text-fg-subtle">
                {scenarioProject.units} × {scenarioProject.decisionUnit}
              </span>
            </dd>
            <dd className="mt-1.5">
              <EvidenceBadge evidenceClass={scenario!.evidenceClass} />
            </dd>
          </div>
        )}

        <div>
          <dt className="metric-label">Seeded allocation</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-fg">
            {formatCents(project.allocationCents)}
            {project.allocationCents === 0 && (
              <span className="ml-2 text-xs font-normal text-fg-subtle">
                not funded in the bundle&apos;s own demonstration portfolio
              </span>
            )}
          </dd>
          <dd className="mt-1.5">
            <EvidenceBadge
              evidenceClass={project.evidenceClass}
              sourceUrl={project.sourceUrl}
            />
          </dd>
        </div>

        <div>
          <dt className="metric-label">Location basis</dt>
          <dd className="mt-0.5 text-fg">{project.exactAreaName}</dd>
          <dd className="text-xs leading-relaxed text-fg-subtle">
            {project.spatialPrecision} — a conceptual planning anchor, not a
            surveyed location.
          </dd>
        </div>

        <div>
          <dt className="metric-label">Status</dt>
          <dd className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">
            <code className="rounded bg-surface-2 px-1 py-0.5 text-[11px] text-fg">
              {project.implementationStatus}
            </code>{" "}
            — a modeled proposal, not a funded or approved project.
          </dd>
        </div>
      </dl>
    </aside>
  );
}
