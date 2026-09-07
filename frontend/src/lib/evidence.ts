/**
 * Evidence-class presentation.
 *
 * The bundle's evidenceClass values are not a closed enum -- alongside the
 * canonical machine values (observed_final, official_plan,
 * engineering_assumption, model_output, ...) it also carries free-text
 * citations like "official NFL gamebook" or "local media citing venue"
 * (see reference/json/analogEvents.json). This buckets any of them into a
 * small set of visual tones without discarding or rewriting the original
 * string -- the raw value is always shown alongside the tone.
 */

export type EvidenceTone =
  | "observed"
  | "official"
  | "model"
  | "assumption"
  | "derived"
  | "other";

export interface EvidenceToneInfo {
  tone: EvidenceTone;
  label: string;
}

export function classifyEvidence(evidenceClass: string): EvidenceToneInfo {
  const value = evidenceClass.toLowerCase();
  if (value.includes("observed")) return { tone: "observed", label: "Observed" };
  if (value.includes("official")) return { tone: "official", label: "Official" };
  if (value.includes("model_output")) return { tone: "model", label: "Model output" };
  if (value.includes("engineering_assumption") || value.includes("assumption")) {
    return { tone: "assumption", label: "Engineering assumption" };
  }
  if (value.includes("derived") || value.includes("formula_residual")) {
    return { tone: "derived", label: "Derived" };
  }
  // Free-text citations (box scores, media reports, venue pages) -- shown
  // as-is rather than forced into a bucket that would misstate them.
  return { tone: "other", label: "Cited source" };
}

export const EVIDENCE_TONE_CLASSES: Record<EvidenceTone, string> = {
  observed: "bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-400/30",
  official: "bg-blue-50 text-blue-800 ring-blue-600/20 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-400/30",
  model: "bg-purple-50 text-purple-800 ring-purple-600/20 dark:bg-purple-950 dark:text-purple-300 dark:ring-purple-400/30",
  assumption: "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-400/30",
  derived: "bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-400/20",
  other: "bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-400/20",
};
