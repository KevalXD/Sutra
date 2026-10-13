"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getTrip, runScenario, SutraApiError } from "@/lib/api";
import type { ApiError, DisruptionAnalysis, Itinerary, Phase, RecoveryCandidate, RecoveryResult, ScenarioId } from "@/lib/types";

/** Stages 0-1 follow real API calls (alternatives, recovery request); 2-4 are fixed-duration presentation steps. */
export const SEARCH_STAGES = [
  "Checking affected bookings",
  "Tracing downstream connections",
  "Evaluating recovery candidates",
  "Validating traveller constraints",
  "Comparing recovery candidates",
];

export function useRecoveryFlow(scenario: ScenarioId) {
  const [phase, setPhase] = useState<Phase>("IDLE");
  const [trip, setTrip] = useState<Itinerary>();
  const [analysis, setAnalysis] = useState<DisruptionAnalysis>();
  const [result, setResult] = useState<RecoveryResult>();
  const [candidates, setCandidates] = useState<RecoveryCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<ApiError>();
  const recoveryRequestInFlight = useRef(false);
  // Number of user-initiated reloads. Deterministic: StrictMode double-effects reuse the same value.
  const [retries, setRetries] = useState(0);

  const fail = (e: unknown) => {
    setError(e instanceof SutraApiError ? e.error : { code: "RECOVERY_SERVICE_UNAVAILABLE", message: "Recovery could not be calculated." });
    setPhase("TECHNICAL_ERROR");
  };

  useEffect(() => {
    let alive = true;
    setPhase("IDLE"); setError(undefined); setAnalysis(undefined); setResult(undefined);
    setCandidates([]); setSelectedId(undefined); setStage(0);
    getTrip(scenario, retries)
      .then(trip => { if (alive) { setTrip(trip); setPhase("TRIP_LOADED"); } })
      .catch(e => { if (alive) fail(e); });
    return () => { alive = false; };
  }, [scenario, retries]);

  const reload = useCallback(() => setRetries(r => r + 1), []);

  const simulateDisruption = async () => {
    if (recoveryRequestInFlight.current) return;
    recoveryRequestInFlight.current = true;
    try {
      const run = await runScenario(scenario, retries);
      setAnalysis(run.analysis); setCandidates(run.candidates); setSelectedId(run.selectedId); setResult(run.result);
      setPhase("DISRUPTION_DETECTED");
    } catch (e) { fail(e); }
    finally { recoveryRequestInFlight.current = false; }
  };
  const retryRecovery = async () => {
    if (recoveryRequestInFlight.current) return;
    recoveryRequestInFlight.current = true;
    try {
      setError(undefined);
      const run = await runScenario(scenario, retries + 1);
      setAnalysis(run.analysis); setCandidates(run.candidates); setSelectedId(run.selectedId); setResult(run.result);
      setPhase(run.result.feasible ? "RECOVERY_READY" : "NO_FEASIBLE_RECOVERY");
    } catch (e) { fail(e); }
    finally { recoveryRequestInFlight.current = false; }
  };
  const analyzeImpact = () => setPhase("IMPACT_ANALYSIS");
  const findRecovery = async () => {
    setPhase("RECOVERY_ANALYSIS"); setStage(0);
    try {
      setStage(1);
      for (let i = 2; i < SEARCH_STAGES.length; i++) { await new Promise(r => setTimeout(r, 450)); setStage(i); }
      if (!result) throw new SutraApiError({ code: "RECOVERY_SERVICE_UNAVAILABLE", message: "Recovery was not available." });
      if (result.feasible && (!selectedId || !candidates.some(candidate => candidate.id === selectedId && candidate.feasible))) {
        throw new SutraApiError({ code: "RECOVERY_SERVICE_UNAVAILABLE", message: "Recovery returned an invalid recommendation." });
      }
      setPhase(result.feasible ? "RECOVERY_READY" : "NO_FEASIBLE_RECOVERY");
    } catch (e) { fail(e); }
  };

  return { phase, trip, analysis, result, candidates, selectedId, stage, error, reload, retryRecovery, simulateDisruption, analyzeImpact, findRecovery };
}
