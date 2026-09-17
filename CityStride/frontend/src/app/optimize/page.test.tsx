import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/server";
import { renderWithQueryClient } from "@/test/render";
import { makeOptimizeResult } from "@/test/fixtures";
import OptimizePage from "./page";

const API_BASE = "http://localhost:8000";

vi.mock("@/components/Chart", () => ({
  Chart: ({ ariaLabel }: { ariaLabel: string }) => (
    <div role="img" aria-label={ariaLabel} />
  ),
}));

describe("OptimizePage", () => {
  it("shows a loading state before cities/interventions arrive", () => {
    renderWithQueryClient(<OptimizePage />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("defaults to nynj with its official budget once loaded", async () => {
    renderWithQueryClient(<OptimizePage />);
    await waitFor(() => screen.getByLabelText(/budget/i));
    const budgetInput = screen.getByLabelText(/budget/i) as HTMLInputElement;
    // 1,043,868,100 cents -> 10,438,681 whole dollars
    expect(budgetInput.value).toBe("10438681");
  });

  it("runs a full optimizer call against the real endpoint and renders the response", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post(`${API_BASE}/api/v1/optimize`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(makeOptimizeResult());
      }),
    );

    const user = userEvent.setup();
    renderWithQueryClient(<OptimizePage />);

    await waitFor(() => screen.getByRole("button", { name: /run optimizer/i }));
    await user.click(screen.getByRole("button", { name: /run optimizer/i }));

    // The button must have triggered the real POST /api/v1/optimize call --
    // nothing here is computed in the browser.
    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(capturedBody).toMatchObject({
      cityId: "nynj",
      budgetCents: 1_043_868_100,
      weights: {
        travelTime: 0.25,
        vehicleCongestion: 0.15,
        emissions: 0.12,
        accessibility: 0.2,
        reliability: 0.15,
        permanentLegacy: 0.13,
      },
      constraints: {
        minimumAccessibilityShare: 0.1,
        maximumTemporaryShare: 0.55,
        minimumPermanentShare: 0.35,
        maximumMajorConstructionProjects: 4,
      },
    });

    // The rendered numbers come straight from the mocked response body.
    await waitFor(() => {
      expect(screen.getByText("$10,330,000")).toBeInTheDocument(); // spentCents
    });
    expect(screen.getByText("$10,438,681")).toBeInTheDocument(); // budgetCents
    expect(screen.getByText("$108,681")).toBeInTheDocument(); // unspentCents
    expect(screen.getByText(/model_output/)).toBeInTheDocument();
    expect(
      screen.getByText(/Selected portfolio \(4 project IDs\)/),
    ).toBeInTheDocument();
    expect(screen.getByText("nynj-service-TMP")).toBeInTheDocument();
    expect(screen.getByText("nynj-buslane-PERM")).toBeInTheDocument();
  });

  it("shows a structured infeasible explanation, not a crash, on 422", async () => {
    server.use(
      http.post(`${API_BASE}/api/v1/optimize`, () =>
        HttpResponse.json(
          {
            detail: {
              error: "infeasible_scenario",
              message: "the requested constraints cannot all be satisfied",
              diagnostics: [
                {
                  code: "permanent_share_unreachable",
                  message:
                    "no mix of the available interventions can reach the requested minimum permanent share",
                  detail: { maximumAchievablePermanentShare: 0.8 },
                },
              ],
            },
          },
          { status: 422 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderWithQueryClient(<OptimizePage />);
    await waitFor(() => screen.getByRole("button", { name: /run optimizer/i }));
    await user.click(screen.getByRole("button", { name: /run optimizer/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/no portfolio satisfies these constraints/i),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("permanent_share_unreachable")).toBeInTheDocument();
    expect(
      screen.getByText(/maximumAchievablePermanentShare/),
    ).toBeInTheDocument();
  });

  it("shows an error state when the API is unreachable", async () => {
    server.use(
      http.post(`${API_BASE}/api/v1/optimize`, () => HttpResponse.error()),
    );

    const user = userEvent.setup();
    renderWithQueryClient(<OptimizePage />);
    await waitFor(() => screen.getByRole("button", { name: /run optimizer/i }));
    await user.click(screen.getByRole("button", { name: /run optimizer/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("disables the sensitivity button until an optimizer run has succeeded", async () => {
    renderWithQueryClient(<OptimizePage />);
    await waitFor(() =>
      screen.getByRole("button", { name: /run sensitivity analysis/i }),
    );
    expect(
      screen.getByRole("button", { name: /run sensitivity analysis/i }),
    ).toBeDisabled();
  });
});
