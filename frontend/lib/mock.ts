// Deterministic SIMULATED demo data. Not live provider data. No Math.random.
import type { Booking, Constraints, Disruption, DisruptionAnalysis, Itinerary, RecoveryCandidate, ScenarioId, ConstraintViolation } from "./types";

const D = "2026-11-10";
const bk = (id: string, kind: Booking["kind"], origin: string, dest: string, s: string, e: string, cost: number, refundRate?: number): Booking =>
  ({ id, kind, origin, dest, start: s, end: e, cost, refundRate });
const F1 = bk("F1", "flight", "BLR", "DXB", `${D}T02:10:00`, `${D}T04:40:00`, 28000, 0.5);
const F2 = bk("F2", "flight", "DXB", "LHR", `${D}T06:30:00`, `${D}T11:00:00`, 42000, 0.5);
const F1d = bk("F1", "flight", "BLR", "DXB", `${D}T06:30:00`, `${D}T09:00:00`, 28000, 0.5); // F1 after 260-min delay
const H1 = bk("H1", "hotel", "LHR", "LHR", `${D}T14:00:00`, "2026-11-12T11:00:00", 36000, 0.8);
const constraints: Constraints = { home: "BLR", maxExtraBudget: 15000, noOvernight: true,
  mustBeAt: [{ label: "Client meeting", city: "LHR", arriveBy: `${D}T16:00:00` }] };
export const trip: Itinerary = { id: "trip-demo-001", currency: "INR", bookings: [F1, F2, H1], constraints };

const dis: Record<"delay" | "cancellation", Disruption> = {
  delay: { bookingId: "F1", kind: "delay", delayMin: 260 },
  cancellation: { bookingId: "F1", kind: "cancel" },
};
const key = (s: ScenarioId): "delay" | "cancellation" => (s === "cancellation" ? "cancellation" : "delay");
export const getDisruption = (s: ScenarioId) => dis[key(s)];

const analyses: Record<"delay" | "cancellation", DisruptionAnalysis> = {
  delay: { disruption: dis.delay, affectedBookingIds: ["F2", "H1"], impact: [
    { bookingId: "F1", reason: "delay", text: "F1 BLR→DXB now lands 09:00 instead of 04:40 (+4h 20m)." },
    { bookingId: "F2", reason: "connection", text: "F2 departs 06:30 — the connection is missed (60 min minimum)." },
    { bookingId: "H1", reason: "hotel", text: "Hotel check-in at 14:00 can no longer be met on the original plan." },
    { bookingId: "F2", reason: "deadline", text: "The 16:00 arrival deadline in London is at risk." } ] },
  cancellation: { disruption: dis.cancellation, affectedBookingIds: ["F2", "H1"], impact: [
    { bookingId: "F1", reason: "cancel", text: "F1 BLR→DXB is cancelled — the traveller cannot reach Dubai." },
    { bookingId: "F2", reason: "route", text: "F2 DXB→LHR has no inbound leg." },
    { bookingId: "H1", reason: "hotel", text: "Hotel arrival in London is no longer assured." } ] },
};
export const analysisFor = (s: ScenarioId) => analyses[key(s)];

const cand = (id: string, label: string, itinerary: Booking[], changes: number, extraCost: number, violations: ConstraintViolation[]): RecoveryCandidate => {
  const flights = itinerary.filter(b => b.kind === "flight");
  return { id, label, itinerary, changes, extraCost, violations, feasible: violations.length === 0,
    affectedBookingIds: ["F2", "H1"], explanation: "", arrival: flights[flights.length - 1].end };
};
const A = bk("F2-ALT-A", "flight", "DXB", "LHR", `${D}T10:15:00`, `${D}T14:45:00`, 51500);
const B = bk("F2-ALT-B", "flight", "DXB", "LHR", `${D}T12:00:00`, `${D}T16:30:00`, 48000);
const C = bk("F2-ALT-C", "flight", "DXB", "LHR", `${D}T10:30:00`, `${D}T15:00:00`, 60500);
const N1 = bk("F1-ALT", "flight", "BLR", "DXB", `${D}T03:00:00`, `${D}T05:30:00`, 31000);
const N2 = bk("F2-ALT-D", "flight", "DXB", "LHR", `${D}T07:45:00`, `${D}T12:15:00`, 46000);
const DIR = bk("FD-ALT", "flight", "BLR", "LHR", `${D}T05:00:00`, `${D}T15:30:00`, 91000);
const LATE = bk("F1-ALT-L", "flight", "BLR", "DXB", `${D}T06:00:00`, `${D}T08:30:00`, 30000);

const sets: Record<"delay" | "cancellation", RecoveryCandidate[]> = {
  delay: [
    cand("C1", "Rebook DXB→LHR onto the 10:15 departure", [F1d, A, H1], 1, 9500, []),
    cand("C2", "Rebook DXB→LHR onto the 12:00 departure", [F1d, B, H1], 1, 6000, [{ kind: "deadline", bookingId: "F2-ALT-B", message: "Arrival 16:30 is after the 16:00 deadline" }]),
    cand("C3", "Rebook DXB→LHR onto the 10:30 departure", [F1d, C, H1], 1, 18500, [{ kind: "budget", bookingId: "F2-ALT-C", message: "Extra cost 18,500 exceeds the maximum extra budget" }]),
  ],
  cancellation: [
    cand("C1", "Replace F1 and F2 with a rebooked Dubai route", [N1, N2, H1], 2, 7000, []),
    cand("C2", "Replace F1 and F2 with one direct flight", [DIR, H1], 2, 21000, [{ kind: "budget", bookingId: "FD-ALT", message: "Extra cost 21,000 exceeds the maximum extra budget" }]),
    cand("C3", "Replace F1 only, keep F2", [LATE, F2, H1], 1, 2000, [{ kind: "connection", bookingId: "F2", message: "Inbound lands 08:30, after F2 departs at 06:30" }]),
  ],
};

export const tripFor = (s: ScenarioId): Itinerary =>
  s === "infeasible" ? { ...trip, constraints: { ...constraints, maxExtraBudget: 5000 } } : trip;

export const candidatesFor = (s: ScenarioId): RecoveryCandidate[] => {
  const base = sets[key(s)];
  if (s !== "infeasible") return base;
  const cap = 5000;
  return base.map(c => {
    const v = [...c.violations];
    if (c.extraCost > cap && !v.some(x => x.kind === "budget"))
      v.push({ kind: "budget", bookingId: c.itinerary[1].id, message: `Extra cost ${c.extraCost.toLocaleString()} exceeds the maximum extra budget of 5,000` });
    return { ...c, violations: v, feasible: v.length === 0 };
  });
};
