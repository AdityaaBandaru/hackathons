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
    <div className="space-y-3.5">
      {WEIGHT_LABELS.map(({ key, label, help }) => {
        const value = weights[key];
        const share = sum > 0 ? value / sum : 0;
        return (
          <div key={key}>
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor={`weight-${key}`} className="text-[13px] text-fg">
                {label}
              </label>
              <span className="flex items-baseline gap-2 text-[11px] text-fg-subtle">
                <span className="hidden sm:inline">{help}</span>
                <span className="w-10 text-right font-mono tabular-nums text-fg-muted">
                  {value.toFixed(2)}
                </span>
              </span>
            </div>
            <input
              id={`weight-${key}`}
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={value}
              onChange={(e) =>
                onChange({ ...weights, [key]: Number(e.target.value) })
              }
              className="slider mt-0.5"
              style={{ "--fill": `${value * 100}%` } as React.CSSProperties}
            />
            {/* Normalized share, the number the solver actually sees. */}
            <div className="-mt-1 h-0.5 overflow-hidden rounded-full bg-transparent">
              <div
                className="h-full rounded-full bg-accent-fg/40 transition-[width] duration-300 ease-[var(--ease-out-quint)]"
                style={{ width: `${share * 100}%` }}
              />
            </div>
          </div>
        );
      })}
      <p className="text-[11px] leading-relaxed text-fg-subtle">
        Raw sum {sum.toFixed(2)}. Weights are normalized to 1.0 on the
        server — their scale here does not matter, only their ratios (thin
        bar = normalized share).
      </p>
    </div>
  );
}
