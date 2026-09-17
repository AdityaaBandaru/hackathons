/** Shared loading / error presentational states. */

"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/Icons";

/**
 * After a few seconds of loading, say why it might be slow: the hosted API
 * sleeps when idle and takes up to a minute to wake. Better than a judge
 * staring at a spinner wondering if the site is broken.
 */
const SLOW_AFTER_MS = 4000;

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div
      role="status"
      className="card animate-fade-in flex flex-col gap-4 px-5 py-5"
    >
      <div className="flex items-center gap-3 text-sm text-fg-muted">
        <Spinner className="h-4 w-4 flex-none text-accent-fg" />
        {label}
      </div>
      {slow && (
        <p className="animate-fade-in text-xs leading-relaxed text-fg-subtle">
          Still working — the hosted API goes to sleep when nobody has used it
          for a while and takes up to a minute to wake up. It will be quick
          after this.
        </p>
      )}
      <div aria-hidden="true" className="space-y-2">
        <div className="skeleton h-3 w-2/3" />
        <div className="skeleton h-3 w-1/2" />
        <div className="skeleton h-3 w-3/5" />
      </div>
    </div>
  );
}

export function ErrorBlock({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="panel-note note-danger animate-scale-in">
      <p className="font-semibold text-fg">{title}</p>
      <p className="mt-1 text-[13px] opacity-90">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-secondary btn-sm mt-3">
          Try again
        </button>
      )}
    </div>
  );
}

export function InfeasibleBlock({
  message,
  diagnostics,
}: {
  message: string;
  diagnostics: { code: string; message: string; detail: Record<string, unknown> }[];
}) {
  return (
    <div role="alert" className="panel-note note-warn animate-scale-in">
      <p className="font-semibold text-fg">No portfolio satisfies these constraints</p>
      <p className="mt-1 text-[13px] opacity-90">{message}</p>
      <ul className="mt-3 space-y-2">
        {diagnostics.map((d, i) => (
          <li
            key={d.code}
            className="reveal rounded-lg border border-border bg-bg/60 p-3"
            style={{ "--i": i } as React.CSSProperties}
          >
            <p className="font-mono text-[11px] text-warn">{d.code}</p>
            <p className="mt-0.5 text-[13px]">{d.message}</p>
            {Object.keys(d.detail).length > 0 && (
              <pre className="mt-2 overflow-x-auto rounded-md bg-black/40 p-2 text-[11px] leading-relaxed text-fg-muted">
                {JSON.stringify(d.detail, null, 2)}
              </pre>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
