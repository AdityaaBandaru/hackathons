"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import type { FeatureCollection } from "geojson";
import { getCityProjects } from "@/lib/api";
import { useScenario } from "@/lib/scenario";
import {
  MAP_MODES,
  MAP_MODE_DESCRIPTIONS,
  MAP_MODE_LABELS,
  isScenarioDependent,
  resolveMapSelection,
  type MapMode,
} from "@/lib/mapModes";
import {
  MAP_VIEWS,
  MAP_VIEW_DESCRIPTIONS,
  MAP_VIEW_LABELS,
  THREE_D_MODEL_ASSUMPTIONS,
  type MapView,
} from "@/lib/map3d";
import { LoadingBlock, ErrorBlock } from "@/components/StatusStates";
import { ProjectCard } from "@/components/map/ProjectCard";
import { formatCents } from "@/lib/format";

// MapLibre touches window/WebGL, so it only ever loads in the browser.
const ProjectMap = dynamic(
  () => import("@/components/map/ProjectMap").then((m) => m.ProjectMap),
  {
    ssr: false,
    loading: () => <LoadingBlock label="Loading map…" />,
  },
);

const GEOJSON_URL = "/geojson/nynj_projects.geojson";
const MAP_CITY_ID = "nynj";

async function fetchProjectGeometry(): Promise<FeatureCollection> {
  const response = await fetch(GEOJSON_URL);
  if (!response.ok) {
    throw new Error(`could not load project geometry (${response.status})`);
  }
  return (await response.json()) as FeatureCollection;
}

export default function MapPage() {
  // "All Possibilities" is the default because it is the only mode that shows
  // the full option space without asserting that anything was chosen.
  const [mode, setMode] = useState<MapMode>("allPossibilities");
  // The perspective toggle is deliberately separate from the four display
  // modes: both views honour all four identically.
  const [view, setView] = useState<MapView>("flat");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const { scenario } = useScenario();

  const geometryQuery = useQuery({
    queryKey: ["projectGeometry", MAP_CITY_ID],
    queryFn: fetchProjectGeometry,
    staleTime: Infinity,
  });

  // Same query key the city evidence page uses, so both read one cache entry
  // and cannot disagree about a project's attributes.
  const projectsQuery = useQuery({
    queryKey: ["cityProjects", MAP_CITY_ID],
    queryFn: () => getCityProjects(MAP_CITY_ID),
  });

  const candidateIds = useMemo(
    () =>
      (geometryQuery.data?.features ?? [])
        .map((feature) => feature.properties?.project_id)
        .filter((id): id is string => typeof id === "string"),
    [geometryQuery.data],
  );

  const selection = useMemo(
    () =>
      resolveMapSelection(mode, scenario?.selectedProjects ?? null, candidateIds),
    [mode, scenario, candidateIds],
  );

  // In "allPossibilities" mode a highlighted project appears in both
  // selectedIds and candidateIds (it's drawn as a candidate, with the
  // selected styling layered on top) -- dedupe here so it's listed once,
  // as "selected" (DrawnInspector's role lookup checks selectedIds first).
  const drawnIds = useMemo(
    () => [...new Set([...selection.selectedIds, ...selection.candidateIds])],
    [selection],
  );

  const projectsById = useMemo(() => {
    const map = new Map<string, (typeof projects)[number]>();
    const projects = projectsQuery.data?.projects ?? [];
    for (const project of projects) map.set(project.projectId, project);
    return map;
  }, [projectsQuery.data]);

  const activeProject = activeProjectId
    ? projectsById.get(activeProjectId)
    : undefined;

  const scenarioIsForAnotherCity =
    scenario !== null && scenario.cityId !== MAP_CITY_ID;

  if (geometryQuery.isPending || projectsQuery.isPending) {
    return <LoadingBlock label="Loading Meadowlands project geometry…" />;
  }
  if (geometryQuery.isError || projectsQuery.isError) {
    const error = geometryQuery.error ?? projectsQuery.error;
    return (
      <ErrorBlock
        message={error instanceof Error ? error.message : "Failed to load the map."}
        onRetry={() => {
          geometryQuery.refetch();
          projectsQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="reveal">
        <p className="eyebrow">New York / New Jersey</p>
        <h1 className="display mt-2 text-3xl text-fg sm:text-4xl">
          Meadowlands project map
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-muted">
          The {candidateIds.length} candidate projects for the New York/New
          Jersey host region, drawn from the pre-generated planning geometry.
          Coordinates are conceptual planning anchors, not surveyed locations,
          and every project shown is a{" "}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-[11px] text-fg">concept_only</code>{" "}
          proposal.
        </p>
      </header>

      <div
        className="reveal flex flex-wrap items-center justify-between gap-3"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <ModeSwitcher mode={mode} onChange={setMode} />
        <ViewSwitcher view={view} onChange={setView} />
      </div>

      {isScenarioDependent(mode) && !scenario && (
        <div role="status" className="panel-note note-warn animate-scale-in">
          <p className="font-semibold text-fg">No optimizer scenario has been run yet.</p>
          <p className="mt-1 text-[13px] opacity-90">
            This mode draws only what the optimizer selected, and there is
            nothing to draw until it runs. Nothing is assumed or filled in.{" "}
            <Link href="/optimize" className="link">
              Run the optimizer
            </Link>{" "}
            and come back.
          </p>
        </div>
      )}

      {isScenarioDependent(mode) && scenarioIsForAnotherCity && (
        <div role="status" className="panel-note note-warn animate-scale-in">
          The current scenario is for {scenario.hostRegion}, but this map shows
          New York/New Jersey. None of its selected projects have geometry here,
          so nothing is drawn as selected.
        </div>
      )}

      <div
        className="reveal grid gap-6 lg:grid-cols-[1fr_340px]"
        style={{ "--i": 2 } as React.CSSProperties}
      >
        <div>
          <ProjectMap
            geojson={geometryQuery.data}
            selection={selection}
            activeProjectId={activeProjectId}
            onSelectProject={setActiveProjectId}
            view={view}
          />
          <p className="mt-2 text-xs leading-relaxed text-fg-subtle">
            {MAP_MODE_DESCRIPTIONS[mode]} {MAP_VIEW_DESCRIPTIONS[view]} Click a
            project for detail.
          </p>
          {view === "threeD" && <ExtrusionAssumptions />}
        </div>

        <div className="space-y-4">
          {activeProject ? (
            <ProjectCard
              project={activeProject}
              scenario={scenario}
              isSelectedInScenario={selection.selectedIds.includes(
                activeProject.projectId,
              )}
              onClose={() => setActiveProjectId(null)}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-border-strong px-4 py-8 text-center text-sm text-fg-subtle">
              Click a project on the map to see its cost, evidence basis, and
              source.
            </p>
          )}

          <DrawnInspector
            mode={mode}
            selection={selection}
            drawnIds={drawnIds}
            projectsById={projectsById}
            onSelect={setActiveProjectId}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Flat vs. 3D. Two mutually exclusive presentations of the same selection, so
 * these are toggle buttons with aria-pressed rather than a radio group -- the
 * four display modes remain the radio group above.
 */
function ViewSwitcher({
  view,
  onChange,
}: {
  view: MapView;
  onChange: (view: MapView) => void;
}) {
  return (
    <div className="segmented">
      {MAP_VIEWS.map((candidate) => (
        <button
          key={candidate}
          type="button"
          aria-pressed={view === candidate}
          onClick={() => onChange(candidate)}
        >
          {MAP_VIEW_LABELS[candidate]}
        </button>
      ))}
    </div>
  );
}

/**
 * The 3D view's rendering assumptions, disclosed in the view itself.
 *
 * Extruding a project asserts a shape and a height, which is exactly the kind
 * of engineering assumption that has to be stated rather than implied
 * (CLAUDE.md rule 8) -- including, in particular, what this view does *not*
 * depict.
 */
function ExtrusionAssumptions() {
  return (
    <details className="panel-note note-model group mt-3 animate-fade-in text-xs">
      <summary className="cursor-pointer list-none font-semibold text-fg marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="mr-1.5 inline-block transition-transform duration-200 group-open:rotate-90">▸</span>
        How these volumes are drawn — and what they leave out
      </summary>
      <p className="mt-2 leading-relaxed opacity-90">{THREE_D_MODEL_ASSUMPTIONS.note}</p>
      <dl className="mt-3 space-y-2 leading-relaxed opacity-90">
        <div>
          <dt className="font-semibold text-fg">Height</dt>
          <dd>{THREE_D_MODEL_ASSUMPTIONS.heightSource}</dd>
        </div>
        <div>
          <dt className="font-semibold text-fg">Which projects extrude</dt>
          <dd>{THREE_D_MODEL_ASSUMPTIONS.extrusionRule}</dd>
        </div>
        <div>
          <dt className="font-semibold text-fg">Footprint</dt>
          <dd>{THREE_D_MODEL_ASSUMPTIONS.footprintSource}</dd>
        </div>
        <div>
          <dt className="font-semibold text-fg">Ground level</dt>
          <dd>{THREE_D_MODEL_ASSUMPTIONS.groundLevel}</dd>
        </div>
        <div>
          <dt className="font-semibold text-fg">Not represented</dt>
          <dd>
            <ul className="list-disc space-y-1 pl-4">
              {THREE_D_MODEL_ASSUMPTIONS.notRepresented.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-fg">Spatial precision</dt>
          <dd>{THREE_D_MODEL_ASSUMPTIONS.spatialPrecision}</dd>
        </div>
      </dl>
    </details>
  );
}

function ModeSwitcher({
  mode,
  onChange,
}: {
  mode: MapMode;
  onChange: (mode: MapMode) => void;
}) {
  const buttonRefs = useRef<Partial<Record<MapMode, HTMLButtonElement | null>>>(
    {},
  );

  // Roving tabindex + arrow-key movement, per the WAI-ARIA APG radio group
  // pattern -- this group already declares role="radiogroup"/"radio", so it
  // must behave like one: Tab enters/leaves the group at a single stop (the
  // checked option), and Left/Right/Up/Down move *and* select, same as a
  // native <input type="radio"> group.
  function moveTo(index: number) {
    const nextMode = MAP_MODES[(index + MAP_MODES.length) % MAP_MODES.length];
    onChange(nextMode);
    buttonRefs.current[nextMode]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = MAP_MODES.indexOf(mode);
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        moveTo(currentIndex + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        moveTo(currentIndex - 1);
        break;
      case "Home":
        event.preventDefault();
        moveTo(0);
        break;
      case "End":
        event.preventDefault();
        moveTo(MAP_MODES.length - 1);
        break;
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Map display mode"
      className="segmented flex-wrap"
    >
      {MAP_MODES.map((candidate) => (
        <button
          key={candidate}
          ref={(el) => {
            buttonRefs.current[candidate] = el;
          }}
          type="button"
          role="radio"
          aria-checked={mode === candidate}
          tabIndex={mode === candidate ? 0 : -1}
          onClick={() => onChange(candidate)}
          onKeyDown={handleKeyDown}
        >
          {MAP_MODE_LABELS[candidate]}
        </button>
      ))}
    </div>
  );
}

/**
 * A plain-DOM listing of exactly what the map is drawing, and in which role.
 * It doubles as the legend and as a way to read the map's state without a
 * WebGL canvas.
 */
function DrawnInspector({
  mode,
  selection,
  drawnIds,
  projectsById,
  onSelect,
}: {
  mode: MapMode;
  selection: ReturnType<typeof resolveMapSelection>;
  drawnIds: string[];
  projectsById: Map<string, import("@/lib/types").Project3D>;
  onSelect: (projectId: string) => void;
}) {
  return (
    <section
      aria-label="Projects drawn on the map"
      className="card p-4 text-sm"
    >
      <h2 className="font-semibold text-fg">Drawn on map</h2>
      <p className="mt-1 text-xs text-fg-subtle">
        <span data-testid="drawn-count">{drawnIds.length}</span> project(s) ·{" "}
        <span data-testid="selected-count">{selection.selectedIds.length}</span>{" "}
        selected ·{" "}
        <span data-testid="candidate-count">
          {selection.candidateIds.length}
        </span>{" "}
        translucent candidate(s)
      </p>

      {mode === "baseline" && (
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs text-fg-muted">
          Baseline hides every modeled proposal. Nothing on this map is a
          proposal right now.
        </p>
      )}

      {drawnIds.length > 0 && (
        <ul className="mt-3 max-h-[420px] space-y-0.5 overflow-y-auto pr-1" data-testid="drawn-list">
          {drawnIds.map((projectId) => {
            const project = projectsById.get(projectId);
            const isSelected = selection.selectedIds.includes(projectId);
            return (
              <li key={projectId}>
                <button
                  type="button"
                  onClick={() => onSelect(projectId)}
                  data-project-id={projectId}
                  data-role={isSelected ? "selected" : "candidate"}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.05]"
                >
                  <span className="truncate">
                    <span className="font-mono text-[11px] text-fg-subtle">
                      {projectId}
                    </span>
                    {project && (
                      <span className="ml-2 text-xs text-fg-muted">
                        {project.categoryName}
                      </span>
                    )}
                  </span>
                  <span
                    className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      isSelected
                        ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/30"
                        : "bg-white/[0.06] text-fg-subtle"
                    }`}
                  >
                    {isSelected ? "selected" : "candidate"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selection.selectedIds.length > 0 && (
        <p className="mt-3 border-t border-border pt-2 text-xs tabular-nums text-fg-subtle">
          Selected total:{" "}
          {formatCents(
            selection.selectedIds.reduce(
              (sum, id) => sum + (projectsById.get(id)?.allocationCents ?? 0),
              0,
            ),
          )}{" "}
          at the seeded allocations.
        </p>
      )}
    </section>
  );
}
