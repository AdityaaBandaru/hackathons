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
    <div className="space-y-12">
      <header className="reveal">
        <Link href="/compare" className="link text-xs">
          ← Back to comparison
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="display text-3xl text-fg sm:text-4xl">{city.hostRegion}</h1>
          {cityId === "nynj" && (
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-fg">
              Hero scenario
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-fg-muted">
          {city.dominantBottleneck} · {city.venueAccessType}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          <h2 className="text-lg font-semibold tracking-tight text-fg">
            Match-day after-action data
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">
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
    <div className="metric reveal" style={{ "--i": 1 } as React.CSSProperties}>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
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
      <h2 className="text-lg font-semibold tracking-tight text-fg">
        Funding by intervention category
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-fg-muted">
        How the official budget is modeled as split across the 12 intervention
        categories plus reserve. Every allocation is an engineering
        assumption about how to spend an official total, not itself an
        observed expenditure.
      </p>
      <div className="table-wrap mt-4">
        <table className="table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Units</th>
              <th>Allocation</th>
              <th>Temp / Perm</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {funding.map((row) => (
              <tr key={row.category}>
                <td className="whitespace-nowrap font-medium text-fg">
                  {row.categoryName}
                  <div className="text-xs font-normal text-fg-subtle">
                    {row.decisionUnit}
                  </div>
                </td>
                <td className="tabular-nums">{row.selectedUnits}</td>
                <td className="tabular-nums text-fg">
                  {formatCents(row.modeledCategoryAllocationCents)}
                </td>
                <td className="text-xs tabular-nums text-fg-subtle">
                  {formatCents(row.temporaryAllocationCents)} /{" "}
                  {formatCents(row.permanentAllocationCents)}
                </td>
                <td>
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
      <h2 className="text-lg font-semibold tracking-tight text-fg">
        Match-day after-action data
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-fg-muted">
        NJ Transit&apos;s after-action report for MetLife Stadium — the
        &quot;Plan&quot; row is the pre-tournament operational plan; every
        other row is an observed final match record.
      </p>
      <div className="table-wrap mt-4">
        <table className="table">
          <thead>
            <tr>
              <th>Match</th>
              <th>Ticket holders</th>
              <th>Uber</th>
              <th>Host shuttles</th>
              <th>NJT egress</th>
              <th>Egress time</th>
              <th>American Dream peds</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {matchData.map((row) => (
              <tr
                key={row.matchNo}
                className={row.matchNo === 104 ? "is-hero" : undefined}
              >
                <td className="whitespace-nowrap font-medium text-fg">
                  {row.matchNo === "Plan" ? "Plan" : `#${row.matchNo}`}
                  <div className="text-xs font-normal text-fg-subtle">
                    {row.fixture}
                  </div>
                </td>
                <td className="tabular-nums">{formatInt(row.ticketHolders)}</td>
                <td className="tabular-nums">{formatInt(row.uberCount)}</td>
                <td className="tabular-nums">{formatInt(row.hostShuttles)}</td>
                <td className="tabular-nums">{formatInt(row.njtEgress)}</td>
                <td className="tabular-nums">{row.njtEgressMin} min</td>
                <td className="tabular-nums">
                  {formatInt(row.americanDreamPedestrians)}
                </td>
                <td>
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
      <h2 className="text-lg font-semibold tracking-tight text-fg">
        Analog events
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-fg-muted">
        Comparable past events at the same venue, used as planning proxies —
        never as a direct forecast of World Cup demand.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {events.map((event, i) => (
          <li
            key={event.analogEventId}
            className="card card-interactive reveal p-4"
            style={{ "--i": i } as React.CSSProperties}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-fg">
                {event.event} — {event.venue}
              </p>
              <span className="font-mono text-[11px] text-fg-subtle">{event.dateOrPeriod}</span>
            </div>
            <p className="mt-1 text-sm tabular-nums text-fg-muted">
              {formatInt(event.totalAttendance)} total attendance ·{" "}
              {event.transitBoardings !== null
                ? `${formatInt(event.transitBoardings)} transit boardings`
                : "transit boardings not reported"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-fg-subtle">
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
      <h2 className="text-lg font-semibold tracking-tight text-fg">
        {title}
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {records.map((record, i) => (
          <li
            key={record.id}
            className="card card-interactive reveal p-4"
            style={{ "--i": i } as React.CSSProperties}
          >
            <p className="text-[13px] font-medium text-fg-muted">{record.metric}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-fg">
              {record.value}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-fg-subtle">
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
      <h2 className="text-lg font-semibold tracking-tight text-fg">
        Pedestrian areas
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-fg-muted">
        Planning anchors, not surveyed locations — coordinates mark a named
        access node at the given spatial precision.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {areas.map((area, i) => (
          <li
            key={area.areaId}
            className="card card-interactive reveal p-4"
            style={{ "--i": i } as React.CSSProperties}
          >
            <p className="text-sm font-medium text-fg">{area.exactAreaName}</p>
            <p className="mt-1 text-sm tabular-nums text-fg-muted">
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
      <h2 className="text-lg font-semibold tracking-tight text-fg">
        Modeled projects
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-fg-muted">
        {rendered.length} of {projects.length} canonical project records are
        funded (allocation &gt; 0). All are{" "}
        <code className="rounded bg-surface-2 px-1 py-0.5 text-[11px] text-fg">concept_only</code> proposals on
        conceptual planning anchors — the interactive map arrives in a later
        phase.
        {legacyProjects.length > 0 &&
          ` ${legacyProjects.length} richer narrative "legacy" project descriptions are also on file for this hero scenario.`}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rendered.map((project, i) => (
          <div
            key={project.projectId}
            className="card card-interactive reveal p-4 text-sm"
            style={{ "--i": i } as React.CSSProperties}
          >
            <p className="font-mono text-[11px] text-fg-subtle">{project.projectId}</p>
            <p className="mt-1 font-medium text-fg">
              {project.categoryName}{" "}
              <span className="font-normal capitalize text-fg-subtle">· {project.phase}</span>
            </p>
            <p className="mt-0.5 tabular-nums text-fg-muted">
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
