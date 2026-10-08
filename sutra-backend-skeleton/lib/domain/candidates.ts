// Stage 2 - Candidate construction. Turns transport offers into complete proposed repairs.
// No feasibility verdict here: that is stage 3's job (03_DOMAIN §8-9).

import { TechnicalFailure } from "./errors";
import { finalTransportArrival, findItem, isTransport } from "./items";
import { repairedTimings } from "./repair";
import { toMinutes } from "./time";
import type { Alternative, Disruption, ImpactAnalysis, RecoveryCandidate, RecoveryChange, Trip } from "./types";

/** "RC-A-ALT" -> "RC-A". Stable, so candidate IDs do not depend on adapter ordering. */
export function candidateIdFor(alt: Alternative): string {
  return alt.id.endsWith("-ALT") ? alt.id.slice(0, -4) : `RC-${alt.id}`;
}

/** An adapter returning nonsense is OUR failure, never an "infeasible" verdict. */
function assertAlternativeWellFormed(trip: Trip, alt: Alternative): void {
  const bad = (why: string) => new TechnicalFailure("ADAPTER_CONTRACT_VIOLATION", `Alternative ${alt.id}: ${why}`);
  const target = findItem(trip, alt.replacementForBookingId);
  if (!target || !isTransport(target)) throw bad("does not replace a transport booking in this trip");
  let minutes: number;
  try {
    minutes = toMinutes(alt.arrivalAt) - toMinutes(alt.departureAt);
  } catch {
    throw bad("has an invalid timestamp");
  }
  if (minutes <= 0) throw bad("arrives before it departs");
  if (!Number.isFinite(alt.extraCost) || alt.extraCost < 0) throw bad("has an invalid extraCost");
}

/** One candidate per alternative (Round 1). Output is sorted by id for deterministic runs. */
export function buildCandidates(
  trip: Trip,
  disruption: Disruption,
  impact: ImpactAnalysis,
  alternatives: Alternative[],
): RecoveryCandidate[] {
  const seen = new Set<string>();
  const candidates = alternatives.map((alt): RecoveryCandidate => {
    assertAlternativeWellFormed(trip, alt);
    const id = candidateIdFor(alt);
    if (seen.has(id)) throw new TechnicalFailure("ADAPTER_CONTRACT_VIOLATION", `Duplicate alternative id ${alt.id}.`);
    seen.add(id);

    const recoveryChanges: Record<string, RecoveryChange> = {};
    for (const item of trip.items) {
      if (item.id === alt.replacementForBookingId) recoveryChanges[item.id] = "REPLACED";
      else if (item.id === disruption.bookingId && disruption.kind === "cancellation") recoveryChanges[item.id] = "CANCELLED";
      else recoveryChanges[item.id] = "UNCHANGED"; // delayed-but-kept and downstream-affected items are not "changed"
    }

    const draft = { alternatives: [alt] };
    const final = finalTransportArrival(trip, repairedTimings(trip, impact, draft));
    return {
      id,
      alternatives: [alt],
      impactStates: { ...impact.impactStates },
      recoveryChanges,
      extraCost: alt.extraCost,
      finalArrivalAt: final?.arrivalAt ?? alt.arrivalAt,
    };
  });
  return candidates.sort((a, b) => a.id.localeCompare(b.id));
}
