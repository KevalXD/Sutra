import type { Candidate, LiveDisruption, LiveTrip, RecoveryOutput } from "./types.js";
import { rankCandidates } from "./ai.js";

export function validateCandidates(candidates: Candidate[], trip: LiveTrip): Candidate[] {
  return candidates.map(candidate => {
    const violations = [...candidate.violations];
    if (trip.constraints.maxExtraBudget !== undefined && candidate.extraCost > trip.constraints.maxExtraBudget && !violations.some(v => v.kind === "MAX_EXTRA_BUDGET")) violations.push({ kind: "MAX_EXTRA_BUDGET", itemId: candidate.id, message: "Candidate exceeds the persisted maximum recovery budget." });
    if (trip.constraints.latestArrivalAt && candidate.finalArrivalAt > trip.constraints.latestArrivalAt && !violations.some(v => v.kind === "ARRIVAL_DEADLINE")) violations.push({ kind: "ARRIVAL_DEADLINE", itemId: candidate.id, message: "Candidate arrives after the persisted arrival deadline." });
    return { ...candidate, violations, feasible: violations.length === 0 };
  });
}

export async function runRecovery(runId: string, trip: LiveTrip, disruption: LiveDisruption, candidates: Candidate[]): Promise<RecoveryOutput> {
  const verified = validateCandidates(candidates, trip);
  const feasible = verified.filter(c => c.feasible);
  if (!feasible.length) return { status: "NO_FEASIBLE_RECOVERY", runId, tripVersion: trip.version, impact: { disruptedItemIds: [disruption.bookingId], affectedItemIds: [], reasons: [] }, candidates: verified, recommendation: null, recoveryPlan: null, actions: ["Review constraints", "Contact provider if required"] };
  const decision = await rankCandidates(feasible, trip.constraints.softPreferences ?? []);
  const selected = feasible.find(c => c.id === decision.candidateId);
  if (!selected || !selected.feasible) throw new Error("Post-validation rejected selected recovery");
  return { status: "RECOVERED", runId, tripVersion: trip.version, impact: { disruptedItemIds: [disruption.bookingId], affectedItemIds: [], reasons: [] }, candidates: verified, recommendation: { selectedCandidateId: selected.id, decisionSource: decision.source, reason: decision.reason }, recoveryPlan: selected.payload, actions: ["Review changed itinerary", "Confirm proposed recovery"] };
}
