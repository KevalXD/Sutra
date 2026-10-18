import type { Alternative, Disruption, Trip } from "../types";

const DAY = "2026-12-04";

/** A distinct simulated journey with a downstream time-sensitive activity. */
export const coastalTrip: Trip = {
  id: "trip-coastal-rail-activity-01",
  version: 1,
  currency: "INR",
  items: [
    {
      id: "COASTAL-A",
      kind: "transport",
      label: "Coastal Rail A",
      mode: "rail",
      legs: [{ id: "COASTAL-A-LEG-1", bookingId: "COASTAL-A", origin: "Kochi Central", destination: "Alappuzha", departureAt: `${DAY}T08:00:00`, arrivalAt: `${DAY}T11:00:00` }],
    },
    {
      id: "COASTAL-B",
      kind: "transport",
      label: "Coastal Rail B",
      mode: "rail",
      legs: [{ id: "COASTAL-B-LEG-1", bookingId: "COASTAL-B", origin: "Alappuzha", destination: "Kollam", departureAt: `${DAY}T11:30:00`, arrivalAt: `${DAY}T13:30:00` }],
    },
    { id: "BACKWATER-TOUR", kind: "activity", label: "Backwater tour", location: "Kollam", startsAt: `${DAY}T15:00:00`, endsAt: `${DAY}T17:00:00` },
  ],
  dependencies: [
    { id: "DEP-COASTAL-A-COASTAL-B", fromItemId: "COASTAL-A", toItemId: "COASTAL-B", kind: "CONNECTION", minimumBufferMinutes: 30 },
    { id: "DEP-COASTAL-B-TOUR", fromItemId: "COASTAL-B", toItemId: "BACKWATER-TOUR", kind: "WINDOW" },
  ],
  constraints: { latestArrivalAt: `${DAY}T18:00:00`, maxExtraBudget: 400, noOvernight: true, softPreferences: ["EARLIER_ARRIVAL"] },
};

export const coastalDisruption: Disruption = { source: "SIMULATED", scenarioId: "coastal-rail-activity-01", bookingId: "COASTAL-A", kind: "delay", delayMinutes: 120 };

export const coastalAlternatives: Alternative[] = [
  { id: "CA-A-ALT", replacementForBookingId: "COASTAL-B", departureAt: `${DAY}T13:00:00`, arrivalAt: `${DAY}T15:00:00`, extraCost: 250, source: "SIMULATED_OFFER" },
  { id: "CA-B-ALT", replacementForBookingId: "COASTAL-B", departureAt: `${DAY}T14:00:00`, arrivalAt: `${DAY}T16:00:00`, extraCost: 150, source: "SIMULATED_OFFER" },
  { id: "CA-C-ALT", replacementForBookingId: "COASTAL-B", departureAt: `${DAY}T16:00:00`, arrivalAt: `${DAY}T18:00:00`, extraCost: 100, source: "SIMULATED_OFFER" },
];
