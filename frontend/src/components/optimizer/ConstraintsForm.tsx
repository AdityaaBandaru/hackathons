"use client";

import type { Intervention, OptimizeConstraints } from "@/lib/types";

/** Local form representation: shares as 0-100 for the UI, converted at submit time. */
export interface ConstraintsFormState {
  minimumAccessibilityShare: number | null;
  maximumTemporaryShare: number | null;
  minimumPermanentShare: number | null;
  maximumMajorConstructionProjects: number | null;
  requiredInterventionIds: string[];
  excludedInterventionIds: string[];
}

export function constraintsFormToRequest(
  form: ConstraintsFormState,
): OptimizeConstraints {
  return {
    minimumAccessibilityShare: form.minimumAccessibilityShare,
    maximumTemporaryShare: form.maximumTemporaryShare,
    minimumPermanentShare: form.minimumPermanentShare,
    maximumMajorConstructionProjects: form.maximumMajorConstructionProjects,
    requiredInterventionIds: form.requiredInterventionIds,
    excludedInterventionIds: form.excludedInterventionIds,
  };
}

function SharePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const enabled = value !== null;
  return (
    <div className="flex items-center gap-3">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked ? 0.5 : null)}
        className="checkbox"
        aria-label={`Enable ${label}`}
      />
      <label
        className={`w-40 text-[13px] transition-colors ${enabled ? "text-fg" : "text-fg-subtle"}`}
      >
        {label}
      </label>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        disabled={!enabled}
        value={value ?? 0.5}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider flex-1"
        style={{ "--fill": `${(value ?? 0.5) * 100}%` } as React.CSSProperties}
      />
      <span className="w-10 text-right font-mono text-[11px] tabular-nums text-fg-muted">
        {enabled ? `${Math.round((value ?? 0) * 100)}%` : "off"}
      </span>
    </div>
  );
}

export function ConstraintsForm({
  form,
  onChange,
  interventions,
}: {
  form: ConstraintsFormState;
  onChange: (form: ConstraintsFormState) => void;
  interventions: Intervention[];
}) {
  function toggleId(field: "requiredInterventionIds" | "excludedInterventionIds", id: string) {
    const current = form[field];
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    onChange({ ...form, [field]: next });
  }

  return (
    <div className="space-y-4">
      <SharePicker
        label="Min. accessibility share"
        value={form.minimumAccessibilityShare}
        onChange={(v) => onChange({ ...form, minimumAccessibilityShare: v })}
      />
      <SharePicker
        label="Max. temporary share"
        value={form.maximumTemporaryShare}
        onChange={(v) => onChange({ ...form, maximumTemporaryShare: v })}
      />
      <SharePicker
        label="Min. permanent share"
        value={form.minimumPermanentShare}
        onChange={(v) => onChange({ ...form, minimumPermanentShare: v })}
      />

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={form.maximumMajorConstructionProjects !== null}
          onChange={(e) =>
            onChange({
              ...form,
              maximumMajorConstructionProjects: e.target.checked ? 4 : null,
            })
          }
          className="checkbox"
          aria-label="Enable max. major-construction projects"
        />
        <label
          className={`flex-1 text-[13px] transition-colors ${
            form.maximumMajorConstructionProjects !== null ? "text-fg" : "text-fg-subtle"
          }`}
        >
          Max. major-construction projects
        </label>
        <input
          type="number"
          min={0}
          disabled={form.maximumMajorConstructionProjects === null}
          value={form.maximumMajorConstructionProjects ?? 0}
          onChange={(e) =>
            onChange({
              ...form,
              maximumMajorConstructionProjects: Number(e.target.value),
            })
          }
          className="field h-8 w-20 px-2 text-center tabular-nums"
        />
      </div>

      <div className="grid gap-4">
        <div>
          <p className="text-[13px] font-medium text-fg">Required interventions</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {interventions.map((iv) => (
              <button
                key={iv.category}
                type="button"
                onClick={() => toggleId("requiredInterventionIds", iv.category)}
                disabled={form.excludedInterventionIds.includes(iv.category)}
                aria-pressed={form.requiredInterventionIds.includes(iv.category)}
                className={`chip ${
                  form.requiredInterventionIds.includes(iv.category) ? "chip-on-ok" : ""
                }`}
              >
                {iv.categoryName}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[13px] font-medium text-fg">Excluded interventions</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {interventions.map((iv) => (
              <button
                key={iv.category}
                type="button"
                onClick={() => toggleId("excludedInterventionIds", iv.category)}
                disabled={form.requiredInterventionIds.includes(iv.category)}
                aria-pressed={form.excludedInterventionIds.includes(iv.category)}
                className={`chip ${
                  form.excludedInterventionIds.includes(iv.category) ? "chip-on-danger" : ""
                }`}
              >
                {iv.categoryName}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
