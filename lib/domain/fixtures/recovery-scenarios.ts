import type { Alternative, Disruption, SupportedDisruptionProfile, Trip } from "../types";
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

const bengaluruTrip: Trip = {
  id: "trip-mangaluru-bengaluru-01", version: 1, currency: "INR",
  items: [
    { id: "RAIL-C", kind: "transport", label: "Rail C", mode: "rail", legs: [{ id: "RAIL-C-LEG-1", bookingId: "RAIL-C", origin: "Mangaluru Central", destination: "Hassan Junction", originLocationId: "station:mangaluru-central", destinationLocationId: "station:hassan-junction", departureAt: "2026-11-12T08:00:00", arrivalAt: "2026-11-12T12:00:00" }] },
    { id: "RAIL-D", kind: "transport", label: "Rail D", mode: "rail", legs: [{ id: "RAIL-D-LEG-1", bookingId: "RAIL-D", origin: "Hassan Junction", destination: "Bengaluru City", originLocationId: "station:hassan-junction", destinationLocationId: "city:bengaluru", departureAt: "2026-11-12T12:45:00", arrivalAt: "2026-11-12T16:00:00" }] },
    { id: "ACTIVITY-1", kind: "activity", label: "Bengaluru activity", location: "Bengaluru City", locationId: "city:bengaluru", startsAt: "2026-11-12T18:30:00", endsAt: "2026-11-12T20:00:00" },
    { id: "HOTEL-2", kind: "accommodation", label: "Bengaluru Hotel", location: "Bengaluru City", locationId: "city:bengaluru", checkInAt: "2026-11-12T20:30:00", checkOutAt: "2026-11-13T10:00:00" },
  ],
  dependencies: [
    { id: "DEP-RAIL-C-RAIL-D", fromItemId: "RAIL-C", toItemId: "RAIL-D", kind: "CONNECTION", minimumBufferMinutes: 30 },
    { id: "DEP-RAIL-C-RAIL-D-LOCATION", fromItemId: "RAIL-C", toItemId: "RAIL-D", kind: "LOCATION" },
    { id: "DEP-RAIL-D-ACTIVITY-LOCATION", fromItemId: "RAIL-D", toItemId: "ACTIVITY-1", kind: "LOCATION" },
    { id: "DEP-RAIL-D-ACTIVITY-WINDOW", fromItemId: "RAIL-D", toItemId: "ACTIVITY-1", kind: "WINDOW", arrivalWindow: { latestAt: "2026-11-12T18:00:00" } },
    { id: "DEP-ACTIVITY-HOTEL-TEMPORAL", fromItemId: "ACTIVITY-1", toItemId: "HOTEL-2", kind: "TEMPORAL" },
  ],
  constraints: { latestArrivalAt: "2026-11-12T19:00:00", maxExtraBudget: 400, noOvernight: true, softPreferences: ["EARLIER_ARRIVAL"] },
};
const bengaluruDisruption: Disruption = { source: "SIMULATED", scenarioId: "mangaluru-bengaluru-delay-01", bookingId: "RAIL-C", kind: "delay", delayMinutes: 90 };
const bengaluruAlternatives: Alternative[] = [
  { id: "MB-A-ALT", replacementForBookingId: "RAIL-D", departureAt: "2026-11-12T13:00:00", arrivalAt: "2026-11-12T16:15:00", extraCost: 350, source: "SIMULATED_OFFER" },
  { id: "MB-B-ALT", replacementForBookingId: "RAIL-D", departureAt: "2026-11-12T14:30:00", arrivalAt: "2026-11-12T17:30:00", extraCost: 250, source: "SIMULATED_OFFER" },
  { id: "MB-C-ALT", replacementForBookingId: "RAIL-D", departureAt: "2026-11-12T15:30:00", arrivalAt: "2026-11-12T19:30:00", extraCost: 100, source: "SIMULATED_OFFER" },
];

export interface ScenarioFixture { id: string; trip: Trip; disruption: Disruption; alternatives: Alternative[]; profile?: SupportedDisruptionProfile; failOnFirstAttempt?: true }
export const recoveryScenarios: readonly ScenarioFixture[] = [
  { id: goldenDisruption.scenarioId, trip: goldenTrip, disruption: goldenDisruption, alternatives: goldenAlternatives, profile: { id: goldenDisruption.scenarioId, label: "Rail A delay", bookingId: "RAIL-A", bookingLabel: "Rail A", kind: "delay", delayRange: { minimumMinutes: 30, maximumMinutes: 180, stepMinutes: 30 } } },
  { id: cancellationDisruption.scenarioId, trip: goldenTrip, disruption: cancellationDisruption, alternatives: cancellationAlternatives, profile: { id: cancellationDisruption.scenarioId, label: "Rail A cancellation", bookingId: "RAIL-A", bookingLabel: "Rail A", kind: "cancellation" } },
  { id: cancellationNoRecoveryDisruption.scenarioId, trip: goldenTrip, disruption: cancellationNoRecoveryDisruption, alternatives: cancellationNoRecoveryAlternatives },
  { id: noFeasibleDisruption.scenarioId, trip: noFeasibleTrip, disruption: noFeasibleDisruption, alternatives: noFeasibleAlternatives },
  { id: technicalErrorDisruption.scenarioId, trip: goldenTrip, disruption: technicalErrorDisruption, alternatives: goldenAlternatives, failOnFirstAttempt: true },
  { id: bengaluruDisruption.scenarioId, trip: bengaluruTrip, disruption: bengaluruDisruption, alternatives: bengaluruAlternatives, profile: { id: bengaluruDisruption.scenarioId, label: "Rail C delay", bookingId: "RAIL-C", bookingLabel: "Rail C", kind: "delay", delayRange: { minimumMinutes: 30, maximumMinutes: 180, stepMinutes: 30 } } },
];
export const scenarioById = (id: string) => recoveryScenarios.find((scenario) => scenario.id === id);
export const tripById = (id: string) => recoveryScenarios.find((scenario) => scenario.trip.id === id)?.trip;
export const demoScenarioFor = (scenario: "delay" | "cancellation" | "infeasible" | "error") => scenarioById({ delay: goldenDisruption.scenarioId, cancellation: cancellationDisruption.scenarioId, infeasible: noFeasibleDisruption.scenarioId, error: technicalErrorDisruption.scenarioId }[scenario])!;
export const cancellationNoRecoveryScenario = scenarioById(cancellationNoRecoveryDisruption.scenarioId)!;
export const supportedScenarios = () => recoveryScenarios.filter((scenario): scenario is ScenarioFixture & { profile: SupportedDisruptionProfile } => Boolean(scenario.profile));
