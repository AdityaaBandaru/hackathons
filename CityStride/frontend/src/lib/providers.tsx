"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ScenarioProvider } from "./scenario";

/**
 * One QueryClient per browser session (not per render): created lazily inside
 * useState so server-render and the first client render don't fight over a
 * module-level singleton.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // The hosted API sleeps when idle; while it wakes, the first
            // requests can fail outright rather than hang. Keep retrying
            // with backoff (1 s, 2 s, 4 s, 8 s, 16 s) so a cold start turns
            // into a slow load, not an error.
            retry: 5,
            retryDelay: (attempt) => Math.min(16_000, 1000 * 2 ** attempt),
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ScenarioProvider>{children}</ScenarioProvider>
    </QueryClientProvider>
  );
}
