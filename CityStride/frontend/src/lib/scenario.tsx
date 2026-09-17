"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { OptimizeResult } from "./types";

/**
 * The current optimizer scenario, shared between the optimizer page and the
 * map.
 *
 * This is the map's only source of "selected" (CLAUDE.md rule 11). It is
 * written in exactly one place -- a successful POST /api/v1/optimize response
 * -- and there is no setter that takes anything else, no default scenario, and
 * no persistence that could resurrect a stale portfolio as if it were current.
 * Before the first run it is null, and the map draws no selection at all.
 */
interface ScenarioContextValue {
  scenario: OptimizeResult | null;
  /** Publish an optimizer response as the current scenario. */
  publishScenario: (result: OptimizeResult) => void;
  clearScenario: () => void;
}

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

export function ScenarioProvider({ children }: { children: React.ReactNode }) {
  const [scenario, setScenario] = useState<OptimizeResult | null>(null);

  const publishScenario = useCallback((result: OptimizeResult) => {
    setScenario(result);
  }, []);
  const clearScenario = useCallback(() => setScenario(null), []);

  const value = useMemo(
    () => ({ scenario, publishScenario, clearScenario }),
    [scenario, publishScenario, clearScenario],
  );

  return (
    <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>
  );
}

export function useScenario(): ScenarioContextValue {
  const value = useContext(ScenarioContext);
  if (!value) {
    throw new Error("useScenario must be used inside a ScenarioProvider");
  }
  return value;
}
