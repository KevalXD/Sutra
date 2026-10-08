// Ports: everything the domain/application needs from the outside world.
// Implementations live in lib/adapters and can be swapped (fake in tests, live later) without touching the domain.

import type {
  Alternative,
  Disruption,
  ImpactAnalysis,
  RecommendationDraft,
  Trip,
  ValidatedCandidate,
} from "./types";

export interface TripRepository {
  getTrip(tripId: string): Promise<Trip | null>;
}

export interface AlternativeQuery {
  trip: Trip;
  disruption: Disruption;
  impact: ImpactAnalysis;
}

/** Rail in Round 1; air/bus later. Returns normalized offers, never provider-specific shapes. */
export interface TransportAdapter {
  findAlternatives(query: AlternativeQuery): Promise<Alternative[]>;
}

/** Deliberately only carries FEASIBLE candidates: the AI is never asked to judge hard constraints. */
export interface RecommendationContext {
  trip: Trip;
  impact: ImpactAnalysis;
  feasibleCandidates: ValidatedCandidate[];
}

/** Milestone 4. Optional in the skeleton; absent => deterministic fallback. */
export interface RecommendationProvider {
  recommend(ctx: RecommendationContext): Promise<RecommendationDraft>;
}
