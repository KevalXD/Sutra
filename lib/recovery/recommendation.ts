import type { RecoveryPriority, RecoveryRecommendation, SoftPreference, Trip, ValidatedRecoveryCandidate } from "@/lib/domain/types";

export interface RecommendationDraft {
  selectedCandidateId: string;
  preference: SoftPreference;
  comparedCandidateId?: string;
  /** Provider-supplied objective claims are checked before any AI label is accepted. */
  facts: {
    selectedArrivalAt: string;
    selectedExtraCost: number;
    comparedArrivalAt?: string;
    comparedExtraCost?: number;
  };
  /** Free-form prose is deliberately unsupported: it cannot be presented as verified fact. */
  reason?: string;
  tradeoffs?: string[];
}

/** Shared strict output contract used by every provider adapter. */
export const recommendationJsonSchema = {
  type: "object", additionalProperties: false,
  required: ["selectedCandidateId", "preference", "comparedCandidateId", "facts"],
  properties: {
    selectedCandidateId: { type: "string" },
    preference: { type: "string", enum: ["LOWER_COST", "EARLIER_ARRIVAL", "FEWER_CHANGES", "PRESERVE_ITINERARY"] },
    comparedCandidateId: { anyOf: [{ type: "string" }, { type: "null" }] },
    facts: { type: "object", additionalProperties: false, required: ["selectedArrivalAt", "selectedExtraCost", "comparedArrivalAt", "comparedExtraCost"], properties: { selectedArrivalAt: { type: "string" }, selectedExtraCost: { type: "number" }, comparedArrivalAt: { anyOf: [{ type: "string" }, { type: "null" }] }, comparedExtraCost: { anyOf: [{ type: "number" }, { type: "null" }] } } },
  },
};

export const recommendationContext = (trip: Trip, impact: import("@/lib/domain/types").ImpactAnalysis, candidates: ValidatedRecoveryCandidate[], activePriority?: RecoveryPriority) => ({
  travellerPreferences: trip.constraints.softPreferences ?? [],
  ...(activePriority ? { activePriority } : {}),
  impact: { disruptedItemIds: impact.disruptedItemIds, affectedItemIds: impact.affectedItemIds },
  feasibleCandidates: candidates.map((candidate) => ({ id: candidate.id, finalArrivalAt: candidate.finalArrivalAt, extraCost: candidate.extraCost, replacementOfferIds: candidate.alternatives.map((offer) => offer.id) })),
});

const validPreference = (trip: Trip, preference: unknown, activePriority?: RecoveryPriority): preference is SoftPreference =>
  typeof preference === "string" && (activePriority ? preference === "LOWER_COST" || preference === "EARLIER_ARRIVAL" : trip.constraints.softPreferences?.includes(preference as SoftPreference) === true);

const price = (value: number, currency: string) => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
const clock = (value: string) => value.slice(11, 16);

/** Converts a strictly verified structured AI choice into UI-safe prose. */
export type RecommendationRejection = "INVALID_DRAFT" | "UNSUPPORTED_PREFERENCE" | "PRIORITY_MISMATCH" | "NON_OPTIMAL_PRIORITY_SELECTION" | "UNVERIFIED_PROSE" | "INVALID_SELECTED_CANDIDATE" | "SELECTED_FACT_MISMATCH" | "INVALID_COMPARISON" | "COMPARISON_FACT_MISMATCH";
export function validateAiRecommendation(trip: Trip, candidates: ValidatedRecoveryCandidate[], draft: RecommendationDraft, activePriority?: RecoveryPriority): { recommendation?: RecoveryRecommendation; rejection?: RecommendationRejection } {
  if (!draft || typeof draft !== "object" || typeof draft.selectedCandidateId !== "string") return { rejection: "INVALID_DRAFT" };
  if (!validPreference(trip, draft.preference, activePriority)) return { rejection: "UNSUPPORTED_PREFERENCE" };
  if (activePriority && draft.preference !== activePriority) return { rejection: "PRIORITY_MISMATCH" };
  // Do not accept an unvalidated paragraph as an explanation source.
  if (draft.reason !== undefined || draft.tradeoffs !== undefined) return { rejection: "UNVERIFIED_PROSE" };
  const selected = candidates.find((candidate) => candidate.id === draft.selectedCandidateId && candidate.feasible);
  if (!selected) return { rejection: "INVALID_SELECTED_CANDIDATE" };
  if (activePriority) {
    const best = [...candidates].filter((candidate) => candidate.feasible).sort((a, b) => activePriority === "EARLIER_ARRIVAL" ? a.finalArrivalAt.localeCompare(b.finalArrivalAt) || a.extraCost - b.extraCost || a.id.localeCompare(b.id) : a.extraCost - b.extraCost || a.finalArrivalAt.localeCompare(b.finalArrivalAt) || a.id.localeCompare(b.id))[0];
    if (selected.id !== best?.id) return { rejection: "NON_OPTIMAL_PRIORITY_SELECTION" };
  }
  if (!draft.facts || draft.facts.selectedArrivalAt !== selected.finalArrivalAt || draft.facts.selectedExtraCost !== selected.extraCost) return { rejection: "SELECTED_FACT_MISMATCH" };
  const compared = draft.comparedCandidateId === undefined ? undefined : candidates.find((candidate) => candidate.id === draft.comparedCandidateId && candidate.feasible);
  if (draft.comparedCandidateId !== undefined && (!compared || compared.id === selected.id)) return { rejection: "INVALID_COMPARISON" };
  if (compared && (draft.facts.comparedArrivalAt !== compared.finalArrivalAt || draft.facts.comparedExtraCost !== compared.extraCost)) return { rejection: "COMPARISON_FACT_MISMATCH" };

  const selectedFacts = `${selected.id} arrives at ${clock(selected.finalArrivalAt)} with ${price(selected.extraCost, trip.currency)} additional cost`;
  if (!compared) return { recommendation: { selectedCandidateId: selected.id, decisionSource: "AI", reason: `${selectedFacts}. It matches the traveller's ${draft.preference.toLowerCase().replaceAll("_", " ")} preference.`, tradeoffs: [] } };
  const arrivalDelta = Math.round((Date.parse(`${compared.finalArrivalAt}Z`) - Date.parse(`${selected.finalArrivalAt}Z`)) / 60000);
  const costDelta = selected.extraCost - compared.extraCost;
  const tradeoffs = [
    `${selected.id} arrives ${Math.abs(arrivalDelta)} minutes ${arrivalDelta >= 0 ? "earlier" : "later"} than ${compared.id}.`,
    `${selected.id} costs ${price(Math.abs(costDelta), trip.currency)} ${costDelta >= 0 ? "more" : "less"} than ${compared.id}.`,
  ];
  return { recommendation: { selectedCandidateId: selected.id, decisionSource: "AI", reason: `${selectedFacts}. The AI selected it for the ${draft.preference.toLowerCase().replaceAll("_", " ")} preference; verified trade-offs are shown below.`, tradeoffs } };
}
