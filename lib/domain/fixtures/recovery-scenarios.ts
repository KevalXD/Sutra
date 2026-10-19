import type { Alternative, Disruption, Trip } from "../types";
import { goldenAlternatives, goldenDisruption, goldenTrip } from "./golden-rail-delay-01";

const noFeasibleTrip: Trip = { ...structuredClone(goldenTrip), id: "trip-no-feasible-recovery-01" };
const cancellationDisruption: Disruption = { source: "SIMULATED", scenarioId: "rail-cancellation-01", bookingId: "RAIL-A", kind: "cancellation" };
const cancellationAlternatives: Alternative[] = [
  { id: "CC-A-ALT", replacementForBookingId: "RAIL-A", departureAt: "2026-11-10T09:30:00", arrivalAt: "2026-11-10T13:00:00", extraCost: 250, source: "SIMULATED_OFFER" },
  { id: "CC-B-ALT", replacementForBookingId: "RAIL-A", departureAt: "2026-11-10T11:30:00", arrivalAt: "2026-11-10T15:00:00", extraCost: 150, source: "SIMULATED_OFFER" },
  { id: "CC-C-ALT", replacementForBookingId: "RAIL-A", departureAt: "2026-11-10T09:15:00", arrivalAt: "2026-11-10T12:45:00", extraCost: 650, source: "SIMULATED_OFFER" },
];
const cancellationNoRecoveryDisruption: Disruption = { ...cancellationDisruption, scenarioId: "rail-cancellation-no-recovery-01" };
const cancellationNoRecoveryAlternatives: Alternative[] = [
  { id: "CN-A-ALT", replacementForBookingId: "RAIL-A", departureAt: "2026-11-10T12:00:00", arrivalAt: "2026-11-10T15:30:00", extraCost: 200, source: "SIMULATED_OFFER" },
  { id: "CN-B-ALT", replacementForBookingId: "RAIL-A", departureAt: "2026-11-10T09:15:00", arrivalAt: "2026-11-10T12:45:00", extraCost: 750, source: "SIMULATED_OFFER" },
];
const noFeasibleDisruption: Disruption = { ...goldenDisruption, scenarioId: "no-feasible-recovery-01" };
const noFeasibleAlternatives: Alternative[] = [
  { id: "NF-A-ALT", replacementForBookingId: "RAIL-B", departureAt: "2026-11-10T16:30:00", arrivalAt: "2026-11-10T19:30:00", extraCost: 200, source: "SIMULATED_OFFER" },
  { id: "NF-B-ALT", replacementForBookingId: "RAIL-B", departureAt: "2026-11-10T21:00:00", arrivalAt: "2026-11-10T23:30:00", extraCost: 150, source: "SIMULATED_OFFER" },
  { id: "NF-C-ALT", replacementForBookingId: "RAIL-B", departureAt: "2026-11-10T15:30:00", arrivalAt: "2026-11-10T17:45:00", extraCost: 700, source: "SIMULATED_OFFER" },
];
const technicalErrorDisruption: Disruption = { ...goldenDisruption, scenarioId: "technical-error-retry-01" };

export interface ScenarioFixture { id: string; trip: Trip; disruption: Disruption; alternatives: Alternative[]; failOnFirstAttempt?: true }
export const recoveryScenarios: readonly ScenarioFixture[] = [
  { id: goldenDisruption.scenarioId, trip: goldenTrip, disruption: goldenDisruption, alternatives: goldenAlternatives },
  { id: cancellationDisruption.scenarioId, trip: goldenTrip, disruption: cancellationDisruption, alternatives: cancellationAlternatives },
  { id: cancellationNoRecoveryDisruption.scenarioId, trip: goldenTrip, disruption: cancellationNoRecoveryDisruption, alternatives: cancellationNoRecoveryAlternatives },
  { id: noFeasibleDisruption.scenarioId, trip: noFeasibleTrip, disruption: noFeasibleDisruption, alternatives: noFeasibleAlternatives },
  { id: technicalErrorDisruption.scenarioId, trip: goldenTrip, disruption: technicalErrorDisruption, alternatives: goldenAlternatives, failOnFirstAttempt: true },
];
export const scenarioById = (id: string) => recoveryScenarios.find((scenario) => scenario.id === id);
export const tripById = (id: string) => recoveryScenarios.find((scenario) => scenario.trip.id === id)?.trip;
export const demoScenarioFor = (scenario: "delay" | "cancellation" | "infeasible" | "error") => scenarioById({ delay: goldenDisruption.scenarioId, cancellation: cancellationDisruption.scenarioId, infeasible: noFeasibleDisruption.scenarioId, error: technicalErrorDisruption.scenarioId }[scenario])!;
export const cancellationNoRecoveryScenario = scenarioById(cancellationNoRecoveryDisruption.scenarioId)!;
