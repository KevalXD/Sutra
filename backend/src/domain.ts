import { rankWithFallback, type CandidateRanker } from "./ai.js";
import type { ConstraintViolation, Disruption, ImpactAnalysis, ItineraryItem, RecoveryCandidate, RecoveryOutput, Trip, TransportLeg } from "./types.js";

const ms = (s: string) => Date.parse(s);
const transportLegs = (items: ItineraryItem[]) => items.flatMap(i => i.kind === "transport" ? i.legs : []);
function violation(kind: ConstraintViolation["kind"], itemId: string, message: string): ConstraintViolation { return { kind, itemId, message }; }
export function analyzeImpact(trip: Trip, disruption: Disruption): ImpactAnalysis {
  const states: Record<string, "UNCHANGED" | "AFFECTED" | "DISRUPTED"> = {};
  for (const item of trip.items) states[item.id] = item.id === disruption.bookingId ? "DISRUPTED" : "UNCHANGED";
  const adjacency = new Map<string, Set<string>>();
  for (const dependency of trip.dependencies) {
    if (!adjacency.has(dependency.fromItemId)) adjacency.set(dependency.fromItemId, new Set());
    if (!adjacency.has(dependency.toItemId)) adjacency.set(dependency.toItemId, new Set());
    adjacency.get(dependency.fromItemId)!.add(dependency.toItemId);
    adjacency.get(dependency.toItemId)!.add(dependency.fromItemId);
  }
  const visited = new Set<string>([disruption.bookingId]);
  const queue = [disruption.bookingId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push(neighbor);
      if (neighbor !== disruption.bookingId) states[neighbor] = "AFFECTED";
    }
  }
  const affectedItemIds = [...visited].filter(id => id !== disruption.bookingId);
  return {
    disruptedItemIds: [disruption.bookingId],
    affectedItemIds,
    impactStates: states,
    reasons: affectedItemIds.map(itemId => ({ itemId, reason: "A downstream itinerary dependency may be impacted by the disruption." })),
  };
}
export function validateCandidate(candidate: RecoveryCandidate, trip: Trip): RecoveryCandidate {
  const violations: ConstraintViolation[] = [];
  if (candidate.tripId !== trip.id) violations.push(violation("IDENTITY", candidate.id, "Candidate belongs to a different trip."));
  const originalIds = new Set(trip.items.map(item => item.id));
  const candidateIds = new Set(candidate.itinerary.map(item => item.id));
  const replacementByBookingId = new Map<string, ItineraryItem>();
  for (const alternative of candidate.alternatives) {
    const replacement = alternative.replacementItem
      ? candidate.itinerary.find(item => item.id === alternative.replacementItem!.id)
      : undefined;
    if (replacement) replacementByBookingId.set(alternative.replacementForBookingId, replacement);
  }
  const resolveItem = (id: string) => replacementByBookingId.get(id) ?? candidate.itinerary.find(item => item.id === id);
  const replacedIds = new Set(candidate.alternatives.map(alternative => alternative.replacementForBookingId));
  for (const id of originalIds) {
    if (!replacedIds.has(id) && !candidateIds.has(id)) violations.push(violation("IDENTITY", id, "Unaffected itinerary item was not preserved."));
  }
  const legs = transportLegs(candidate.itinerary);
  for (const leg of legs) {
    if (!Number.isFinite(ms(leg.departureAt)) || !Number.isFinite(ms(leg.arrivalAt)) || ms(leg.arrivalAt) <= ms(leg.departureAt)) {
      violations.push(violation("CHRONOLOGY", leg.id, "Transport times are not chronological."));
    }
  }
  for (let i = 1; i < legs.length; i++) {
    if (ms(legs[i].departureAt) < ms(legs[i - 1].arrivalAt)) {
      violations.push(violation("CHRONOLOGY", legs[i].id, "A transport leg departs before the preceding leg arrives."));
    }
  }
  for (const dependency of trip.dependencies) {
    const from = resolveItem(dependency.fromItemId);
    const to = resolveItem(dependency.toItemId);
    if (dependency.kind === "CONNECTION" && from?.kind === "transport" && to?.kind === "transport") {
      const a = from.legs.at(-1), b = to.legs[0];
      if (!a || !b || ms(b.departureAt) - ms(a.arrivalAt) < (dependency.minimumBufferMinutes ?? 0) * 60000) {
        violations.push(violation("CONNECTION", dependency.id, "Minimum connection time is not met."));
      }
    }
    if (dependency.kind === "WINDOW" && from?.kind === "transport" && to?.kind === "accommodation") {
      const lastLeg = from.legs.at(-1);
      // checkInAt is the start of the hotel's check-in window, not a latest-arrival deadline.
      if (!lastLeg || ms(lastLeg.arrivalAt) > ms(to.checkOutAt)) {
        violations.push(violation("CHRONOLOGY", dependency.id, "Arrival is after the accommodation stay ends."));
      }
    }
  }
  if (trip.constraints.latestArrivalAt && ms(candidate.finalArrivalAt) > ms(trip.constraints.latestArrivalAt)) {
    violations.push(violation("ARRIVAL_DEADLINE", candidate.id, "Candidate arrives after the latest arrival deadline."));
  }
  if (trip.constraints.maxExtraBudget !== undefined && candidate.extraCost > trip.constraints.maxExtraBudget) {
    violations.push(violation("MAX_EXTRA_BUDGET", candidate.id, "Candidate exceeds the maximum additional budget."));
  }
  if (trip.constraints.noOvernight && legs.some(leg => {
    const departureHour = new Date(leg.departureAt).getHours(), arrivalHour = new Date(leg.arrivalAt).getHours();
    return departureHour >= 23 || departureHour < 5 || arrivalHour >= 23 || arrivalHour < 5;
  })) violations.push(violation("NO_OVERNIGHT", candidate.id, "Overnight travel is prohibited."));
  return { ...candidate, violations, feasible: violations.length === 0 };
}
export async function runRecovery(runId: string, trip: Trip, disruption: Disruption, candidates: RecoveryCandidate[], ranker?: CandidateRanker): Promise<RecoveryOutput> { const impact = analyzeImpact(trip, disruption); const verified = candidates.map(c => ({ ...c, impactStates: impact.impactStates })).map(c => validateCandidate(c, trip)); const feasible = verified.filter(c => c.feasible); if (!feasible.length) return { runId, status: "NO_FEASIBLE_RECOVERY", trip, disruption, impact, candidates: verified, recommendation: null, recoveryPlan: null, actions: ["Review the verified constraint violations", "Contact the provider if no alternative is acceptable"] }; const recommendation = await rankWithFallback(feasible, trip.constraints.softPreferences ?? [], ranker); const selected = verified.find(c => c.id === recommendation.selectedCandidateId); if (!selected || !selected.feasible) throw new Error("Selected candidate failed final validation"); return { runId, status: "RECOVERED", trip, disruption, impact, candidates: verified, recommendation, recoveryPlan: { originalItinerary: structuredClone(trip.items), repairedItinerary: structuredClone(selected.itinerary), extraCost: selected.extraCost, finalArrivalAt: selected.finalArrivalAt, changes: selected.recoveryChanges }, actions: ["Review the proposed itinerary", "Confirm replacement booking with the traveller/provider"] }; }
