import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { renderWithQueryClient } from "@/test/render";
import ComparePage from "./page";

// ECharts needs a real canvas for text measurement, which jsdom does not
// provide. The chart's data-wiring is exercised through the page's own
// state; what matters for this test is the table content, so the chart
// itself is stubbed out.
vi.mock("@/components/Chart", () => ({
  Chart: ({ ariaLabel }: { ariaLabel: string }) => (
    <div role="img" aria-label={ariaLabel} />
  ),
}));

describe("ComparePage", () => {
  it("shows a loading state before data arrives", () => {
    renderWithQueryClient(<ComparePage />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders all 11 host regions once GET /api/v1/cities resolves", async () => {
    renderWithQueryClient(<ComparePage />);

    await waitFor(() => {
      expect(screen.getByText("New York/New Jersey")).toBeInTheDocument();
    });

    for (const name of [
      "Atlanta",
      "Boston",
      "Dallas",
      "Houston",
      "Kansas City",
      "Los Angeles",
      "Miami",
      "New York/New Jersey",
      "Philadelphia",
      "San Francisco Bay Area",
      "Seattle",
    ]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }

    const rows = screen.getAllByRole("row");
    // header + 11 city rows
    expect(rows).toHaveLength(12);
  });

  it("marks nynj as the hero scenario", async () => {
    renderWithQueryClient(<ComparePage />);
    await waitFor(() => screen.getByText("New York/New Jersey"));
    expect(screen.getByText("Hero scenario")).toBeInTheDocument();
  });

  it("formats the official budget in whole dollars", async () => {
    renderWithQueryClient(<ComparePage />);
    await waitFor(() => screen.getByText("New York/New Jersey"));
    // 1,043,868,100 cents -> $10,438,681
    expect(screen.getByText("$10,438,681")).toBeInTheDocument();
  });

  it("shows the evidence class for each city's funding, once loaded", async () => {
    renderWithQueryClient(<ComparePage />);
    await waitFor(() => screen.getByText("New York/New Jersey"));

    // Funding evidence is fetched per-city after the city list resolves;
    // wait for at least one badge to replace the "loading evidence…" placeholder.
    await waitFor(() => {
      expect(screen.queryAllByText(/loading evidence/i)).toHaveLength(0);
    });

    const engineeringAssumptionBadges = screen.getAllByText(
      /engineering_assumption/,
    );
    expect(engineeringAssumptionBadges.length).toBeGreaterThan(0);

    const formulaResidualBadges = screen.getAllByText(/formula_residual/);
    expect(formulaResidualBadges.length).toBeGreaterThan(0);
  });

  it("links each city to its evidence page", async () => {
    renderWithQueryClient(<ComparePage />);
    await waitFor(() => screen.getByText("New York/New Jersey"));
    const link = screen.getByRole("link", { name: /new york\/new jersey/i });
    expect(link).toHaveAttribute("href", "/cities/nynj");
  });

  it("shows the temporary/permanent dollar split per city", async () => {
    renderWithQueryClient(<ComparePage />);
    const row = await waitFor(() => {
      const el = screen.getByText("New York/New Jersey").closest("tr");
      if (!el) throw new Error("row not found");
      return el;
    });
    // temp = round(1,043,868,100 * 0.42) = 438,424,602 -> $4,384,246
    expect(within(row).getByText(/\$4,384,246/)).toBeInTheDocument();
  });
});
