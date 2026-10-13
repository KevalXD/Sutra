// Repaired timeline for one candidate. Shared by candidate construction, validation and plan building
// so all three always agree. The original Trip is never mutated.

import { baselineTiming, isTransport } from "./items";
import type { Alternative, ImpactAnalysis, ItemTiming, RecoveryCandidate, Trip } from "./types";

type CandidateShape = Pick<RecoveryCandidate, "alternatives">;

export function alternativeFor(c: CandidateShape, itemId: string): Alternative | undefined {
  return c.alternatives.find((a) => a.replacementForBookingId === itemId);
}

/** itemId -> timing in the repaired itinerary; `null` = item no longer exists (cancelled, not replaced). */
export function repairedTimings(trip: Trip, impact: ImpactAnalysis, c: CandidateShape): Record<string, ItemTiming | null> {
  const out: Record<string, ItemTiming | null> = {};
  for (const item of trip.items) {
    const alt = isTransport(item) ? alternativeFor(c, item.id) : undefined;
    if (alt) out[item.id] = { startAt: alt.departureAt, endAt: alt.arrivalAt };
    else if (item.id in impact.disruptedTimings) out[item.id] = impact.disruptedTimings[item.id];
    else out[item.id] = baselineTiming(item);
  }
  return out;
}
