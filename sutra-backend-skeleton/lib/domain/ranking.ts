// Stage 4 - Selection policy. AI (Milestone 4) may only choose among FEASIBLE candidates, and its answer is
// post-validated here; the deterministic ranking is the safe fallback and never picks an infeasible candidate.

import { evaluateConstraints } from "./validation";
import type {
  ImpactAnalysis,
  RecommendationDraft,
  RecoveryRecommendation,
  Trip,
  ValidatedCandidate,
} from "./types";

const changeCount = (c: ValidatedCandidate) => Object.values(c.recoveryChanges).filter((r) => r !== "UNCHANGED").length;

/** fewest changes -> lower extra cost -> earlier arrival -> stable id (04_SYSTEM_ARCHITECTURE §10). */
export function rankFeasible(candidates: ValidatedCandidate[]): ValidatedCandidate[] {
  return candidates
    .filter((c) => c.feasible)
    .sort(
      (a, b) =>
        changeCount(a) - changeCount(b) ||
        a.extraCost - b.extraCost ||
        a.finalArrivalAt.localeCompare(b.finalArrivalAt) ||
        a.id.localeCompare(b.id),
    );
}

export function deterministicFallback(candidates: ValidatedCandidate[]): RecoveryRecommendation {
  const ranked = rankFeasible(candidates);
  if (ranked.length === 0) throw new Error("deterministicFallback requires at least one feasible candidate.");
  const best = ranked[0];
  return {
    selectedCandidateId: best.id,
    decisionSource: "DETERMINISTIC_FALLBACK",
    reason: `${best.id} needs the fewest changes (${changeCount(best)}), then the lowest extra cost (${best.extraCost}), among ${ranked.length} feasible candidate(s).`,
  };
}

export type PostValidation = { ok: true } | { ok: false; reason: string };

/**
 * Checks 1, 2, 3 and 5 of the freeze (§5 post-validation). Check 4 - "explanation must not contradict verified
 * facts" - is deliberately left to Milestone 4 together with the AI adapter.
 */
export function postValidateRecommendation(
  draft: RecommendationDraft,
  offered: ValidatedCandidate[],
  trip: Trip,
  impact: ImpactAnalysis,
): PostValidation {
  const chosen = offered.find((c) => c.id === draft.selectedCandidateId);
  if (!chosen) return { ok: false, reason: `Candidate ${String(draft.selectedCandidateId)} is not in the offered set.` };
  if (!chosen.feasible) return { ok: false, reason: `Candidate ${chosen.id} is not feasible.` };
  if (evaluateConstraints(trip, impact, chosen).some((e) => !e.passed)) {
    return { ok: false, reason: `Candidate ${chosen.id} fails an independent hard-constraint re-check.` };
  }
  if (typeof draft.reason !== "string" || draft.reason.trim() === "") return { ok: false, reason: "Missing explanation." };
  return { ok: true };
}
