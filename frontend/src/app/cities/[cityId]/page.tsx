"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getCity, getCityEvidence, getCityProjects, ApiError } from "@/lib/api";
import { LoadingBlock, ErrorBlock } from "@/components/StatusStates";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { formatCents, formatInt, formatPercent } from "@/lib/format";

export default function CityEvidencePage() {
  const params = useParams<{ cityId: string }>();
  const cityId = params.cityId;

  const cityQuery = useQuery({
    queryKey: ["city", cityId],
    queryFn: () => getCity(cityId),
  });
  const evidenceQuery = useQuery({
    queryKey: ["cityEvidence", cityId],
    queryFn: () => getCityEvidence(cityId),
  });
  const projectsQuery = useQuery({
    queryKey: ["cityProjects", cityId],
    queryFn: () => getCityProjects(cityId),
  });

  if (cityQuery.isPending || evidenceQuery.isPending || projectsQuery.isPending) {
    return <LoadingBlock label={`Loading evidence for ${cityId}…`} />;
  }

  const notFoundError = [cityQuery, evidenceQuery, projectsQuery]
    .map((q) => q.error)
    .find((e): e is ApiError => e instanceof ApiError && e.status === 404);

  if (notFoundError) {
    const validIds = (notFoundError.body as { validCityIds?: string[] })
      ?.validCityIds;
    return (
      <ErrorBlock
        title="Unknown city"
        message={
          validIds
            ? `"${cityId}" is not one of the 11 host regions. Valid IDs: ${validIds.join(", ")}.`
            : notFoundError.message
        }
      />
    );
  }

  if (cityQuery.isError || evidenceQuery.isError || projectsQuery.isError) {
    const error = cityQuery.error ?? evidenceQuery.error ?? projectsQuery.error;
    return (
      <ErrorBlock
        message={error instanceof Error ? error.message : "Failed to load city."}
        onRetry={() => {
          cityQuery.refetch();
          evidenceQuery.refetch();
          projectsQuery.refetch();
        }}
      />
    );
  }

  const city = cityQuery.data!;
  const evidence = evidenceQuery.data!;
  const projects = projectsQuery.data!;

  return (
    <div className="space-y-10">
      <header>
        <Link
          href="/compare"
          className="text-xs text-slate-500 hover:underline dark:text-slate-400"
        >
          ← Back to comparison
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
          {city.hostRegion}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          {city.dominantBottleneck} · {city.venueAccessType}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Matches" value={formatInt(city.matches)} />
        <Stat label="Stadium capacity" value={formatInt(city.stadiumCapacity)} />
        <Stat
          label="Tournament demand"
          value={formatInt(city.tournamentDemand)}
          evidence={{ evidenceClass: city.demandClass }}
        />
        <Stat
          label="Official budget"
          value={formatCents(city.funding.officialBudgetCents)}
        />
      </section>

      <FundingSection funding={evidence.funding} />

      {cityId === "nynj" ? (
        <MatchDataSection matchData={evidence.matchData} />
      ) : (
        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Match-day after-action data
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            No per-match after-action report exists for {city.hostRegion} in
            this bundle. The New Jersey Transit after-action report is the
            only match-level dataset on file, and it applies only to the
            NY/NJ host region — this page correctly shows nothing rather than
            inventing a figure.
          </p>
        </section>
      )}

      <AnalogEventsSection events={evidence.analogEvents} />

      <EvidenceMetricsSection
        title="2026 evidence"
        records={evidence.evidence2026.map((r) => ({
          id: r.evidenceId,
          metric: r.metric,
          value: `${formatInt(r.value)} ${r.unit}`,
          qualifier: r.qualifier,
          evidenceClass: r.evidenceClass,
          sourceUrl: r.sourceUrl,
        }))}
      />

      <EvidenceMetricsSection
        title="Observed summary"
        records={evidence.observedSummary.map((r) => ({
          id: r.observationId,
          metric: r.metric,
          value: `${formatInt(r.value)} ${r.unit}`,
          qualifier: r.qualifier,
          evidenceClass: r.evidenceClass,
          sourceUrl: r.sourceUrl,
        }))}
      />

      <PedestrianAreasSection areas={evidence.pedestrianAreas} />

      <ProjectsSection
        projects={projects.projects}
        legacyProjects={projects.legacyProjects}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  evidence,
}: {
  label: string;
  value: string;
  evidence?: { evidenceClass: string; sourceUrl?: string };
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
        {value}
      </p>
      {evidence && (
        <div className="mt-2">
          <EvidenceBadge
            evidenceClass={evidence.evidenceClass}
            sourceUrl={evidence.sourceUrl}
          />
        </div>
      )}
    </div>
  );
}

function FundingSection({
  funding,
}: {
  funding: import("@/lib/types").FundingRecord[];
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Funding by intervention category
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        How the official budget is modeled as split across the 12 intervention
        categories plus reserve. Every allocation is an engineering
        assumption about how to spend an official total, not itself an
        observed expenditure.
      </p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Units</th>
              <th className="px-3 py-2">Allocation</th>
              <th className="px-3 py-2">Temp / Perm</th>
              <th className="px-3 py-2">Evidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {funding.map((row) => (
              <tr key={row.category}>
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                  {row.categoryName}
                  <div className="text-xs font-normal text-slate-400">
                    {row.decisionUnit}
                  </div>
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                  {row.selectedUnits}
                </td>
                <td className="px-3 py-2 text-slate-800 dark:text-slate-200">
                  {formatCents(row.modeledCategoryAllocationCents)}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                  {formatCents(row.temporaryAllocationCents)} /{" "}
                  {formatCents(row.permanentAllocationCents)}
                </td>
                <td className="px-3 py-2">
                  <EvidenceBadge
                    evidenceClass={row.evidenceClass}
                    sourceUrl={row.sourceUrl}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MatchDataSection({
  matchData,
}: {
  matchData: import("@/lib/types").MatchDataRecord[];
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Match-day after-action data
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        NJ Transit&apos;s after-action report for MetLife Stadium — the
        &quot;Plan&quot; row is the pre-tournament operational plan; every
        other row is an observed final match record.
      </p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <th className="px-3 py-2">Match</th>
              <th className="px-3 py-2">Ticket holders</th>
              <th className="px-3 py-2">Uber</th>
              <th className="px-3 py-2">Host shuttles</th>
              <th className="px-3 py-2">NJT egress</th>
              <th className="px-3 py-2">Egress time</th>
              <th className="px-3 py-2">American Dream peds</th>
              <th className="px-3 py-2">Evidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {matchData.map((row) => (
              <tr
                key={row.matchNo}
                className={row.matchNo === 104 ? "bg-blue-50/60 dark:bg-blue-950/30" : ""}
              >
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                  {row.matchNo === "Plan" ? "Plan" : `#${row.matchNo}`}
                  <div className="text-xs font-normal text-slate-400">
                    {row.fixture}
                  </div>
                </td>
                <td className="px-3 py-2">{formatInt(row.ticketHolders)}</td>
                <td className="px-3 py-2">{formatInt(row.uberCount)}</td>
                <td className="px-3 py-2">{formatInt(row.hostShuttles)}</td>
                <td className="px-3 py-2">{formatInt(row.njtEgress)}</td>
                <td className="px-3 py-2">{row.njtEgressMin} min</td>
                <td className="px-3 py-2">
                  {formatInt(row.americanDreamPedestrians)}
                </td>
                <td className="px-3 py-2">
                  <EvidenceBadge
                    evidenceClass={row.evidenceClass}
                    sourceUrl={row.sourceUrl}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AnalogEventsSection({
  events,
}: {
  events: import("@/lib/types").AnalogEventRecord[];
}) {
  if (events.length === 0) return null;
  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Analog events
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Comparable past events at the same venue, used as planning proxies —
        never as a direct forecast of World Cup demand.
      </p>
      <ul className="mt-3 space-y-2">
        {events.map((event) => (
          <li
            key={event.analogEventId}
            className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium text-slate-800 dark:text-slate-200">
                {event.event} — {event.venue}
              </p>
              <span className="text-xs text-slate-400">{event.dateOrPeriod}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {formatInt(event.totalAttendance)} total attendance ·{" "}
              {event.transitBoardings !== null
                ? `${formatInt(event.transitBoardings)} transit boardings`
                : "transit boardings not reported"}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {event.qualifier}
            </p>
            <div className="mt-2">
              <EvidenceBadge
                evidenceClass={event.evidenceClass}
                sourceUrl={event.attendanceSourceUrl}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EvidenceMetricsSection({
  title,
  records,
}: {
  title: string;
  records: {
    id: string;
    metric: string;
    value: string;
    qualifier: string;
    evidenceClass: string;
    sourceUrl: string;
  }[];
}) {
  if (records.length === 0) return null;
  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {records.map((record) => (
          <li
            key={record.id}
            className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {record.metric}
            </p>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {record.value}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {record.qualifier}
            </p>
            <div className="mt-2">
              <EvidenceBadge
                evidenceClass={record.evidenceClass}
                sourceUrl={record.sourceUrl}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PedestrianAreasSection({
  areas,
}: {
  areas: import("@/lib/types").PedestrianAreaRecord[];
}) {
  if (areas.length === 0) return null;
  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Pedestrian areas
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Planning anchors, not surveyed locations — coordinates mark a named
        access node at the given spatial precision.
      </p>
      <ul className="mt-3 space-y-2">
        {areas.map((area) => (
          <li
            key={area.areaId}
            className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="font-medium text-slate-800 dark:text-slate-200">
              {area.exactAreaName}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {formatInt(area.areaDesignPedestrians)} design pedestrians (
              {formatPercent(area.areaShare, 0)} of city total) ·{" "}
              {area.spatialPrecision}
            </p>
            <div className="mt-2">
              <EvidenceBadge
                evidenceClass={area.evidenceClass}
                sourceUrl={area.sourceUrl}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProjectsSection({
  projects,
  legacyProjects,
}: {
  projects: import("@/lib/types").Project3D[];
  legacyProjects: import("@/lib/types").LegacyProject[];
}) {
  const rendered = projects.filter((p) => p.renderEnabled === "Yes");
  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Modeled projects
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {rendered.length} of {projects.length} canonical project records are
        funded (allocation &gt; 0). All are{" "}
        <code className="text-xs">concept_only</code> proposals on
        conceptual planning anchors — the interactive map arrives in a later
        phase.
        {legacyProjects.length > 0 &&
          ` ${legacyProjects.length} richer narrative "legacy" project descriptions are also on file for this hero scenario.`}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rendered.map((project) => (
          <div
            key={project.projectId}
            className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="font-mono text-xs text-slate-400">
              {project.projectId}
            </p>
            <p className="font-medium text-slate-800 dark:text-slate-200">
              {project.categoryName} ({project.phase})
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              {formatCents(project.allocationCents)}
            </p>
            <div className="mt-2">
              <EvidenceBadge
                evidenceClass={project.evidenceClass}
                sourceUrl={project.sourceUrl}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
