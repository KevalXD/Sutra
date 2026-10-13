import { RecoveryInputError } from "../domain/errors";
import { goldenAlternatives } from "../domain/fixtures/golden-rail-delay-01";
import type { AlternativeQuery, TransportAdapter } from "../domain/ports";
import type { Alternative } from "../domain/types";

/** Deterministic offline rail catalogue keyed by scenarioId. Cancellation / infeasible / error scenarios arrive in M3. */
const CATALOGUE: Record<string, Alternative[]> = {
  "golden-rail-delay-01": goldenAlternatives,
};

export class SimulatedRailAdapter implements TransportAdapter {
  async findAlternatives({ disruption }: AlternativeQuery): Promise<Alternative[]> {
    const offers = CATALOGUE[disruption.scenarioId];
    if (!offers) {
      // An unknown scenario must not look like "no alternatives exist" (which would read as infeasible).
      throw new RecoveryInputError("DOMAIN_REJECTED", `Unknown simulation scenario ${disruption.scenarioId}.`);
    }
    return structuredClone(offers);
  }
}
