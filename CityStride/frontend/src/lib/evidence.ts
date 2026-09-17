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

/** Translucent tints on the dark canvas; text stays >= 4.5:1 on every tone. */
export const EVIDENCE_TONE_CLASSES: Record<EvidenceTone, string> = {
  observed: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30",
  official: "bg-sky-400/10 text-sky-300 ring-sky-400/30",
  model: "bg-purple-400/10 text-purple-300 ring-purple-400/30",
  assumption: "bg-amber-400/10 text-amber-300 ring-amber-400/30",
  derived: "bg-white/[0.06] text-fg-muted ring-white/15",
  other: "bg-white/[0.06] text-fg-muted ring-white/15",
};

/** A matching dot colour per tone, for the badge's leading marker. */
export const EVIDENCE_TONE_DOT: Record<EvidenceTone, string> = {
  observed: "bg-emerald-400",
  official: "bg-sky-400",
  model: "bg-purple-400",
  assumption: "bg-amber-400",
  derived: "bg-fg-subtle",
  other: "bg-fg-subtle",
};
