// Centralized formatting. Data layer keeps timezone-less ISO strings; the UI formats them
// WITHOUT going through Date/timezone conversion (fixes the earlier off-by-one-day bug).
import type { Booking, Diff, ViolationKind } from "./types";

export const formatMoney = (n: number, currency: string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
export const hm = (iso: string) => iso.slice(11, 16);
export const day = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
};
export const fmtDuration = (min: number) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;

/** Shift a timezone-less ISO string by N minutes (pure arithmetic, no timezone). */
export function shiftIso(iso: string, min: number): string {
  const [y, mo, d] = iso.slice(0, 10).split("-").map(Number);
  const total = Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16)) + min;
  const dayShift = Math.floor(total / 1440);
  const m = ((total % 1440) + 1440) % 1440;
  const date = new Date(Date.UTC(y, mo - 1, d + dayShift)).toISOString().slice(0, 10);
  return `${date}T${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`;
}

export const violationLabel: Record<ViolationKind, string> = {
  route: "Route continuity", connection: "Minimum connection (60 min)", hotel: "Hotel check-in",
  overnight: "No overnight (23:00–05:00)", deadline: "Arrival deadline", budget: "Extra budget",
};

/** Presentation diff of a booking vs the original itinerary. */
export function diffOf(b: Booking, original: Booking[], affectedIds: string[]): Diff {
  const o = original.find(x => x.id === b.id);
  if (!o) return "NEW";
  if (o.start !== b.start || o.end !== b.end) return "CHANGED";
  return affectedIds.includes(b.id) ? "AFFECTED" : "UNCHANGED";
}

const toMinutes = (iso: string) =>
  Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), Number(iso.slice(11, 13)), Number(iso.slice(14, 16))) / 60000;

/** Layover (minutes) between consecutive legs that share a city. Derived from booking times only. */
export function layovers(bookings: Booking[]): { city: string; minutes: number }[] {
  const legs = bookings.filter(b => b.kind !== "hotel");
  const out: { city: string; minutes: number }[] = [];
  for (let i = 1; i < legs.length; i++) {
    if (legs[i - 1].dest === legs[i].origin) out.push({ city: legs[i].origin, minutes: toMinutes(legs[i].start) - toMinutes(legs[i - 1].end) });
  }
  return out;
}
