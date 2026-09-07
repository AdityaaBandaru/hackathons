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
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked ? 0.5 : null)}
        className="h-4 w-4 accent-blue-600"
      />
      <label className="w-48 text-sm text-slate-700 dark:text-slate-300">
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
        className="flex-1 accent-blue-600 disabled:opacity-30"
      />
      <span className="w-12 text-right text-xs text-slate-500 dark:text-slate-400">
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

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.maximumMajorConstructionProjects !== null}
          onChange={(e) =>
            onChange({
              ...form,
              maximumMajorConstructionProjects: e.target.checked ? 4 : null,
            })
          }
          className="h-4 w-4 accent-blue-600"
        />
        <label className="w-48 text-sm text-slate-700 dark:text-slate-300">
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
          className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-30 dark:border-slate-700 dark:bg-slate-900"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Required interventions
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {interventions.map((iv) => (
              <button
                key={iv.category}
                type="button"
                onClick={() => toggleId("requiredInterventionIds", iv.category)}
                disabled={form.excludedInterventionIds.includes(iv.category)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset disabled:opacity-30 ${
                  form.requiredInterventionIds.includes(iv.category)
                    ? "bg-emerald-600 text-white ring-emerald-600"
                    : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700"
                }`}
              >
                {iv.categoryName}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Excluded interventions
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {interventions.map((iv) => (
              <button
                key={iv.category}
                type="button"
                onClick={() => toggleId("excludedInterventionIds", iv.category)}
                disabled={form.requiredInterventionIds.includes(iv.category)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset disabled:opacity-30 ${
                  form.excludedInterventionIds.includes(iv.category)
                    ? "bg-red-600 text-white ring-red-600"
                    : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700"
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
