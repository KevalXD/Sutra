// Stage 1 - Impact analysis. Deterministic; answers "what does this disruption break?",
// never "what should we do about it?" (03_DOMAIN_AND_RECOVERY §5-7).

import { RecoveryInputError } from "./errors";
import { baselineTiming, findItem, isTransport } from "./items";
import { addMinutes, diffMinutes } from "./time";
import type {
  Dependency,
  Disruption,
  ImpactAnalysis,
  ImpactReason,
  ImpactState,
  ItemTiming,
  Trip,
} from "./types";

/** Validates the disruption against the trip. Throws RecoveryInputError; never guesses. */
export function assertDisruptionApplies(trip: Trip, d: Disruption): void {
  const item = findItem(trip, d.bookingId);
  if (!item) throw new RecoveryInputError("BOOKING_NOT_FOUND", `Booking ${d.bookingId} is not part of trip ${trip.id}.`);
  if (!isTransport(item)) {
    throw new RecoveryInputError("DOMAIN_REJECTED", `Booking ${d.bookingId} is not a transport booking and cannot be delayed or cancelled.`);
  }
  if (d.kind === "delay") {
    if (!Number.isInteger(d.delayMinutes) || (d.delayMinutes as number) <= 0) {
      throw new RecoveryInputError("DOMAIN_REJECTED", "A delay disruption needs delayMinutes as a positive integer.");
    }
  } else if (d.delayMinutes !== undefined) {
    throw new RecoveryInputError("DOMAIN_REJECTED", "A cancellation must not carry delayMinutes.");
  }
}

export function analyzeImpact(trip: Trip, disruption: Disruption): ImpactAnalysis {
  assertDisruptionApplies(trip, disruption);

  const disrupted = findItem(trip, disruption.bookingId)!;
  const base = baselineTiming(disrupted);
  const disruptedTiming: ItemTiming | null =
    disruption.kind === "delay" ? { startAt: base.startAt, endAt: addMinutes(base.endAt, disruption.delayMinutes!) } : null;

  const states: Record<string, ImpactState> = Object.fromEntries(trip.items.map((i) => [i.id, "UNCHANGED" as ImpactState]));
  states[disrupted.id] = "DISRUPTED";
  const reasons: ImpactReason[] = [];

  // Worklist propagation until the downstream state stabilises (§6).
  const queue = [disrupted.id];
  while (queue.length) {
    const fromId = queue.shift()!;
    for (const dep of trip.dependencies.filter((d) => d.fromItemId === fromId)) {
      if (states[dep.toItemId] !== "UNCHANGED") continue;
      const reason = reasonDependencyBreaks(trip, dep, fromId === disrupted.id ? disruptedTiming : undefined, fromId === disrupted.id);
      if (!reason) continue;
      states[dep.toItemId] = "AFFECTED";
      reasons.push({ itemId: dep.toItemId, reason });
      queue.push(dep.toItemId);
    }
  }

  const order = trip.items.map((i) => i.id);
  const ids = (s: ImpactState) => order.filter((id) => states[id] === s);
  return {
    disruptedItemIds: ids("DISRUPTED"),
    affectedItemIds: ids("AFFECTED"),
    reasons,
    impactStates: states,
    disruptedTimings: { [disrupted.id]: disruptedTiming },
  };
}

/**
 * Returns why `dep.toItemId` is affected by its upstream item, or null if the dependency still holds.
 * `upstreamTiming` is only known for the directly disrupted item (undefined => upstream is merely AFFECTED,
 * so its own timing is unknown and the dependency is conservatively treated as changed).
 */
function reasonDependencyBreaks(
  trip: Trip,
  dep: Dependency,
  upstreamTiming: ItemTiming | null | undefined,
  upstreamIsDisrupted: boolean,
): string | null {
  const to = findItem(trip, dep.toItemId);
  if (!to) return null;

  if (dep.kind === "CONNECTION" && upstreamIsDisrupted) {
    if (upstreamTiming === null) return "Upstream service is cancelled, so the connection cannot be made.";
    const gap = diffMinutes(baselineTiming(to).startAt, upstreamTiming!.endAt);
    const buffer = dep.minimumBufferMinutes ?? 0;
    if (gap < 0) return "Connection is missed after the delay.";
    if (gap < buffer) return `Connection buffer falls to ${gap} min, below the required ${buffer} min.`;
    return null; // connection still holds: nothing downstream changes
  }

  switch (dep.kind) {
    case "WINDOW":
      return "Expected arrival shifts later.";
    case "TEMPORAL":
      return "Upstream item no longer finishes as scheduled.";
    case "LOCATION":
      return "Required location is no longer reached as planned.";
    case "CONNECTION":
      return "Upstream connection is no longer reliable.";
  }
}
