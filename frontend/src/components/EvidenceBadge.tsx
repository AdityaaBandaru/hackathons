import {
  classifyEvidence,
  EVIDENCE_TONE_CLASSES,
  EVIDENCE_TONE_DOT,
} from "@/lib/evidence";
import { External } from "@/components/ui/Icons";

/**
 * A small pill showing one evidenceClass string, plus an optional link to the
 * source it came from. Every number pulled from the API should sit next to
 * one of these -- the raw evidenceClass value is always shown verbatim, never
 * rewritten or summarised away.
 */
export function EvidenceBadge({
  evidenceClass,
  sourceUrl,
  qualifier,
}: {
  evidenceClass: string;
  sourceUrl?: string | null;
  qualifier?: string | null;
}) {
  const { tone, label } = classifyEvidence(evidenceClass);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
      <span
        title={qualifier ?? undefined}
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full py-0.5 pl-1.5 pr-2 text-[11px] font-medium ring-1 ring-inset ${EVIDENCE_TONE_CLASSES[tone]}`}
      >
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${EVIDENCE_TONE_DOT[tone]}`}
        />
        {label !== evidenceClass ? `${label}: ` : ""}
        {evidenceClass}
      </span>
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-[11px] text-fg-subtle transition-colors hover:text-fg"
        >
          source
          <External className="h-3 w-3" />
        </a>
      )}
    </span>
  );
}

/**
 * A group of evidence badges for a set of underlying records that back one
 * aggregate number (e.g. a city's total budget, backed by 13 funding rows).
 * Deduplicates by evidenceClass and, when every record shares one source,
 * shows a single link rather than repeating it.
 */
export function EvidenceBadgeGroup({
  records,
}: {
  records: { evidenceClass: string; sourceUrl?: string | null }[];
}) {
  if (records.length === 0) return null;
  const counts = new Map<string, number>();
  for (const record of records) {
    counts.set(record.evidenceClass, (counts.get(record.evidenceClass) ?? 0) + 1);
  }
  const sourceUrls = new Set(
    records.map((r) => r.sourceUrl).filter((u): u is string => Boolean(u)),
  );
  const sharedSourceUrl = sourceUrls.size === 1 ? [...sourceUrls][0] : null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
      {[...counts.entries()].map(([evidenceClass, count]) => {
        const { tone, label } = classifyEvidence(evidenceClass);
        return (
          <span
            key={evidenceClass}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full py-0.5 pl-1.5 pr-2 text-[11px] font-medium ring-1 ring-inset ${EVIDENCE_TONE_CLASSES[tone]}`}
            title={`${count} of ${records.length} underlying record(s)`}
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${EVIDENCE_TONE_DOT[tone]}`}
            />
            {label !== evidenceClass ? `${label}: ` : ""}
            {evidenceClass}
            {records.length > 1 ? ` ×${count}` : ""}
          </span>
        );
      })}
      {sharedSourceUrl && (
        <a
          href={sharedSourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-[11px] text-fg-subtle transition-colors hover:text-fg"
        >
          source
          <External className="h-3 w-3" />
        </a>
      )}
    </span>
  );
}
