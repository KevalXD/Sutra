import type { ScenarioId } from "./types";
export const SCENARIOS: ScenarioId[] = ["delay", "cancellation", "infeasible", "error"];
export const parseScenario = (v: string | null | undefined): ScenarioId => (SCENARIOS.includes(v as ScenarioId) ? (v as ScenarioId) : "delay");
