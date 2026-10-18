import type { ApiError, Booking, Constraints, Disruption, DisruptionAnalysis, Itinerary, RecoveryCandidate, RecoveryResult, ScenarioId, ViolationKind } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE;
const TRIP_ID = process.env.NEXT_PUBLIC_TRIP_ID;

export class SutraApiError extends Error {
  constructor(public error: ApiError) { super(error.message); }
}

function requireConfig() {
  if (!BASE || !TRIP_ID) throw new SutraApiError({ code: "FRONTEND_CONFIGURATION_ERROR", message: "Live API configuration is missing." });
  return { base: BASE, tripId: TRIP_ID };
}

async function call<T>(path: string, fallback: ApiError, init?: RequestInit): Promise<T> {
  const configuration = requireConfig();
  let response: Response;
  try { response = await fetch(new URL(path, configuration.base).toString(), { ...init, credentials: "include", cache: "no-store" }); }
  catch { throw new SutraApiError(fallback); }
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string | { code?: string; message?: string } } | null;
    const error = typeof payload?.error === "object" ? payload.error : undefined;
    throw new SutraApiError({ code: error?.code ?? "LIVE_BACKEND_ERROR", message: error?.message ?? (typeof payload?.error === "string" ? payload.error : fallback.message) });
  }
  return response.json() as Promise<T>;
}

type LiveTrip = { id: string; version: number; currency: string; items: Array<Record<string, unknown>>; constraints: { latestArrivalAt?: string; maxExtraBudget?: number; noOvernight: boolean; softPreferences?: string[] } };
type LiveRecovery = { status: "RECOVERED" | "NO_FEASIBLE_RECOVERY" | "TECHNICAL_ERROR"; tripVersion: number; candidates: Array<Record<string, unknown>>; recommendation: { selectedCandidateId: string; decisionSource: "AI" | "DETERMINISTIC_FALLBACK"; reason: string } | null; recoveryPlan: Record<string, unknown> | null; };
type LiveDisruptionAnalysis = { disruption: { bookingId: string; kind: "delay" | "cancel"; delayMin?: number } | null; affectedBookingIds: string[]; impact: Array<{ itemId?: string; reason?: string; text?: string }> };

function itemToBooking(item: Record<string, unknown>): Booking {
  if (item.kind === "accommodation") return { id: String(item.id), kind: "hotel", origin: String(item.location), dest: String(item.location), start: String(item.checkInAt), end: String(item.checkOutAt), cost: Number(item.cost ?? 0) };
  const legs = Array.isArray(item.legs) ? item.legs as Array<Record<string, unknown>> : [];
  const leg = legs[0] ?? {};
  return { id: String(item.id), kind: "train", origin: String(leg.origin ?? ""), dest: String(leg.destination ?? ""), start: String(leg.departureAt ?? ""), end: String(leg.arrivalAt ?? ""), cost: Number(item.cost ?? 0) };
}

function tripToUi(trip: LiveTrip): Itinerary {
  const goal = trip.constraints.latestArrivalAt ? [{ label: "Destination arrival", city: "Destination", arriveBy: trip.constraints.latestArrivalAt }] : undefined;
  const constraints: Constraints = { home: trip.items.length ? String((trip.items[0] as Record<string, unknown>).label ?? "") : "", maxExtraBudget: trip.constraints.maxExtraBudget ?? 0, noOvernight: trip.constraints.noOvernight, mustBeAt: goal };
  return { id: trip.id, version: trip.version, currency: trip.currency, bookings: trip.items.map(itemToBooking), constraints };
}

function candidateToUi(candidate: Record<string, unknown>, original: Itinerary): RecoveryCandidate {
  const violations = Array.isArray(candidate.violations) ? candidate.violations as Array<Record<string, unknown>> : [];
  const items = Array.isArray(candidate.itinerary) ? candidate.itinerary.map(item => itemToBooking(item as Record<string, unknown>)) : original.bookings;
  const toViolationKind = (kind: string): ViolationKind => {
    const mapping: Record<string, ViolationKind> = {
      ARRIVAL_DEADLINE: "deadline",
      MAX_EXTRA_BUDGET: "budget",
      NO_OVERNIGHT: "overnight",
      CONNECTION: "connection",
      CHRONOLOGY: "hotel",
      IDENTITY: "route",
      deadline: "deadline",
      budget: "budget",
      overnight: "overnight",
      connection: "connection",
      hotel: "hotel",
      route: "route",
    };
    return mapping[kind] ?? "route";
  }
  return { id: String(candidate.id), label: String(candidate.label ?? ("Provider recovery " + String(candidate.id))), itinerary: items, changes: Object.values((candidate.recoveryChanges ?? {}) as Record<string, unknown>).filter(value => value !== "UNCHANGED").length, extraCost: Number(candidate.extraCost ?? 0), feasible: Boolean(candidate.feasible), violations: violations.map(v => ({ kind: toViolationKind(String(v.kind)), bookingId: String(v.itemId), message: String(v.message) })), affectedBookingIds: [], explanation: "", arrival: String(candidate.finalArrivalAt ?? "") };
}

export const getTrip = async (scenario: ScenarioId, attempt: number) => { void scenario; void attempt; return tripToUi(await call<LiveTrip>("/v1/trips/" + TRIP_ID, { code: "ITINERARY_LOAD_FAILED", message: "The live journey could not be loaded." })); };
export const postDisruption = async (scenario: ScenarioId): Promise<DisruptionAnalysis> => {
  const data = await call<LiveDisruptionAnalysis>("/v1/trips/" + TRIP_ID + "/disruptions?scenario=" + encodeURIComponent(scenario), { code: "INVALID_DISRUPTION", message: "No live disruption could be loaded." });
  if (!data.disruption) throw new SutraApiError({ code: "NO_LIVE_DISRUPTION", message: "No live disruption is currently available for this journey." });
  return { disruption: data.disruption as Disruption, affectedBookingIds: data.affectedBookingIds, impact: data.impact.map(step => ({ bookingId: String(step.itemId ?? ""), reason: "connection", text: String(step.text ?? step.reason ?? "") })) };
};
export const postRecovery = async (trip: Itinerary, disruption?: Disruption, scenario: ScenarioId = "delay") => {
  const live = await call<LiveRecovery>("/v1/recovery-runs", { code: "RECOVERY_SERVICE_UNAVAILABLE", message: "Live recovery could not be calculated." }, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tripId: trip.id, tripVersion: trip.version ?? 1, disruption: disruption ? { ...disruption, source: "SIMULATED", scenarioId: scenario } : undefined }) });
  const candidates = live.candidates.map(candidate => candidateToUi(candidate, trip));
  const plan = live.recoveryPlan as Record<string, unknown> | null;
  const result: RecoveryResult = plan ? { feasible: live.status === "RECOVERED", itinerary: candidates.find(c => c.id === live.recommendation?.selectedCandidateId)?.itinerary ?? trip.bookings, changes: Object.values((plan.changes ?? {}) as Record<string, unknown>).filter(value => value !== "UNCHANGED").length, extraCost: Number(plan.extraCost ?? 0), violations: [], explanation: live.recommendation?.reason ?? "Live recovery completed.", affectedBookingIds: [] } : { feasible: false, itinerary: [], changes: 0, extraCost: 0, violations: candidates.flatMap(c => c.violations), explanation: "No feasible live recovery exists.", affectedBookingIds: [] };
  return { candidates, selectedId: live.recommendation?.selectedCandidateId, result };
};
