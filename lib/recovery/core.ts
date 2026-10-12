import { scenarioById, tripById } from "@/lib/domain/fixtures/recovery-scenarios";
import type { Alternative, ConstraintEvaluation, ConstraintViolation, Disruption, GeneratedRecoveryCandidate, ImpactAnalysis, ImpactState, ItemTiming, RecoveryChange, RecoveryPlan, RecoveryRecommendation, RecoveryRunRequest, RecoveryRunResult, TravellerAction, Trip, ValidatedRecoveryCandidate } from "@/lib/domain/types";

export class RecoveryInputError extends Error {
  constructor(public readonly code: "INVALID_REQUEST" | "TRIP_NOT_FOUND" | "BOOKING_NOT_FOUND" | "STALE_TRIP_VERSION" | "DOMAIN_REJECTED", message: string) { super(message); }
}
export class TechnicalFailure extends Error { constructor(public readonly code: string, message: string) { super(message); } }
export interface RecommendationProvider {
  recommend(context: { trip: Trip; impact: ImpactAnalysis; feasibleCandidates: ValidatedRecoveryCandidate[] }): Promise<{ selectedCandidateId: string; reason: string; tradeoffs?: string[] }>;
}
export interface RecoveryDeps {
  recommender?: RecommendationProvider;
  findAlternatives?: (input: { trip: Trip; disruption: Disruption; impact: ImpactAnalysis }) => Promise<Alternative[]>;
}

const minutes = (value: string) => {
  const time = Date.parse(`${value}Z`);
  if (!Number.isFinite(time)) throw new TechnicalFailure("INVALID_TIME", `Invalid timestamp: ${value}`);
  return time / 60000;
};
const at = (value: string, delta: number) => new Date((minutes(value) + delta) * 60000).toISOString().slice(0, 19);
const timing = (trip: Trip, id: string): ItemTiming => {
  const item = trip.items.find((x) => x.id === id);
  if (!item) throw new TechnicalFailure("INVALID_TRIP", `Missing item ${id}`);
  if (item.kind === "transport") return { startAt: item.legs[0].departureAt, endAt: item.legs.at(-1)!.arrivalAt };
  return item.kind === "accommodation" ? { startAt: item.checkInAt, endAt: item.checkOutAt } : { startAt: item.startsAt, endAt: item.endsAt };
};
const transport = (trip: Trip, id: string) => trip.items.find((x) => x.id === id && x.kind === "transport");

export function analyzeImpact(trip: Trip, disruption: Disruption): ImpactAnalysis {
  const item = transport(trip, disruption.bookingId);
  if (!item) {
    if (!trip.items.some((x) => x.id === disruption.bookingId)) throw new RecoveryInputError("BOOKING_NOT_FOUND", `Booking ${disruption.bookingId} is not part of trip ${trip.id}.`);
    throw new RecoveryInputError("DOMAIN_REJECTED", "Only transport bookings can be disrupted.");
  }
  if (disruption.kind === "delay" && (!Number.isInteger(disruption.delayMinutes) || disruption.delayMinutes! <= 0)) throw new RecoveryInputError("DOMAIN_REJECTED", "A delay requires positive integer delayMinutes.");
  if (disruption.kind === "cancellation" && disruption.delayMinutes !== undefined) throw new RecoveryInputError("DOMAIN_REJECTED", "A cancellation must not include delayMinutes.");
  const changed = disruption.kind === "cancellation" ? null : { startAt: timing(trip, item.id).startAt, endAt: at(timing(trip, item.id).endAt, disruption.delayMinutes!) };
  const states: Record<string, ImpactState> = Object.fromEntries(trip.items.map((x) => [x.id, "UNCHANGED" as const]));
  states[item.id] = "DISRUPTED";
  const reasons: { itemId: string; reason: string }[] = [];
  const queue = [item.id];
  while (queue.length) {
    const from = queue.shift()!;
    for (const dependency of trip.dependencies.filter((x) => x.fromItemId === from)) {
      if (states[dependency.toItemId] !== "UNCHANGED") continue;
      let reason: string | undefined;
      if (dependency.kind === "CONNECTION" && from === item.id) {
        if (changed === null) reason = "Upstream service is cancelled, so the connection cannot be made.";
        else {
          const gap = minutes(timing(trip, dependency.toItemId).startAt) - minutes(changed.endAt);
          if (gap < 0) reason = "Connection is missed after the delay.";
          else if (gap < (dependency.minimumBufferMinutes ?? 0)) reason = `Connection buffer falls to ${gap} min, below the required ${dependency.minimumBufferMinutes ?? 0} min.`;
        }
      } else if (dependency.kind === "WINDOW") reason = "Expected arrival shifts later.";
      else if (dependency.kind === "TEMPORAL") reason = "Upstream item no longer finishes as scheduled.";
      else if (dependency.kind === "LOCATION") reason = "Required location is no longer reached as planned.";
      else reason = "Upstream connection is no longer reliable.";
      if (reason) { states[dependency.toItemId] = "AFFECTED"; reasons.push({ itemId: dependency.toItemId, reason }); queue.push(dependency.toItemId); }
    }
  }
  return { disruptedItemIds: trip.items.filter((x) => states[x.id] === "DISRUPTED").map((x) => x.id), affectedItemIds: trip.items.filter((x) => states[x.id] === "AFFECTED").map((x) => x.id), reasons, impactStates: states, disruptedTimings: { [item.id]: changed } };
}

function repairedTimings(trip: Trip, impact: ImpactAnalysis, candidate: Pick<GeneratedRecoveryCandidate, "alternatives">) {
  return Object.fromEntries(trip.items.map((item) => {
    const alternative = candidate.alternatives.find((x) => x.replacementForBookingId === item.id);
    return [item.id, alternative ? { startAt: alternative.departureAt, endAt: alternative.arrivalAt } : impact.disruptedTimings[item.id] ?? timing(trip, item.id)];
  })) as Record<string, ItemTiming | null>;
}
function candidateFor(trip: Trip, disruption: Disruption, impact: ImpactAnalysis, alternative: Alternative): GeneratedRecoveryCandidate {
  if (!transport(trip, alternative.replacementForBookingId) || minutes(alternative.arrivalAt) <= minutes(alternative.departureAt) || !Number.isFinite(alternative.extraCost) || alternative.extraCost < 0) throw new TechnicalFailure("ADAPTER_CONTRACT_VIOLATION", `Malformed alternative ${alternative.id}.`);
  const id = alternative.id.endsWith("-ALT") ? alternative.id.slice(0, -4) : `RC-${alternative.id}`;
  const recoveryChanges: Record<string, RecoveryChange> = Object.fromEntries(trip.items.map((item) => [item.id, item.id === alternative.replacementForBookingId ? "REPLACED" : item.id === disruption.bookingId && disruption.kind === "cancellation" ? "CANCELLED" : "UNCHANGED"] as const));
  const times = repairedTimings(trip, impact, { alternatives: [alternative] });
  const final = trip.items.filter((x) => x.kind === "transport").map((x) => ({ id: x.id, endAt: times[x.id]?.endAt })).filter((x): x is { id: string; endAt: string } => Boolean(x.endAt)).sort((a, b) => b.endAt.localeCompare(a.endAt))[0];
  return { id, alternatives: [alternative], impactStates: { ...impact.impactStates }, recoveryChanges, extraCost: alternative.extraCost, finalArrivalAt: final?.endAt ?? alternative.arrivalAt };
}
function evaluations(trip: Trip, impact: ImpactAnalysis, candidate: GeneratedRecoveryCandidate): ConstraintEvaluation[] {
  const times = repairedTimings(trip, impact, candidate); const result: ConstraintEvaluation[] = [];
  const final = trip.items.filter((x) => x.kind === "transport").map((x) => ({ id: x.id, endAt: times[x.id]?.endAt })).filter((x): x is { id: string; endAt: string } => Boolean(x.endAt)).sort((a, b) => b.endAt.localeCompare(a.endAt))[0];
  const focus = candidate.alternatives[0]?.replacementForBookingId ?? impact.disruptedItemIds[0];
  const add = (kind: ConstraintViolation["kind"], itemId: string, passed: boolean, message: string) => result.push({ kind, itemId, passed, message });
  if (trip.constraints.latestArrivalAt) add("ARRIVAL_DEADLINE", final?.id ?? focus, !!final && final.endAt <= trip.constraints.latestArrivalAt, `Final arrival ${final?.endAt ?? "is unavailable"} must be no later than ${trip.constraints.latestArrivalAt}.`);
  if (trip.constraints.maxExtraBudget !== undefined) add("MAX_EXTRA_BUDGET", focus, candidate.extraCost <= trip.constraints.maxExtraBudget, `Extra cost ${candidate.extraCost} must not exceed ${trip.constraints.maxExtraBudget}.`);
  if (trip.constraints.noOvernight) {
    const overnight = trip.items.find((x) => {
      if (x.kind !== "transport" || !times[x.id]) return false;
      const start = new Date(`${times[x.id]!.startAt}Z`), end = new Date(`${times[x.id]!.endAt}Z`);
      return start.toISOString().slice(0, 10) !== end.toISOString().slice(0, 10) || start.getUTCHours() >= 23 || start.getUTCHours() < 5 || end.getUTCHours() >= 23 || end.getUTCHours() < 5;
    });
    add("NO_OVERNIGHT", overnight?.id ?? focus, !overnight, overnight ? "Recovery requires overnight travel while overnight travel is prohibited." : "No overnight travel is required.");
  }
  for (const dep of trip.dependencies) {
    if (dep.kind === "LOCATION") throw new TechnicalFailure("UNSUPPORTED_DEPENDENCY", "LOCATION dependencies are not evaluated in Round 1.");
    if (dep.kind === "WINDOW") continue; // Existing golden hotel behavior is preserved; its public violation semantics remain unresolved.
    const from = times[dep.fromItemId], to = times[dep.toItemId];
    if (dep.kind === "CONNECTION") { const gap = from && to ? minutes(to.startAt) - minutes(from.endAt) : -Infinity; add("CONNECTION", dep.toItemId, gap >= (dep.minimumBufferMinutes ?? 0), `Connection ${dep.fromItemId} → ${dep.toItemId} requires ${dep.minimumBufferMinutes ?? 0} minutes.`); }
    if (dep.kind === "TEMPORAL") add("CONNECTION", dep.toItemId, !!from && !!to && from.endAt <= to.startAt, `${dep.fromItemId} must complete before ${dep.toItemId}.`);
  }
  return result;
}
function validate(trip: Trip, impact: ImpactAnalysis, candidate: GeneratedRecoveryCandidate): ValidatedRecoveryCandidate { const violations = evaluations(trip, impact, candidate).filter((x) => !x.passed).map(({ kind, itemId, message }) => ({ kind, itemId, message })); return { ...candidate, feasible: !violations.length, violations }; }
function fallback(candidates: ValidatedRecoveryCandidate[]): RecoveryRecommendation { const best = [...candidates].filter((x) => x.feasible).sort((a, b) => a.extraCost - b.extraCost || a.finalArrivalAt.localeCompare(b.finalArrivalAt) || a.id.localeCompare(b.id))[0]; if (!best) throw new TechnicalFailure("NO_FEASIBLE", "No feasible candidates."); return { selectedCandidateId: best.id, decisionSource: "DETERMINISTIC_FALLBACK", reason: `${best.id} is the lowest-cost feasible recovery.` }; }
function plan(trip: Trip, impact: ImpactAnalysis, candidate: ValidatedRecoveryCandidate): RecoveryPlan {
  const times = repairedTimings(trip, impact, candidate); const original = trip.items.filter((x) => x.kind === "transport").map((x) => timing(trip, x.id)).sort((a, b) => b.endAt.localeCompare(a.endAt))[0].endAt;
  return { selectedCandidateId: candidate.id, items: trip.items.map((item) => ({ itemId: item.id, kind: item.kind, label: item.label, impactState: candidate.impactStates[item.id], recoveryChange: candidate.recoveryChanges[item.id], original: timing(trip, item.id), repaired: times[item.id], ...(candidate.alternatives.find((x) => x.replacementForBookingId === item.id) ? { replacedByAlternativeId: candidate.alternatives.find((x) => x.replacementForBookingId === item.id)!.id } : {}) })), extraCost: candidate.extraCost, originalFinalArrivalAt: original, repairedFinalArrivalAt: candidate.finalArrivalAt, arrivalDeltaMinutes: minutes(candidate.finalArrivalAt) - minutes(original), constraintResults: evaluations(trip, impact, candidate) };
}
function actions(planValue: RecoveryPlan, candidate: ValidatedRecoveryCandidate): TravellerAction[] { return candidate.alternatives.map((alternative, index) => ({ id: `ACT-${index + 1}`, kind: "BOOK_REPLACEMENT", itemId: alternative.replacementForBookingId, description: `Book simulated replacement ${alternative.id}.`, automated: false })); }
export function parseRequest(body: unknown): RecoveryRunRequest {
  const value = body as Record<string, unknown>; const disruption = value?.disruption as Record<string, unknown>;
  if (!value || typeof value.tripId !== "string" || !Number.isInteger(value.tripVersion) || !disruption || disruption.source !== "SIMULATED" || typeof disruption.scenarioId !== "string" || typeof disruption.bookingId !== "string" || (disruption.kind !== "delay" && disruption.kind !== "cancellation")) throw new RecoveryInputError("INVALID_REQUEST", "Invalid recovery-run request.");
  if (disruption.delayMinutes !== undefined && (!Number.isInteger(disruption.delayMinutes) || (disruption.kind === "delay" && (disruption.delayMinutes as number) <= 0))) throw new RecoveryInputError("INVALID_REQUEST", "Invalid delayMinutes.");
  if (value.demoAttempt !== undefined && (!Number.isInteger(value.demoAttempt) || (value.demoAttempt as number) < 0)) throw new RecoveryInputError("INVALID_REQUEST", "Invalid demoAttempt.");
  return { tripId: value.tripId, tripVersion: value.tripVersion as number, disruption: disruption as unknown as Disruption, ...(value.demoAttempt === undefined ? {} : { demoAttempt: value.demoAttempt as number }) };
}
export async function getTrip(tripId: string) {
  const trip = tripById(tripId);
  return trip ? structuredClone(trip) : null;
}
export async function runRecovery(request: RecoveryRunRequest, deps: RecoveryDeps = {}): Promise<RecoveryRunResult> {
  const trip = await getTrip(request.tripId); if (!trip) throw new RecoveryInputError("TRIP_NOT_FOUND", `Trip ${request.tripId} was not found.`); if (trip.version !== request.tripVersion) throw new RecoveryInputError("STALE_TRIP_VERSION", `Trip is at version ${trip.version}.`);
  const scenario = scenarioById(request.disruption.scenarioId);
  if (!scenario || scenario.trip.id !== trip.id || scenario.disruption.bookingId !== request.disruption.bookingId || scenario.disruption.kind !== request.disruption.kind || scenario.disruption.delayMinutes !== request.disruption.delayMinutes) {
    throw new RecoveryInputError("DOMAIN_REJECTED", "The simulated disruption does not match a supported deterministic scenario.");
  }
  const impact = analyzeImpact(trip, request.disruption);
  let alternatives: Alternative[];
  try {
    if (scenario.failOnFirstAttempt && (request.demoAttempt ?? 0) === 0) throw new TechnicalFailure("SIMULATED_TRANSPORT_ADAPTER_OUTAGE", "The simulated rail adapter is temporarily unavailable.");
    alternatives = deps.findAlternatives ? await deps.findAlternatives({ trip, disruption: request.disruption, impact }) : structuredClone(scenario.alternatives);
  }
  catch (error) { throw error instanceof TechnicalFailure ? error : new TechnicalFailure("TRANSPORT_ADAPTER_FAILED", error instanceof Error ? error.message : "Transport adapter failed."); }
  const candidates = alternatives.map((x) => candidateFor(trip, request.disruption, impact, x)).map((x) => validate(trip, impact, x)); const base = { runId: `run-${request.disruption.scenarioId}-v${trip.version}`, tripVersion: trip.version, impact, candidates };
  if (!candidates.some((x) => x.feasible)) return { ...base, status: "NO_FEASIBLE_RECOVERY", recommendation: null, recoveryPlan: null, actions: [] };
  const feasible = candidates.filter((candidate) => candidate.feasible);
  let recommendation: RecoveryRecommendation | undefined;
  if (deps.recommender) {
    try {
      const draft = await deps.recommender.recommend({ trip, impact, feasibleCandidates: feasible });
      const selected = feasible.find((candidate) => candidate.id === draft.selectedCandidateId);
      if (selected && typeof draft.reason === "string" && draft.reason.trim()) recommendation = { ...draft, decisionSource: "AI" };
    } catch { /* Provider failure is intentionally a deterministic-fallback case. */ }
  }
  recommendation ??= fallback(candidates); const selected = candidates.find((x) => x.id === recommendation.selectedCandidateId)!; const recoveryPlan = plan(trip, impact, selected);
  return { ...base, status: "RECOVERED", recommendation, recoveryPlan, actions: actions(recoveryPlan, selected) };
}
