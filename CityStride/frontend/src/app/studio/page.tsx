"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getCities, getCityProjects } from "@/lib/api";
import { useScenario } from "@/lib/scenario";
import { MAP_MODES, MAP_MODE_LABELS, isScenarioDependent, resolveMapSelection, type MapMode } from "@/lib/mapModes";
import { displayProjects, studioDimensions, studioProjects, STUDIO_DISCLOSURE, type StudioPhase } from "@/lib/studio";
import { formatCents, formatInt } from "@/lib/format";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { LoadingBlock, ErrorBlock } from "@/components/StatusStates";

const Scene = dynamic(() => import("@/components/map/ProjectStudioScene").then((module) => module.ProjectStudioScene), {
  ssr: false,
  loading: () => <div className="studio-scene-loading" role="status">Preparing the 3D model…</div>,
});

const PHASES: { id: StudioPhase; label: string }[] = [
  { id: "temporary", label: "Temporary" },
  { id: "permanent", label: "Permanent" },
  { id: "compare", label: "Compare both" },
];

export default function StudioPage() {
  const { scenario } = useScenario();
  const [cityId, setCityId] = useState(scenario?.cityId ?? "nynj");
  const [mode, setMode] = useState<MapMode>(scenario ? "selectedLegacy" : "allPossibilities");
  const [category, setCategory] = useState("station");
  const [phase, setPhase] = useState<StudioPhase>("permanent");
  const citiesQuery = useQuery({ queryKey: ["cities"], queryFn: getCities });
  const projectsQuery = useQuery({ queryKey: ["cityProjects", cityId], queryFn: () => getCityProjects(cityId) });
  const available = useMemo(() => studioProjects(projectsQuery.data?.projects ?? [], scenario?.cityId === cityId ? scenario.selectedProjects : null, mode), [projectsQuery.data, scenario, cityId, mode]);
  const categories = useMemo(() => [...new Map((projectsQuery.data?.projects ?? []).map((project) => [project.category, project.categoryName])).entries()], [projectsQuery.data]);
  // The chosen category/phase fall back to whatever the scenario still
  // permits, so a selection made in one mode never points at a project the
  // next mode hides. Resolved together so `models` keeps a stable identity
  // for the scene's rebuild effect.
  const { activeCategory, categoryProjects, activePhase, models } = useMemo(() => {
    const activeCategory = available.some((project) => project.category === category)
      ? category
      : (available[0]?.category ?? category);
    const categoryProjects = available.filter((project) => project.category === activeCategory);
    const activePhase: StudioPhase =
      phase === "compare" && categoryProjects.length > 1
        ? "compare"
        : categoryProjects.some((project) => project.phase === phase)
          ? phase
          : (categoryProjects[0]?.phase ?? phase);
    return {
      activeCategory,
      categoryProjects,
      activePhase,
      models: displayProjects(available, activeCategory, activePhase),
    };
  }, [available, category, phase]);
  const selectedIds = new Set(resolveMapSelection(mode, scenario?.cityId === cityId ? scenario.selectedProjects : null, available.map((p) => p.projectId)).selectedIds);
  const cityName = projectsQuery.data?.hostRegion ?? "Host region";
  const categoryName = categories.find(([id]) => id === activeCategory)?.[1];

  if (projectsQuery.isPending || citiesQuery.isPending) return <LoadingBlock label="Loading 3D design studio…" />;
  if (projectsQuery.isError || citiesQuery.isError) return <ErrorBlock
    message={(projectsQuery.error ?? citiesQuery.error)?.message ?? "Could not load project models."}
    onRetry={() => { projectsQuery.refetch(); citiesQuery.refetch(); }}
  />;

  return (
    <div className="studio-page">
      <header className="studio-header reveal">
        <div>
          <p className="studio-eyebrow">WORLD CUP 2026 <span>/</span> MOBILITY &amp; LEGACY</p>
          <h1>3D design studio<span className="studio-title-dot">.</span></h1>
          <p className="studio-intro">Explore the investments. See what stays after the tournament.</p>
        </div>
        <div className="studio-header-actions">
          <label htmlFor="studio-city">Host region</label>
          <select id="studio-city" value={cityId} onChange={(event) => setCityId(event.target.value)}>
            {citiesQuery.data?.map((city) => <option key={city.cityId} value={city.cityId}>{city.hostRegion}</option>)}
          </select>
          <Link href="/optimize" className="link">Adjust investment plan ↗</Link>
        </div>
      </header>

      <div className="studio-scope reveal" style={{ "--i": 1 } as React.CSSProperties}>
        <div role="group" aria-label="Studio display mode">
          {MAP_MODES.map((value) => <button key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{MAP_MODE_LABELS[value]}</button>)}
        </div>
        <p>{mode === "allPossibilities" ? "Exploring candidate designs" : mode === "baseline" ? "No proposed works" : "Current optimizer selection"}</p>
      </div>

      <div className="studio-workspace reveal" style={{ "--i": 2 } as React.CSSProperties}>
        <aside className="studio-projects" aria-label="Project categories">
          <div className="studio-projects-heading"><h2>Interventions</h2><span>{categories.length}</span></div>
          <p>{cityName}</p>
          <div className="studio-project-list">
            {categories.map(([id, name], index) => {
              const enabled = available.some((project) => project.category === id);
              return <button key={id} disabled={!enabled} aria-pressed={enabled && id === activeCategory} onClick={() => setCategory(id)}>
                <span className="studio-project-number">{String(index + 1).padStart(2, "0")}</span>
                <span>{name}</span>
                <span className="studio-project-arrow" aria-hidden="true">↗</span>
              </button>;
            })}
          </div>
          <div className="studio-selection-note">
            <span className="studio-small-label">DESIGN LIBRARY</span>
            <strong>{available.length} available concepts</strong>
            <p>A concept is selected only when it appears in the current optimizer result.</p>
          </div>
        </aside>

        <section className="studio-model-panel" aria-label="3D project viewer">
          <div className="studio-model-header">
            <div><p className="studio-small-label">{mode === "baseline" ? "EXISTING CONDITIONS" : "PROJECT STUDY"}</p><h2>{models.length ? categoryName : "No proposed works to display"}</h2></div>
            <div className="studio-phase-switch" role="group" aria-label="Design phase">
              {PHASES.map((option) => {
                const enabled = option.id === "compare" ? categoryProjects.length > 1 : categoryProjects.some((project) => project.phase === option.id);
                return <button key={option.id} disabled={!enabled} aria-pressed={models.length > 0 && activePhase === option.id} onClick={() => setPhase(option.id)}>{option.label}</button>;
              })}
            </div>
          </div>
          {models.length ? (
            <>
              <Scene projects={models} />
              <div className={`studio-model-facts ${models.length > 1 ? "studio-facts-pair" : ""}`}>
                {models.map((project) => {
                  const dimension = studioDimensions(project);
                  return <div key={project.projectId} className={`studio-model-fact ${project.phase}`} data-testid="studio-model-summary">
                    <div className="studio-fact-top"><h3>{project.phase === "permanent" ? "Permanent legacy" : "Temporary operations"}</h3><span>{selectedIds.has(project.projectId) ? "Selected" : "Candidate"}</span></div>
                    <p className="studio-project-id">{project.projectId}</p>
                    <dl className="studio-dimension-grid">
                      <div><dt>Length</dt><dd>{formatInt(project.lengthM)} <span>m</span></dd></div>
                      <div><dt>Width</dt><dd>{project.widthM} <span>m</span></dd></div>
                      <div><dt>Height</dt><dd>{project.heightM} <span>m</span></dd></div>
                    </dl>
                    {dimension.isSection && <p className="studio-section-note">Showing an {dimension.length} m detail of the {formatInt(project.lengthM)} m concept corridor.</p>}
                  </div>;
                })}
              </div>
            </>
          ) : <div className="studio-empty" role="status">
            <div className="studio-empty-symbol" aria-hidden="true">∅</div>
            <h3>{mode === "baseline" ? "The baseline contains no modeled proposals." : "No matching projects in this scenario."}</h3>
            <p>{mode === "baseline" ? "Use All Possibilities to inspect candidate designs, or a scenario mode to see the optimizer’s selections."
              : isScenarioDependent(mode) && (!scenario || scenario.cityId !== cityId) ? `Run an investment scenario for ${cityName} to see its selected projects here.`
              : "The optimizer did not select a project for this phase. All Possibilities shows the available candidates."}</p>
            <Link href="/optimize" className="btn btn-primary btn-sm">Run the optimizer</Link>
          </div>}
        </section>
      </div>

      {models.length > 0 && <section className="studio-detail-grid" aria-label="Design comparison and evidence">
        {models.map((project) => {
          const allocation = (scenario?.cityId === cityId ? scenario : null)?.selectedProjects.find((selected) => selected.projectId === project.projectId);
          return <article key={project.projectId} className="studio-detail-card">
            <p className="studio-small-label">{project.phase === "permanent" ? "AFTER THE TOURNAMENT" : "DURING THE TOURNAMENT"}</p>
            <h2>{project.phase === "permanent" ? "What remains" : "What serves the event"}</h2>
            <p className="studio-design-description">{project.designDescription}</p>
            <div className="studio-allocation"><div><span>{allocation ? "Current scenario allocation" : "Seeded demonstration allocation"}</span><strong>{formatCents(allocation ? allocation.allocationCents : project.allocationCents)}</strong></div><EvidenceBadge evidenceClass={allocation ? scenario!.evidenceClass : project.evidenceClass} sourceUrl={project.sourceUrl} /></div>
            {allocation && <p className="studio-allocation-basis">{allocation.units} × {allocation.decisionUnit}. The 3D asset illustrates one concept envelope; it does not multiply the geometry by funded units.</p>}
            <p className="text-xs text-fg-subtle"><code>{project.implementationStatus}</code> · {project.evidenceClass}</p>
            <div className="studio-location"><span>Planning anchor</span><p>{project.exactAreaName}</p><small>{project.spatialPrecision}</small></div>
            <a className="studio-source link" href={project.sourceUrl} target="_blank" rel="noreferrer">View source ↗</a>
          </article>;
        })}
      </section>}
      <details className="studio-methodology">
        <summary>How to read these models</summary>
        <p>{STUDIO_DISCLOSURE}</p>
        <p>In a comparison, the temporary model is on the left and the permanent model is on the right, at the same scale. The blue and amber accents identify phases. Exported GLB models retain the project ID, evidence class, source and dimension metadata.</p>
        <p>The studio isolates each design on a studio base so its form and dimensions are readable; it does not place designs geographically.</p>
      </details>
    </div>
  );
}
