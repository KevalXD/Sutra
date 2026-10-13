import { InMemoryTripRepository } from "../adapters/in-memory-trip-repository";
import { SimulatedRailAdapter } from "../adapters/simulated-rail-adapter";
import type { RecoveryDeps } from "./run-recovery";

/** Round 1 composition root. Swap adapters here (AI provider arrives in M4). */
export const defaultDeps = (): RecoveryDeps => ({
  trips: new InMemoryTripRepository(),
  transport: new SimulatedRailAdapter(),
});
