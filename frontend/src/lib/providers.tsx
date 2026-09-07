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
            retry: 1,
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
