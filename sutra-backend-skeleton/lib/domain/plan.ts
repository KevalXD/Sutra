// Stage 5 - Recovery plan and traveller actions. Original and repaired itineraries are both retained (§11).

import { baselineTiming, finalTransportArrival, isTransport } from "./items";
import { alternativeFor, repairedTimings } from "./repair";
import { clock, diffMinutes } from "./time";
import { evaluateConstraints } from "./validation";
import type {
  ImpactAnalysis,
  RecoveryPlan,
  RepairedItem,
  TravellerAction,
  Trip,
  ValidatedCandidate,
} from "./types";

export function buildRecoveryPlan(trip: Trip, impact: ImpactAnalysis, candidate: ValidatedCandidate): RecoveryPlan {
  const timings = repairedTimings(trip, impact, candidate);
  const baseline = Object.fromEntries(trip.items.map((i) => [i.id, baselineTiming(i)]));

  const items: RepairedItem[] = trip.items.map((item) => ({
    itemId: item.id,
    kind: item.kind,
    label: item.label,
    impactState: candidate.impactStates[item.id] ?? "UNCHANGED",
    recoveryChange: candidate.recoveryChanges[item.id] ?? "UNCHANGED",
    original: baseline[item.id],
    repaired: timings[item.id],
    ...(isTransport(item) && alternativeFor(candidate, item.id)
      ? { replacedByAlternativeId: alternativeFor(candidate, item.id)!.id }
      : {}),
  }));

  const originalFinal = finalTransportArrival(trip, baseline)!.arrivalAt;
  const repairedFinal = candidate.finalArrivalAt;
  return {
    selectedCandidateId: candidate.id,
    items,
    extraCost: candidate.extraCost,
    originalFinalArrivalAt: originalFinal,
    repairedFinalArrivalAt: repairedFinal,
    arrivalDeltaMinutes: diffMinutes(repairedFinal, originalFinal),
    constraintResults: evaluateConstraints(trip, impact, candidate),
  };
}

/** Deterministic, proposal-only actions. Nothing here is executed automatically. */
export function buildActions(plan: RecoveryPlan, trip: Trip, candidate: ValidatedCandidate): TravellerAction[] {
  const actions: TravellerAction[] = [];
  const next = () => `ACT-${actions.length + 1}`;
  const money = (n: number) => `${trip.currency} ${n}`;

  for (const item of plan.items) {
    const alt = alternativeFor(candidate, item.itemId);
    if (item.recoveryChange === "REPLACED" && alt) {
      const leg = (trip.items.find((i) => i.id === item.itemId) as { legs: { origin: string; destination: string }[] }).legs;
      actions.push({
        id: next(),
        kind: "BOOK_REPLACEMENT",
        itemId: item.itemId,
        automated: false,
        description: `Book replacement for ${item.label}: ${leg[0].origin} → ${leg[leg.length - 1].destination}, departs ${clock(alt.departureAt)}, arrives ${clock(alt.arrivalAt)} (extra ${money(alt.extraCost)}).`,
      });
    } else if (item.recoveryChange === "CANCELLED") {
      actions.push({ id: next(), kind: "REVIEW_CANCELLED_BOOKING", itemId: item.itemId, automated: false, description: `Review the cancelled booking ${item.label} with the operator.` });
    } else if (item.kind === "accommodation" && item.impactState === "AFFECTED" && item.repaired) {
      actions.push({
        id: next(),
        kind: "NOTIFY_ACCOMMODATION",
        itemId: item.itemId,
        automated: false,
        description: `Let ${item.label} know your arrival is now around ${clock(plan.repairedFinalArrivalAt)}; the booking itself stays valid.`,
      });
    }
  }
  return actions;
}
