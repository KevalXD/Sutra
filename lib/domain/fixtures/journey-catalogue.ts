import type { DisruptionKind, Trip } from "../types";
import { coastalAlternatives, coastalDisruption, coastalTrip } from "./coastal-rail-activity-01";
import { goldenAlternatives, goldenDisruption, goldenTrip } from "./golden-rail-delay-01";
import { recoveryScenarios } from "./recovery-scenarios";

export const SUPPORTED_DELAY_MINUTES = [30, 60, 90, 120, 150, 180] as const;

export interface JourneyDisruptionProfile {
  id: string;
  trip: Trip;
  bookingId: string;
  kind: DisruptionKind;
  supportedDelayMinutes?: readonly number[];
  alternatives: typeof goldenAlternatives;
  simulated: true;
  displayName: string;
}

const profile = (value: Omit<JourneyDisruptionProfile, "simulated">): JourneyDisruptionProfile => ({ ...value, simulated: true });

export const journeyProfiles: readonly JourneyDisruptionProfile[] = [
  profile({ id: goldenDisruption.scenarioId!, trip: goldenTrip, bookingId: "RAIL-A", kind: "delay", supportedDelayMinutes: SUPPORTED_DELAY_MINUTES, alternatives: goldenAlternatives, displayName: "Mangaluru to Mysuru rail journey" }),
  profile({ id: "rail-cancellation-01", trip: goldenTrip, bookingId: "RAIL-A", kind: "cancellation", alternatives: recoveryScenarios.find((value) => value.id === "rail-cancellation-01")!.alternatives, displayName: "Mangaluru to Mysuru rail journey" }),
  profile({ id: coastalDisruption.scenarioId!, trip: coastalTrip, bookingId: coastalDisruption.bookingId, kind: "delay", supportedDelayMinutes: SUPPORTED_DELAY_MINUTES, alternatives: coastalAlternatives, displayName: "Kochi to Kollam coastal journey" }),
];

export interface JourneyCatalogueEntry {
  tripId: string;
  version: number;
  displayName: string;
  origin: string;
  destination: string;
  transportItems: { id: string; label: string }[];
  supportedDisruptions: { bookingId: string; kind: DisruptionKind; delayMinutes: readonly number[] }[];
  simulated: true;
}

export const catalogue = (): JourneyCatalogueEntry[] => {
  const byTrip = new Map<string, JourneyCatalogueEntry>();
  for (const value of journeyProfiles) {
    const transportItems = value.trip.items.filter((item) => item.kind === "transport").map((item) => ({ id: item.id, label: item.label }));
    const first = value.trip.items.find((item) => item.kind === "transport");
    const last = value.trip.items.filter((item) => item.kind === "transport").at(-1);
    const entry = byTrip.get(value.trip.id) ?? { tripId: value.trip.id, version: value.trip.version, displayName: value.displayName, origin: first?.kind === "transport" ? first.legs[0].origin : "Unknown", destination: last?.kind === "transport" ? last.legs.at(-1)!.destination : "Unknown", transportItems, supportedDisruptions: [], simulated: true };
    const existing = entry.supportedDisruptions.find((item) => item.bookingId === value.bookingId && item.kind === value.kind);
    if (!existing) entry.supportedDisruptions.push({ bookingId: value.bookingId, kind: value.kind, delayMinutes: value.supportedDelayMinutes ?? [] });
    byTrip.set(value.trip.id, entry);
  }
  return [...byTrip.values()];
};

export function profileForInput(input: { tripId: string; bookingId: string; kind: DisruptionKind; delayMinutes?: number; scenarioId?: string }) {
  const value = input.scenarioId
    ? journeyProfiles.find((candidate) => candidate.id === input.scenarioId)
    : journeyProfiles.find((candidate) => candidate.trip.id === input.tripId && candidate.bookingId === input.bookingId && candidate.kind === input.kind);
  if (!value || value.trip.id !== input.tripId) return undefined;
  if (value.kind === "cancellation" && input.delayMinutes !== undefined) return undefined;
  if (value.kind === "delay" && (!value.supportedDelayMinutes?.includes(input.delayMinutes ?? -1))) return undefined;
  return value;
}
