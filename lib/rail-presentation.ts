/**
 * Typed trip-only bridge for the frozen normalized rail contract. Recovery
 * results, recommendation, impact, and feasibility must come from the API.
 */
import { goldenTrip } from "@/lib/domain/fixtures/golden-rail-delay-01";
import type { Disruption, ImpactAnalysis, ItineraryItem, RecoveryRunResult, Trip, ValidatedRecoveryCandidate } from "@/lib/domain/types";
import type { ConnectionCheck, DisruptionAnalysis, Itinerary, RecoveryCandidate, RecoveryResult, TravellerAction } from "@/lib/types";

const asBooking = (item: ItineraryItem) => {
  if (item.kind === "transport") {
    const first = item.legs[0];
    const last = item.legs[item.legs.length - 1];
    return {
      id: item.id,
      kind: "train" as const,
      origin: first?.origin ?? "",
      dest: last?.destination ?? "",
      start: first?.departureAt ?? first?.arrivalAt ?? "",
      end: last?.arrivalAt ?? "",
      cost: undefined,
    };
  }
  if (item.kind === "accommodation") {
    return { id: item.id, kind: "hotel" as const, origin: item.location, dest: item.location, start: item.checkInAt, end: item.checkOutAt, cost: undefined };
  }
  return { id: item.id, kind: "activity" as const, origin: item.location, dest: item.location, start: item.startsAt, end: item.endsAt, cost: undefined };
};

/** Projects only normalized trip facts, preserving transport/accommodation/activity distinctions. */
export function presentTrip(trip: Trip = goldenTrip): Itinerary {
  const firstTransport = trip.items.find((item) => item.kind === "transport");
  const destination = [...trip.items].reverse().find((item) => item.kind === "transport");
  const destinationName = destination?.kind === "transport" ? destination.legs.at(-1)?.destination ?? "Destination" : "Destination";
  return {
    id: trip.id,
    currency: trip.currency,
    bookings: trip.items.map(asBooking),
    constraints: {
      home: firstTransport?.kind === "transport" ? firstTransport.legs[0]?.origin ?? "" : "",
      maxExtraBudget: trip.constraints.maxExtraBudget ?? 0,
      noOvernight: trip.constraints.noOvernight,
      mustBeAt: trip.constraints.latestArrivalAt ? [{ label: "Latest acceptable arrival", city: destinationName, arriveBy: trip.constraints.latestArrivalAt }] : [],
    },
  };
}

export function presentImpact(disruption: Disruption, impact: ImpactAnalysis): DisruptionAnalysis {
  return { disruption: { bookingId: disruption.bookingId, kind: disruption.kind === "cancellation" ? "cancel" : "delay", delayMin: disruption.delayMinutes }, affectedBookingIds: impact.affectedItemIds, impact: [{ bookingId: disruption.bookingId, reason: disruption.kind === "cancellation" ? "cancel" : "delay", text: disruption.kind === "cancellation" ? "This simulated rail service is cancelled." : `This simulated rail service is delayed by ${disruption.delayMinutes} minutes.` }, ...impact.reasons.map((reason) => ({ bookingId: reason.itemId, reason: "connection" as const, text: reason.reason }))] };
}
function candidateItinerary(trip: Trip, candidate: ValidatedRecoveryCandidate) {
  return trip.items.map((item) => {
    const original = asBooking(item);
    const replacement = candidate.alternatives.find((alternative) => alternative.replacementForBookingId === item.id);
    const repaired = candidate.repairedTimings[item.id];
    if (replacement && item.kind === "transport") return { ...original, id: replacement.id, start: repaired?.startAt ?? replacement.departureAt, end: repaired?.endAt ?? replacement.arrivalAt, originalStart: original.start, originalEnd: original.end, impactState: candidate.impactStates[item.id], recoveryChange: candidate.recoveryChanges[item.id] };
    return { ...original, ...(repaired ? { start: repaired.startAt, end: repaired.endAt } : {}), ...(repaired && (repaired.startAt !== original.start || repaired.endAt !== original.end) ? { originalStart: original.start, originalEnd: original.end } : {}), impactState: candidate.impactStates[item.id], recoveryChange: candidate.recoveryChanges[item.id] };
  });
}
const presentChecks = (candidate: ValidatedRecoveryCandidate): ConnectionCheck[] => candidate.connectionChecks.map((check) => ({ predecessorBookingId: check.predecessorItemId, successorBookingId: check.successorItemId, predecessorArrivalAt: check.predecessorArrivalAt, replacementDepartureAt: check.successorDepartureAt, actualBufferMinutes: check.actualBufferMinutes, minimumBufferMinutes: check.minimumBufferMinutes, passed: check.passed }));
export function presentCandidate(trip: Trip, candidate: ValidatedRecoveryCandidate): RecoveryCandidate {
  const itinerary = candidateItinerary(trip, candidate);
  return { id: candidate.id, label: candidate.alternatives.map((alternative) => `Replace ${alternative.replacementForBookingId}`).join(", "), itinerary, changes: Object.values(candidate.recoveryChanges).filter((change) => change !== "UNCHANGED").length, extraCost: candidate.extraCost, violations: candidate.violations.map((violation) => ({ kind: violation.kind === "ARRIVAL_DEADLINE" ? "deadline" : violation.kind === "MAX_EXTRA_BUDGET" ? "budget" : violation.kind === "NO_OVERNIGHT" ? "overnight" : "connection", bookingId: violation.itemId, message: violation.message })), feasible: candidate.feasible, affectedBookingIds: Object.entries(candidate.impactStates).filter(([, state]) => state === "AFFECTED").map(([id]) => id), actions: [], connectionChecks: presentChecks(candidate), explanation: "", arrival: candidate.finalArrivalAt };
}
const presentActions = (actions: readonly { id: string; kind: TravellerAction["kind"]; itemId: string; description: string; automated: boolean }[]): TravellerAction[] => actions.map((action) => ({ ...action }));

export function presentRun(trip: Trip, run: RecoveryRunResult): { result: RecoveryResult; selectedId?: string; candidates: RecoveryCandidate[]; effectiveTrip: Itinerary } {
  const effectiveTrip = presentTrip({ ...trip, constraints: run.effectiveConstraints });
  const candidates = run.candidates.map((candidate) => presentCandidate(trip, candidate)); const violations = candidates.flatMap((candidate) => candidate.violations);
  if (run.status === "NO_FEASIBLE_RECOVERY") return { effectiveTrip, candidates, result: { feasible: false, itinerary: [], changes: 0, extraCost: 0, violations, explanation: "No feasible repair exists within the available candidate set.", affectedBookingIds: run.impact.affectedItemIds, actions: [] } };
  const selected = candidates.find((candidate) => candidate.id === run.recommendation.selectedCandidateId)!;
  return { effectiveTrip, candidates, selectedId: selected.id, result: { feasible: true, itinerary: selected.itinerary, changes: selected.changes, extraCost: selected.extraCost, violations: [], actions: presentActions(run.actions), connectionChecks: selected.connectionChecks, explanation: run.recommendation.reason, decisionSource: run.recommendation.decisionSource, tradeoffs: run.recommendation.tradeoffs, affectedBookingIds: run.impact.affectedItemIds } };
}
