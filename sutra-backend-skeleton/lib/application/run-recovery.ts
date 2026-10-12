// Recovery Run orchestration (04_SYSTEM_ARCHITECTURE §7). The only place that sequences the stages.
// Pure TypeScript: no React, no Next.js, no HTTP.

import { RecoveryInputError, guardPort } from "../domain/errors";
import { analyzeImpact } from "../domain/impact";
import { buildCandidates } from "../domain/candidates";
import { validateAll } from "../domain/validation";
import { deterministicFallback, postValidateRecommendation } from "../domain/ranking";
import { buildActions, buildRecoveryPlan } from "../domain/plan";
import type { RecommendationProvider, TransportAdapter, TripRepository } from "../domain/ports";
import type { RecoveryRecommendation, RecoveryRunRequest, RecoveryRunResult } from "../domain/types";

export interface RecoveryDeps {
  trips: TripRepository;
  transport: TransportAdapter;
  /** Milestone 4. Omitted => every run uses the deterministic fallback. */
  recommender?: RecommendationProvider;
}

export async function runRecovery(req: RecoveryRunRequest, deps: RecoveryDeps): Promise<RecoveryRunResult> {
  // 1-3. Load the snapshot and resolve the disruption against it.
  const trip = await guardPort("TRIP_REPOSITORY_FAILED", () => deps.trips.getTrip(req.tripId));
  if (!trip) throw new RecoveryInputError("TRIP_NOT_FOUND", `Trip ${req.tripId} was not found.`);
  if (trip.version !== req.tripVersion) {
    throw new RecoveryInputError("STALE_TRIP_VERSION", `Trip ${trip.id} is at version ${trip.version}, request used ${req.tripVersion}.`);
  }

  // 4-5. Impact analysis (also validates the disruption).
  const impact = analyzeImpact(trip, req.disruption);
  if (impact.affectedItemIds.length === 0) {
    // OPEN QUESTION for the team: the freeze defines no "disruption with no downstream impact" outcome.
    // Rejecting is safer than fabricating RECOVERED / NO_FEASIBLE.
    throw new RecoveryInputError("DOMAIN_REJECTED", "This disruption has no downstream impact on the itinerary; no recovery is needed.");
  }

  // 6-7. Alternatives (adapter) -> candidates (domain).
  const alternatives = await guardPort("TRANSPORT_ADAPTER_FAILED", () =>
    deps.transport.findAlternatives({ trip, disruption: req.disruption, impact }),
  );
  const candidates = validateAll(trip, impact, buildCandidates(trip, req.disruption, impact, alternatives));

  // 8-9. Hard constraints. Zero feasible is a legitimate application result, not an error.
  const feasible = candidates.filter((c) => c.feasible);
  const runId = `run-${req.disruption.scenarioId}-v${trip.version}`; // deterministic: identical input => identical output
  const base = { runId, tripVersion: trip.version, impact, candidates };
  if (feasible.length === 0) {
    return { ...base, status: "NO_FEASIBLE_RECOVERY", recommendation: null, recoveryPlan: null, actions: [] };
  }

  // 10-12. AI sees feasible candidates only; anything it says is post-validated; otherwise deterministic fallback.
  let recommendation: RecoveryRecommendation | undefined;
  if (deps.recommender) {
    try {
      const draft = await deps.recommender.recommend({ trip, impact, feasibleCandidates: feasible });
      if (postValidateRecommendation(draft, feasible, trip, impact).ok) {
        recommendation = { ...draft, decisionSource: "AI" };
      }
    } catch {
      // AI unavailable / timed out / malformed: fall through. Never a technical error for the run.
    }
  }
  recommendation ??= deterministicFallback(feasible);

  // 13-14. Repaired itinerary and actions.
  const selected = feasible.find((c) => c.id === recommendation!.selectedCandidateId)!;
  const recoveryPlan = buildRecoveryPlan(trip, impact, selected);
  const actions = buildActions(recoveryPlan, trip, selected);

  return { ...base, status: "RECOVERED", recommendation, recoveryPlan, actions };
}
