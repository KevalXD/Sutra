/**
 * Typed trip-only bridge for the frozen normalized rail contract. Recovery
 * results, recommendation, impact, and feasibility must come from the API.
 */
import { goldenTrip } from "@/lib/domain/fixtures/golden-rail-delay-01";
import type { ItineraryItem, Trip } from "@/lib/domain/types";
import type { Itinerary } from "@/lib/types";

const asBooking = (item: ItineraryItem) => {
  if (item.kind === "transport") {
    const first = item.legs[0];
    const last = item.legs[item.legs.length - 1];
    return {
      id: item.id,
      kind: "train" as const,
      origin: first?.origin ?? "",
      dest: last?.destination ?? "",
      start: first?.departureAt ?? first?.arrivalAt ?? "",
      end: last?.arrivalAt ?? "",
      cost: undefined,
    };
  }
  if (item.kind === "accommodation") {
    return { id: item.id, kind: "hotel" as const, origin: item.location, dest: item.location, start: item.checkInAt, end: item.checkOutAt, cost: undefined };
  }
  return { id: item.id, kind: "activity" as const, origin: item.location, dest: item.location, start: item.startsAt, end: item.endsAt, cost: undefined };
};

/** Projects only normalized trip facts, preserving transport/accommodation/activity distinctions. */
export function presentTrip(trip: Trip = goldenTrip): Itinerary {
  const firstTransport = trip.items.find((item) => item.kind === "transport");
  const destination = [...trip.items].reverse().find((item) => item.kind === "transport");
  const destinationName = destination?.kind === "transport" ? destination.legs.at(-1)?.destination ?? "Destination" : "Destination";
  return {
    id: trip.id,
    currency: trip.currency,
    bookings: trip.items.map(asBooking),
    constraints: {
      home: firstTransport?.kind === "transport" ? firstTransport.legs[0]?.origin ?? "" : "",
      maxExtraBudget: trip.constraints.maxExtraBudget ?? 0,
      noOvernight: trip.constraints.noOvernight,
      mustBeAt: trip.constraints.latestArrivalAt ? [{ label: "Latest acceptable arrival", city: destinationName, arriveBy: trip.constraints.latestArrivalAt }] : [],
    },
  };
}
