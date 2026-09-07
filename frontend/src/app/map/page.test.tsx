/**
 * Page-level behaviour of the map: the four modes, the scenario dependency,
 * and the click card. The MapLibre component is stubbed here (its own filter
 * wiring is covered in ProjectMap.test.tsx) so these tests can assert what
 * the page decides to draw without needing WebGL.
 */

import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { useEffect, type ReactElement } from "react";
import { ScenarioProvider, useScenario } from "@/lib/scenario";
import { makeMapScenario, NYNJ_MAP_PROJECT_IDS } from "@/test/fixtures";
import type { OptimizeResult } from "@/lib/types";
import MapPage from "./page";

const capturedMapProps: { selection: { selectedIds: string[]; candidateIds: string[] } }[] =
  [];

vi.mock("@/components/map/ProjectMap", () => ({
  ProjectMap: (props: {
    selection: { selectedIds: string[]; candidateIds: string[] };
  }) => {
    capturedMapProps.push(props);
    return <div data-testid="mock-map" />;
  },
  MEADOWLANDS_CENTER: [-74.070749, 40.807664],
}));

/** Publishes a scenario into the provider exactly as the optimizer page does. */
function ScenarioSeeder({ scenario }: { scenario: OptimizeResult | null }) {
  const { publishScenario } = useScenario();
  useEffect(() => {
    if (scenario) publishScenario(scenario);
  }, [scenario, publishScenario]);
  return null;
}

function renderMap(scenario: OptimizeResult | null = null): void {
  capturedMapProps.length = 0;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const ui: ReactElement = (
    <QueryClientProvider client={queryClient}>
      <ScenarioProvider>
        <ScenarioSeeder scenario={scenario} />
        <MapPage />
      </ScenarioProvider>
    </QueryClientProvider>
  );
  render(ui);
}

async function switchMode(label: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: label }));
}

const counts = () => ({
  drawn: Number(screen.getByTestId("drawn-count").textContent),
  selected: Number(screen.getByTestId("selected-count").textContent),
  candidate: Number(screen.getByTestId("candidate-count").textContent),
});

/** IDs the map lists, with the role it assigned each one. */
function drawnRoles(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const button of document.querySelectorAll<HTMLElement>("[data-project-id]")) {
    out[button.dataset.projectId!] = button.dataset.role!;
  }
  return out;
}

describe("MapPage", () => {
  it("shows a loading state while geometry loads", () => {
    renderMap();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("defaults to All Possibilities and draws every candidate translucently", async () => {
    renderMap();
    await waitFor(() => screen.getByTestId("drawn-count"));
    expect(screen.getByRole("radio", { name: "All Possibilities" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(counts()).toEqual({ drawn: 6, selected: 0, candidate: 6 });
    // "possible" is never styled as "chosen" when there's nothing to choose from
    expect(Object.values(drawnRoles()).every((r) => r === "candidate")).toBe(true);
  });

  it("All Possibilities keeps drawing every candidate while highlighting the scenario's own picks", async () => {
    renderMap(makeMapScenario());
    await waitFor(() => screen.getByTestId("drawn-count"));
    // Already on All Possibilities (the default mode).

    // Nothing was removed from the undifferentiated candidate set: all 6
    // still draw, and the scenario's 4 picks are additionally highlighted.
    expect(counts()).toEqual({ drawn: 6, selected: 4, candidate: 6 });

    const roles = drawnRoles();
    expect(roles["nynj-service-TMP"]).toBe("selected");
    expect(roles["nynj-service-PERM"]).toBe("selected");
    expect(roles["nynj-station-TMP"]).toBe("selected");
    expect(roles["nynj-station-PERM"]).toBe("selected");
    // bike was never selected by the scenario -- still drawn, not highlighted.
    expect(roles["nynj-bike-TMP"]).toBe("candidate");
    expect(roles["nynj-bike-PERM"]).toBe("candidate");
  });

  it("All Possibilities never invents a highlight: only the scenario's actual selectedIds qualify", async () => {
    // A scenario that selected nothing at all (an empty portfolio is a valid
    // optimizer result, e.g. at zero budget) must highlight nothing -- not
    // "everything", not "the first project", not a guess.
    const emptyScenario = {
      ...makeMapScenario(),
      selectedProjectIds: [],
      selectedProjects: [],
    };
    renderMap(emptyScenario);
    await waitFor(() => screen.getByTestId("drawn-count"));

    expect(counts()).toEqual({ drawn: 6, selected: 0, candidate: 6 });
    expect(Object.values(drawnRoles()).every((r) => r === "candidate")).toBe(true);
  });

  // -------------------------------------------------------------------
  // Rule 12
  // -------------------------------------------------------------------

  it("baseline hides every proposal, even with a full scenario loaded", async () => {
    renderMap(makeMapScenario());
    await waitFor(() => screen.getByTestId("drawn-count"));
    await switchMode("Baseline");

    expect(counts()).toEqual({ drawn: 0, selected: 0, candidate: 0 });
    expect(screen.queryByTestId("drawn-list")).not.toBeInTheDocument();
    for (const projectId of NYNJ_MAP_PROJECT_IDS) {
      expect(
        document.querySelector(`[data-project-id="${projectId}"]`),
      ).toBeNull();
    }
    expect(
      screen.getByText(/baseline hides every modeled proposal/i),
    ).toBeInTheDocument();
  });

  it("passes an empty selection to the map in baseline", async () => {
    renderMap(makeMapScenario());
    await waitFor(() => screen.getByTestId("drawn-count"));
    await switchMode("Baseline");
    const latest = capturedMapProps.at(-1)!;
    expect(latest.selection.selectedIds).toEqual([]);
    expect(latest.selection.candidateIds).toEqual([]);
  });

  // -------------------------------------------------------------------
  // Rule 11/13
  // -------------------------------------------------------------------

  it("never marks an unselected ID as selected in any mode", async () => {
    renderMap(makeMapScenario());
    await waitFor(() => screen.getByTestId("drawn-count"));

    const neverSelected = ["nynj-bike-TMP", "nynj-bike-PERM"];
    for (const mode of [
      "Baseline",
      "Temporary Operations",
      "Selected Legacy",
      "All Possibilities",
    ]) {
      await switchMode(mode);
      const roles = drawnRoles();
      for (const projectId of neverSelected) {
        expect(roles[projectId] ?? "absent").not.toBe("selected");
      }
      const latest = capturedMapProps.at(-1)!;
      for (const projectId of neverSelected) {
        expect(latest.selection.selectedIds).not.toContain(projectId);
      }
    }
  });

  it("draws nothing selected when no optimizer scenario has been run", async () => {
    renderMap(null);
    await waitFor(() => screen.getByTestId("drawn-count"));

    for (const mode of ["Temporary Operations", "Selected Legacy"]) {
      await switchMode(mode);
      expect(counts()).toEqual({ drawn: 0, selected: 0, candidate: 0 });
      expect(
        screen.getByText(/no optimizer scenario has been run yet/i),
      ).toBeInTheDocument();
    }
  });

  it("links to the optimizer instead of inventing a scenario", async () => {
    renderMap(null);
    await waitFor(() => screen.getByTestId("drawn-count"));
    await switchMode("Selected Legacy");
    expect(screen.getByRole("link", { name: /run the optimizer/i })).toHaveAttribute(
      "href",
      "/optimize",
    );
  });

  // -------------------------------------------------------------------
  // Phase modes
  // -------------------------------------------------------------------

  it("Temporary Operations draws only the scenario's -TMP projects", async () => {
    renderMap(makeMapScenario());
    await waitFor(() => screen.getByTestId("drawn-count"));
    await switchMode("Temporary Operations");

    expect(counts()).toEqual({ drawn: 2, selected: 2, candidate: 0 });
    expect(drawnRoles()).toEqual({
      "nynj-service-TMP": "selected",
      "nynj-station-TMP": "selected",
    });
  });

  it("Selected Legacy draws only the scenario's -PERM projects", async () => {
    renderMap(makeMapScenario());
    await waitFor(() => screen.getByTestId("drawn-count"));
    await switchMode("Selected Legacy");

    expect(counts()).toEqual({ drawn: 2, selected: 2, candidate: 0 });
    expect(drawnRoles()).toEqual({
      "nynj-service-PERM": "selected",
      "nynj-station-PERM": "selected",
    });
  });

  it("warns when the scenario belongs to a different host region", async () => {
    const scenario = { ...makeMapScenario(), cityId: "atlanta", hostRegion: "Atlanta" };
    renderMap(scenario);
    await waitFor(() => screen.getByTestId("drawn-count"));
    await switchMode("Selected Legacy");
    expect(screen.getByText(/current scenario is for Atlanta/i)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------
  // Click card
  // -------------------------------------------------------------------

  it("opens a card with name, phase, cost, evidence basis and source", async () => {
    const user = userEvent.setup();
    renderMap(makeMapScenario());
    await waitFor(() => screen.getByTestId("drawn-count"));
    await switchMode("Selected Legacy");

    await user.click(
      document.querySelector<HTMLElement>(
        '[data-project-id="nynj-station-PERM"]',
      )!,
    );

    const card = await screen.findByRole("complementary", {
      name: /project detail/i,
    });
    expect(within(card).getByText("nynj-station-PERM")).toBeInTheDocument();
    expect(within(card).getByText("station package")).toBeInTheDocument();
    expect(within(card).getByText("permanent")).toBeInTheDocument();
    expect(within(card).getByText(/selected in current scenario/i)).toBeInTheDocument();
    // The scenario's own allocation, and the seeded one, shown separately.
    expect(within(card).getByText("$2,000,000")).toBeInTheDocument();
    expect(within(card).getByText(/model_output/)).toBeInTheDocument();
    expect(within(card).getByText(/engineering_assumption/)).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /source/i })).toHaveAttribute(
      "href",
      "https://www.njtransit.com/meadowlands",
    );
    expect(within(card).getByText(/planning_anchor/)).toBeInTheDocument();
    expect(within(card).getByText(/concept_only/)).toBeInTheDocument();
  });

  it("marks a candidate as not selected on its card", async () => {
    const user = userEvent.setup();
    renderMap(makeMapScenario());
    await waitFor(() => screen.getByTestId("drawn-count"));
    // All Possibilities: bike is a candidate the scenario did not choose.
    await user.click(
      document.querySelector<HTMLElement>('[data-project-id="nynj-bike-PERM"]')!,
    );
    const card = await screen.findByRole("complementary", {
      name: /project detail/i,
    });
    expect(
      within(card).getByText(/not selected in current scenario/i),
    ).toBeInTheDocument();
  });
});
