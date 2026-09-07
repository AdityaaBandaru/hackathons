"use client";

import type { OptimizeWeights } from "@/lib/types";

const WEIGHT_LABELS: { key: keyof OptimizeWeights; label: string; help: string }[] = [
  { key: "travelTime", label: "Travel time", help: "Passenger-minutes saved" },
  { key: "vehicleCongestion", label: "Vehicle congestion", help: "Vehicle-hours avoided" },
  { key: "emissions", label: "Emissions", help: "CO₂ tonnes avoided" },
  { key: "accessibility", label: "Accessibility", help: "Accessible trips improved" },
  { key: "reliability", label: "Reliability", help: "Overload-risk reduction" },
  { key: "permanentLegacy", label: "Permanent legacy", help: "Long-life permanent value" },
];

/**
 * Raw slider values are sent to the backend unnormalized -- the backend
 * normalizes weights server-side (POST /api/v1/optimize), so the frontend
 * deliberately does not pre-normalize here.
 */
export function WeightSliders({
  weights,
  onChange,
}: {
  weights: OptimizeWeights;
  onChange: (weights: OptimizeWeights) => void;
}) {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-3">
      {WEIGHT_LABELS.map(({ key, label, help }) => (
        <div key={key}>
          <div className="flex items-baseline justify-between">
            <label htmlFor={`weight-${key}`} className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {label}
            </label>
            <span className="text-xs text-slate-400">
              {help} · {weights[key].toFixed(2)}
            </span>
          </div>
          <input
            id={`weight-${key}`}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={weights[key]}
            onChange={(e) =>
              onChange({ ...weights, [key]: Number(e.target.value) })
            }
            className="mt-1 w-full accent-blue-600"
          />
        </div>
      ))}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Raw sum: {sum.toFixed(2)}. Weights are normalized to 1.0 on the
        server — their scale here does not matter, only their ratios.
      </p>
    </div>
  );
}
