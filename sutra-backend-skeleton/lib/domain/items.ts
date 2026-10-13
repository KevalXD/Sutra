import type { ItemTiming, ItineraryItem, TransportBooking, Trip } from "./types";

export function findItem(trip: Trip, id: string): ItineraryItem | undefined {
  return trip.items.find((i) => i.id === id);
}

export const isTransport = (i: ItineraryItem): i is TransportBooking => i.kind === "transport";

/** Baseline timing of an item exactly as booked. */
export function baselineTiming(item: ItineraryItem): ItemTiming {
  switch (item.kind) {
    case "transport": {
      const legs = [...item.legs].sort((a, b) => a.departureAt.localeCompare(b.departureAt));
      const last = [...item.legs].sort((a, b) => a.arrivalAt.localeCompare(b.arrivalAt)).at(-1)!;
      return { startAt: legs[0].departureAt, endAt: last.arrivalAt };
    }
    case "accommodation":
      return { startAt: item.checkInAt, endAt: item.checkOutAt };
    case "activity":
      return { startAt: item.startsAt, endAt: item.endsAt };
  }
}

/** Latest arrival across all transport bookings, given a timing lookup. */
export function finalTransportArrival(
  trip: Trip,
  timings: Record<string, ItemTiming | null>,
): { itemId: string; arrivalAt: string } | undefined {
  let best: { itemId: string; arrivalAt: string } | undefined;
  for (const item of trip.items) {
    if (!isTransport(item)) continue;
    const t = timings[item.id];
    if (t && (!best || t.endAt > best.arrivalAt)) best = { itemId: item.id, arrivalAt: t.endAt };
  }
  return best;
}
