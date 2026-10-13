import { demoScenarioFor } from "@/lib/domain/fixtures/recovery-scenarios";
import type { RecoveryRunResult, Trip } from "@/lib/domain/types";
import { presentImpact, presentRun, presentTrip } from "@/lib/rail-presentation";
import type { ApiError, DisruptionAnalysis, Itinerary, RecoveryCandidate, RecoveryResult, ScenarioId } from "./types";

export class SutraApiError extends Error { constructor(public error: ApiError) { super(error.message); } }
async function call<T>(path: string, fallback: ApiError, init?: RequestInit): Promise<T> {
  let response: Response; try { response = await fetch(path, init); } catch { throw new SutraApiError(fallback); }
  if (!response.ok) { const body = await response.json().catch(() => null); throw new SutraApiError(body?.error ?? fallback); }
  return response.json();
}
export const getTrip = async (scenario: ScenarioId, attempt: number): Promise<Itinerary> => {
  void attempt;
  const fixture = demoScenarioFor(scenario);
  return presentTrip(await call<Trip>(`/api/v1/trips/${fixture.trip.id}`, { code: "ITINERARY_LOAD_FAILED", message: "We couldn't load this journey." }));
};
export const disruptionFor = (scenario: ScenarioId) => demoScenarioFor(scenario).disruption;
async function postRecoveryRun(scenario: ScenarioId, attempt = 0): Promise<RecoveryRunResult> {
  const fixture = demoScenarioFor(scenario);
  return call<RecoveryRunResult>("/api/v1/recovery-runs", { code: "RECOVERY_SERVICE_UNAVAILABLE", message: "Recovery could not be calculated." }, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId: fixture.trip.id, tripVersion: fixture.trip.version, disruption: fixture.disruption, demoAttempt: attempt }) });
}
export const postDisruption = async (scenario: ScenarioId, attempt = 0): Promise<DisruptionAnalysis> => presentImpact(disruptionFor(scenario), (await postRecoveryRun(scenario, attempt)).impact);
export const getAlternatives = async (scenario: ScenarioId, attempt = 0): Promise<RecoveryCandidate[]> => presentRun(demoScenarioFor(scenario).trip, await postRecoveryRun(scenario, attempt)).candidates;
export const postRecovery = async (scenario: ScenarioId, attempt = 0): Promise<{ result: RecoveryResult; selectedId?: string }> => { const mapped = presentRun(demoScenarioFor(scenario).trip, await postRecoveryRun(scenario, attempt)); return { result: mapped.result, selectedId: mapped.selectedId }; };
export const runScenario = async (scenario: ScenarioId, attempt = 0) => {
  const fixture = demoScenarioFor(scenario); const run = await postRecoveryRun(scenario, attempt); const mapped = presentRun(fixture.trip, run);
  return { analysis: presentImpact(disruptionFor(scenario), run.impact), ...mapped };
};
