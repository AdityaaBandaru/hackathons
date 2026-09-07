/** Shared loading / error presentational states. */

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
    >
      <span
        aria-hidden="true"
        className="h-4 w-4 flex-none animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-slate-700 dark:border-t-slate-300"
      />
      {label}
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
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800"
        >
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
    <div
      role="alert"
      className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
    >
      <p className="font-semibold">No portfolio satisfies these constraints</p>
      <p className="mt-1">{message}</p>
      <ul className="mt-3 space-y-2">
        {diagnostics.map((d) => (
          <li
            key={d.code}
            className="rounded-md bg-white/60 p-2 dark:bg-black/20"
          >
            <p className="font-mono text-xs text-amber-700 dark:text-amber-400">
              {d.code}
            </p>
            <p>{d.message}</p>
            {Object.keys(d.detail).length > 0 && (
              <pre className="mt-1 overflow-x-auto rounded bg-black/5 p-2 text-xs dark:bg-white/5">
                {JSON.stringify(d.detail, null, 2)}
              </pre>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
