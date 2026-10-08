import { goldenTrip } from "../domain/fixtures/golden-rail-delay-01";
import type { TripRepository } from "../domain/ports";
import type { Trip } from "../domain/types";

export class InMemoryTripRepository implements TripRepository {
  private readonly trips: Map<string, Trip>;
  constructor(trips: Trip[] = [goldenTrip]) {
    this.trips = new Map(trips.map((t) => [t.id, t]));
  }
  async getTrip(tripId: string): Promise<Trip | null> {
    const t = this.trips.get(tripId);
    return t ? structuredClone(t) : null; // callers can never mutate the stored baseline
  }
}
