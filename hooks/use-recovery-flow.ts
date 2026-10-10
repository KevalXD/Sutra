"use client";
import { useCallback, useEffect, useState } from "react";
import { getAlternatives, getTrip, postDisruption, postRecovery, SutraApiError } from "@/lib/api";
import type { ApiError, DisruptionAnalysis, Itinerary, Phase, RecoveryCandidate, RecoveryResult, ScenarioId } from "@/lib/types";
import { presentAnalysis, presentCandidates, presentRecovery, presentTrip } from "@/lib/rail-presentation";

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
      // The currently deployed API still returns the legacy prototype envelope.
      // Keep the call for its loading/error semantics, but render the frozen rail
      // fixture through the presentation bridge until the normalized endpoint lands.
      .then(() => { if (alive) { setTrip(presentTrip()); setPhase("TRIP_LOADED"); } })
      .catch(e => { if (alive) fail(e); });
    return () => { alive = false; };
  }, [scenario, retries]);

  const reload = useCallback(() => setRetries(r => r + 1), []);

  const simulateDisruption = async () => {
    try { await postDisruption(scenario); setAnalysis(presentAnalysis(scenario)); setPhase("DISRUPTION_DETECTED"); } catch (e) { fail(e); }
  };
  const analyzeImpact = () => setPhase("IMPACT_ANALYSIS");
  const findRecovery = async () => {
    setPhase("RECOVERY_ANALYSIS"); setStage(0);
    try {
      await getAlternatives(scenario);
      // Infeasibility is represented only by the backend/fixture's already
      // invalid alternatives; the UI does not derive a new feasibility verdict.
      setCandidates(scenario === "infeasible" ? presentCandidates().filter(candidate => !candidate.feasible) : presentCandidates()); setStage(1);
      const rec = postRecovery(scenario);
      for (let i = 2; i < SEARCH_STAGES.length; i++) { await new Promise(r => setTimeout(r, 450)); setStage(i); }
      await rec;
      const r = presentRecovery(scenario);
      setSelectedId(r.selectedId); setResult(r.result);
      setPhase(r.result.feasible ? "RECOVERY_READY" : "NO_FEASIBLE_RECOVERY");
    } catch (e) { fail(e); }
  };

  return { phase, trip, analysis, result, candidates, selectedId, stage, error, reload, simulateDisruption, analyzeImpact, findRecovery };
}
