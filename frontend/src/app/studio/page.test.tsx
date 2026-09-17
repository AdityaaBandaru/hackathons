import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQueryClient } from "@/test/render";
import type { Project3D } from "@/lib/types";
import StudioPage from "./page";

vi.mock("@/components/map/ProjectStudioScene", () => ({
  ProjectStudioScene: ({ projects }: { projects: Project3D[] }) => <div data-testid="rendered-models">{projects.map((project) => project.projectId).join(",")}</div>,
}));

describe("3D design studio", () => {
  it("opens a candidate model, compares phases and removes every model in baseline", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<StudioPage />);
    await waitFor(() => expect(screen.getByTestId("rendered-models")).toBeInTheDocument());
    expect(screen.getByTestId("rendered-models").textContent).toContain("PERM");
    await user.click(screen.getByRole("button", { name: "Compare both" }));
    expect(screen.getByTestId("rendered-models").textContent).toContain("TMP");
    expect(screen.getByTestId("rendered-models").textContent).toContain("PERM");
    await user.click(screen.getByRole("button", { name: "Baseline" }));
    expect(screen.queryByTestId("rendered-models")).not.toBeInTheDocument();
    expect(screen.getByText("The baseline contains no modeled proposals.")).toBeInTheDocument();
  });
  it("has no selected designs before an optimizer run", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<StudioPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Selected Legacy" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Selected Legacy" }));
    expect(screen.queryByTestId("rendered-models")).not.toBeInTheDocument();
    expect(screen.getByText("No matching projects in this scenario.")).toBeInTheDocument();
  });
});
