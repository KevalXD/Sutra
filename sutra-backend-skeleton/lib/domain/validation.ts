// Stage 3 - Hard-constraint and dependency validation. The only authority on feasibility (§9).
// Pure and deterministic: no AI, no I/O. Also reused to independently re-check the final plan.

import { TechnicalFailure } from "./errors";
import { finalTransportArrival, findItem, isTransport } from "./items";
import { repairedTimings } from "./repair";
import { clock, diffMinutes, intersectsOvernight } from "./time";
import type {
  ConstraintEvaluation,
  ImpactAnalysis,
  ItemTiming,
  ItineraryItem,
  RecoveryCandidate,
  Trip,
  ValidatedCandidate,
} from "./types";

const SYMBOL: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
const money = (trip: Trip, n: number) => `${SYMBOL[trip.currency] ?? trip.currency + " "}${n}`;

/** Every rule that applies to this candidate, passed or failed. */
export function evaluateConstraints(trip: Trip, impact: ImpactAnalysis, c: RecoveryCandidate): ConstraintEvaluation[] {
  const timings = repairedTimings(trip, impact, c);
  const out: ConstraintEvaluation[] = [];
  const final = finalTransportArrival(trip, timings);
  const focusItem = c.alternatives[0]?.replacementForBookingId ?? impact.disruptedItemIds[0];
  const k = trip.constraints;

  // --- traveller hard constraints
  if (k.latestArrivalAt !== undefined) {
    const ok = !!final && final.arrivalAt <= k.latestArrivalAt;
    out.push({
      kind: "ARRIVAL_DEADLINE",
      itemId: final?.itemId ?? focusItem,
      passed: ok,
      message: ok
        ? `Final arrival at ${clock(final!.arrivalAt)} is within the ${clock(k.latestArrivalAt)} latest-arrival constraint.`
        : final
          ? `Final arrival at ${clock(final.arrivalAt)} exceeds the ${clock(k.latestArrivalAt)} latest-arrival constraint.`
          : "No transport reaches the destination, so the latest-arrival constraint cannot be met.",
    });
  }
  if (k.maxExtraBudget !== undefined) {
    const ok = c.extraCost <= k.maxExtraBudget;
    out.push({
      kind: "MAX_EXTRA_BUDGET",
      itemId: focusItem,
      passed: ok,
      message: ok
        ? `Extra cost of ${money(trip, c.extraCost)} is within the maximum recovery budget of ${money(trip, k.maxExtraBudget)}.`
        : `Extra cost of ${money(trip, c.extraCost)} exceeds the maximum recovery budget of ${money(trip, k.maxExtraBudget)}.`,
    });
  }
  if (k.noOvernight) {
    const night = trip.items.find((i) => {
      const t = timings[i.id];
      return isTransport(i) && t && intersectsOvernight(t.startAt, t.endAt);
    });
    out.push({
      kind: "NO_OVERNIGHT",
      itemId: night?.id ?? focusItem,
      passed: !night,
      message: night
        ? "Recovery requires overnight travel while overnight travel is prohibited."
        : "No travel falls in the 23:00-05:00 overnight window.",
    });
  }

  // --- itinerary dependencies must remain valid
  for (const dep of trip.dependencies) {
    const from = timings[dep.fromItemId];
    const to = timings[dep.toItemId];
    const toItem = findItem(trip, dep.toItemId)!;
    const label = `${dep.fromItemId} → ${dep.toItemId}`;
    const broken = (kind: "CONNECTION" | "WINDOW", message: string) =>
      out.push({ kind, itemId: dep.toItemId, passed: false, message });

    switch (dep.kind) {
      case "CONNECTION": {
        if (!from || !to) { broken("CONNECTION", `Connection ${label} cannot be made: a service no longer runs.`); break; }
        const gap = diffMinutes(to.startAt, from.endAt);
        const need = dep.minimumBufferMinutes ?? 0;
        out.push({
          kind: "CONNECTION",
          itemId: dep.toItemId,
          passed: gap >= need,
          message: gap >= need
            ? `Connection ${label} keeps a ${gap}-minute buffer (minimum ${need}).`
            : `Connection ${label} leaves ${gap} minutes, below the required ${need}.`,
        });
        break;
      }
      case "WINDOW": {
        // Late arrival is acceptable while the commitment's window is still open.
        if (!from) { broken("WINDOW", `${label}: upstream item no longer exists.`); break; }
        const closes = windowCloses(toItem, to);
        const ok = from.endAt <= closes;
        out.push({
          kind: "WINDOW",
          itemId: dep.toItemId,
          passed: ok,
          message: ok
            ? `Arrival at ${clock(from.endAt)} is still inside the ${toItem.label} window.`
            : `Arrival at ${clock(from.endAt)} is after the ${toItem.label} window closes.`,
        });
        break;
      }
      case "TEMPORAL": {
        if (!from || !to) { broken("CONNECTION", `${label}: an item no longer exists.`); break; }
        const ok = from.endAt <= to.startAt;
        out.push({ kind: "CONNECTION", itemId: dep.toItemId, passed: ok, message: ok ? `${label} stays in order.` : `${label} would overlap.` });
        break;
      }
      case "LOCATION":
        // Refuse to silently pass a rule we cannot evaluate yet.
        throw new TechnicalFailure("UNSUPPORTED_DEPENDENCY", "LOCATION dependencies are not evaluated in Round 1.");
    }
  }
  return out;
}

/** Last moment the downstream commitment can still be joined. */
function windowCloses(item: ItineraryItem, timing: ItemTiming | null): string {
  if (item.kind === "accommodation") return item.checkOutAt;
  if (item.kind === "activity") return item.startsAt;
  return timing?.startAt ?? "";
}

export function validateCandidate(trip: Trip, impact: ImpactAnalysis, c: RecoveryCandidate): ValidatedCandidate {
  const violations = evaluateConstraints(trip, impact, c)
    .filter((e) => !e.passed)
    .map(({ kind, itemId, message }) => ({ kind, itemId, message }));
  return { ...c, feasible: violations.length === 0, violations };
}

export const validateAll = (trip: Trip, impact: ImpactAnalysis, cs: RecoveryCandidate[]): ValidatedCandidate[] =>
  cs.map((c) => validateCandidate(trip, impact, c));
