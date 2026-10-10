/**
 * The visual layer's narrow compatibility bridge while the recovery endpoint is
 * being migrated to the frozen rail contract. It only projects domain facts for
 * display; selection, feasibility, impact, and violations remain fixture/API
 * facts and are never recalculated here.
 */
import {
  goldenCandidates,
  goldenDisruption,
  goldenExpectedRecommendation,
  goldenTrip,
} from "@/lib/domain/fixtures/golden-rail-delay-01";
import type { ItineraryItem, RecoveryCandidate as DomainCandidate, Trip } from "@/lib/domain/types";
import type {
  ConstraintViolation,
  DisruptionAnalysis,
  Itinerary,
  RecoveryCandidate,
  RecoveryResult,
  ScenarioId,
} from "@/lib/types";

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

const violation = (candidate: DomainCandidate): ConstraintViolation[] => candidate.violations.map((item) => ({
  bookingId: item.itemId,
  kind: item.kind === "LATEST_ARRIVAL" ? "deadline" : item.kind === "MAX_EXTRA_BUDGET" ? "budget" : item.kind === "NO_OVERNIGHT" ? "overnight" : "connection",
  message: item.message,
}));

function presentedCandidate(candidate: DomainCandidate, trip: Itinerary): RecoveryCandidate {
  const alternative = candidate.alternatives[0];
  const itinerary = trip.bookings.map((booking) => {
    if (booking.id !== alternative?.replacementForBookingId) return booking;
    return {
      ...booking,
      id: alternative.id,
      start: alternative.departureAt ?? booking.start,
      end: alternative.arrivalAt,
      // An alternative has an incremental recovery cost, not a total fare.
      cost: undefined,
    };
  });
  return {
    id: candidate.id,
    label: alternative ? `Replace ${alternative.replacementForBookingId} with ${alternative.id}` : "Keep the original journey",
    itinerary,
    changes: Object.values(candidate.recoveryChanges).filter((change) => change !== "UNCHANGED").length,
    extraCost: candidate.extraCost,
    violations: violation(candidate),
    feasible: candidate.feasible,
    affectedBookingIds: Object.entries(candidate.impactStates).filter(([, state]) => state === "AFFECTED").map(([id]) => id),
    explanation: "",
    arrival: candidate.finalArrivalAt,
  };
}

export function presentCandidates(trip: Itinerary = presentTrip()): RecoveryCandidate[] {
  return goldenCandidates.map((candidate) => presentedCandidate(candidate, trip));
}

export function presentAnalysis(scenario: ScenarioId): DisruptionAnalysis {
  const cancellation = scenario === "cancellation";
  const disruption = { bookingId: goldenDisruption.bookingId, kind: cancellation ? "cancel" as const : "delay" as const, delayMin: cancellation ? undefined : goldenDisruption.delayMinutes };
  return {
    disruption,
    affectedBookingIds: ["RAIL-B", "HOTEL-1"],
    impact: cancellation ? [
      { bookingId: "RAIL-A", reason: "cancel", text: "RAIL-A is cancelled in this simulated scenario, so the journey cannot begin as booked." },
      { bookingId: "RAIL-B", reason: "connection", text: "The Hassan Junction connection is no longer reachable." },
      { bookingId: "HOTEL-1", reason: "hotel", text: "Arrival in Mysuru is no longer assured for the hotel booking." },
    ] : [
      { bookingId: "RAIL-A", reason: "delay", text: "RAIL-A is delayed by 2h 00m in this simulated scenario." },
      { bookingId: "RAIL-B", reason: "connection", text: "The Hassan Junction connection is missed after the delayed arrival." },
      { bookingId: "HOTEL-1", reason: "hotel", text: "The planned hotel check-in is affected by the missed onward rail connection." },
      { bookingId: "RAIL-B", reason: "deadline", text: "The 19:00 latest-arrival constraint must be revalidated." },
    ],
  };
}

export function presentRecovery(scenario: ScenarioId, trip: Itinerary = presentTrip()): { result: RecoveryResult; selectedId?: string } {
  const candidates = presentCandidates(trip);
  const feasible = scenario === "infeasible" ? [] : candidates.filter((candidate) => candidate.feasible);
  if (!feasible.length) {
    return { result: { feasible: false, itinerary: [], changes: 0, extraCost: 0, affectedBookingIds: ["RAIL-B", "HOTEL-1"], violations: candidates.flatMap((candidate) => candidate.violations), explanation: "No available simulated alternative meets every traveller constraint." } };
  }
  const selected = feasible.find((candidate) => candidate.id === goldenExpectedRecommendation.selectedCandidateId) ?? feasible[0];
  return {
    selectedId: selected.id,
    result: {
      feasible: true,
      itinerary: selected.itinerary,
      changes: selected.changes,
      extraCost: selected.extraCost,
      affectedBookingIds: selected.affectedBookingIds,
      violations: [],
      explanation: scenario === "cancellation"
        ? "This simulated cancellation recovery replaces the affected onward rail booking while preserving the stated constraints."
        : "This simulated rail fixture recommends the earlier-arriving feasible option within the stated constraints.",
    },
  };
}
