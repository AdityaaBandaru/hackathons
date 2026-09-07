import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { ScenarioProvider } from "@/lib/scenario";

/**
 * Renders inside the same provider tree the app uses (see lib/providers.tsx),
 * but with a fresh, retry-disabled QueryClient so tests fail fast.
 *
 * Keeping this in step with the real tree matters: a page that starts using a
 * new provider should fail here the same way it would fail in the browser.
 */
export function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ScenarioProvider>{ui}</ScenarioProvider>
      </QueryClientProvider>,
    ),
  };
}
