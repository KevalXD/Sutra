import { scenarioById, supportedScenarios, tripById } from "@/lib/domain/fixtures/recovery-scenarios";
import type { Alternative, CandidateDecisionAudit, ConnectionCheck, ConstraintEvaluation, ConstraintOverrides, ConstraintViolation, DecisionAudit, Dependency, DependencyCheck, Disruption, GeneratedRecoveryCandidate, ImpactAnalysis, ImpactState, ItemTiming, JourneyCatalogueEntry, JourneyCatalogueItem, JourneyCatalogueResponse, RecoveryChange, RecoveryPlan, RecoveryPriority, RecoveryRecommendation, RecoveryRunRequest, RecoveryRunResult, TravellerAction, Trip, ValidatedRecoveryCandidate } from "@/lib/domain/types";
import { validateAiRecommendation, type RecommendationDraft } from "./recommendation";

export class RecoveryInputError extends Error {
  constructor(public readonly code: "INVALID_REQUEST" | "TRIP_NOT_FOUND" | "BOOKING_NOT_FOUND" | "STALE_TRIP_VERSION" | "DOMAIN_REJECTED", message: string) { super(message); }
}
export class TechnicalFailure extends Error { constructor(public readonly code: string, message: string) { super(message); } }
export class RecommendationProviderError extends Error {
  constructor(public readonly category: "PROVIDER_API_ERROR" | "PROVIDER_RESPONSE_PARSE_ERROR" | "PROVIDER_TIMEOUT", message: string, public readonly httpStatus?: number) { super(message); }
}
export type RecommendationDiagnostic = {
  category: "PROVIDER_API_ERROR" | "PROVIDER_RESPONSE_PARSE_ERROR" | "PROVIDER_TIMEOUT" | "PROVIDER_FAILURE" | "POST_VALIDATION_REJECTED";
  httpStatus?: number;
  rejection?: string;
};
export interface RecommendationProvider {
  recommend(context: { trip: Trip; impact: ImpactAnalysis; feasibleCandidates: ValidatedRecoveryCandidate[]; activePriority?: RecoveryPriority }): Promise<RecommendationDraft>;
}
export interface RecoveryDeps {
  recommender?: RecommendationProvider;
  /** Total wall-clock budget for the optional AI recommendation, including provider retries. */
  recommendationTimeoutMs?: number;
  findAlternatives?: (input: { trip: Trip; disruption: Disruption; impact: ImpactAnalysis }) => Promise<Alternative[]>;
  onRecommendationDiagnostic?: (diagnostic: RecommendationDiagnostic) => void;
}

/** The interactive route never waits longer than this for an optional AI recommendation. */
export const AI_RECOMMENDATION_BUDGET_MS = 10_000;
/** Demo guardrail: values beyond this are almost certainly an accidental input. */
export const MAX_EXTRA_BUDGET = 100_000;

function isLocalTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) return false;
  const instant = new Date(`${value}Z`);
  return Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 19) === value;
}
function parseOverrides(value: unknown): ConstraintOverrides | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RecoveryInputError("INVALID_REQUEST", "constraintOverrides must be an object.");
  const overrides = value as Record<string, unknown>;
  const allowed = ["latestArrivalAt", "maxExtraBudget", "noOvernight", "priority"];
  if (Object.keys(overrides).some((key) => !allowed.includes(key))) throw new RecoveryInputError("INVALID_REQUEST", "constraintOverrides contains an unknown field.");
  if (overrides.latestArrivalAt !== undefined && !isLocalTimestamp(overrides.latestArrivalAt)) throw new RecoveryInputError("INVALID_REQUEST", "latestArrivalAt must be a valid local timestamp (YYYY-MM-DDTHH:mm:ss).");
  if (overrides.maxExtraBudget !== undefined && (typeof overrides.maxExtraBudget !== "number" || !Number.isFinite(overrides.maxExtraBudget) || overrides.maxExtraBudget < 0 || overrides.maxExtraBudget > MAX_EXTRA_BUDGET)) throw new RecoveryInputError("INVALID_REQUEST", `maxExtraBudget must be a finite amount from 0 to ${MAX_EXTRA_BUDGET}.`);
  if (overrides.noOvernight !== undefined && typeof overrides.noOvernight !== "boolean") throw new RecoveryInputError("INVALID_REQUEST", "noOvernight must be a boolean.");
  if (overrides.priority !== undefined && overrides.priority !== "LOWER_COST" && overrides.priority !== "EARLIER_ARRIVAL") throw new RecoveryInputError("INVALID_REQUEST", "priority must be LOWER_COST or EARLIER_ARRIVAL.");
  return overrides as ConstraintOverrides;
}

async function recommendWithinBudget(provider: RecommendationProvider, context: Parameters<RecommendationProvider["recommend"]>[0], timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => provider.recommend(context)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new RecommendationProviderError("PROVIDER_TIMEOUT", `AI recommendation exceeded its ${timeoutMs}ms time budget.`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
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
      } else if (dependency.kind === "WINDOW") reason = "Expected arrival may no longer meet the downstream time window.";
      else if (dependency.kind === "TEMPORAL") reason = "Upstream timing may now overlap the downstream commitment.";
      else if (dependency.kind === "LOCATION") continue;
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
function candidateIdFor(alternative: Alternative) {
  return alternative.id.endsWith("-ALT") ? alternative.id.slice(0, -4) : `RC-${alternative.id}`;
}
function candidateFor(trip: Trip, disruption: Disruption, impact: ImpactAnalysis, alternative: Alternative): GeneratedRecoveryCandidate {
  if (!transport(trip, alternative.replacementForBookingId) || minutes(alternative.arrivalAt) <= minutes(alternative.departureAt) || !Number.isFinite(alternative.extraCost) || alternative.extraCost < 0) throw new TechnicalFailure("ADAPTER_CONTRACT_VIOLATION", `Malformed alternative ${alternative.id}.`);
  const id = candidateIdFor(alternative);
  const recoveryChanges: Record<string, RecoveryChange> = Object.fromEntries(trip.items.map((item) => [item.id, item.id === alternative.replacementForBookingId ? "REPLACED" : item.id === disruption.bookingId && disruption.kind === "cancellation" ? "CANCELLED" : "UNCHANGED"] as const));
  const times = repairedTimings(trip, impact, { alternatives: [alternative] });
  const final = trip.items.filter((x) => x.kind === "transport").map((x) => ({ id: x.id, endAt: times[x.id]?.endAt })).filter((x): x is { id: string; endAt: string } => Boolean(x.endAt)).sort((a, b) => b.endAt.localeCompare(a.endAt))[0];
  return { id, alternatives: [alternative], impactStates: { ...impact.impactStates }, recoveryChanges, extraCost: alternative.extraCost, finalArrivalAt: final?.endAt ?? alternative.arrivalAt };
}
function itemLocations(trip: Trip, id: string) {
  const item = trip.items.find((value) => value.id === id);
  if (!item) return { start: null, end: null };
  if (item.kind === "transport") return { start: item.legs[0]?.originLocationId ?? null, end: item.legs.at(-1)?.destinationLocationId ?? null };
  return { start: item.locationId ?? null, end: item.locationId ?? null };
}
function validateDependency(dependency: Dependency) {
  if (dependency.kind !== "WINDOW") return;
  const window = dependency.arrivalWindow;
  if (!window || !isLocalTimestamp(window.latestAt) || (window.earliestAt !== undefined && !isLocalTimestamp(window.earliestAt)) || (window.earliestAt && minutes(window.earliestAt) > minutes(window.latestAt))) throw new TechnicalFailure("INVALID_DEPENDENCY", `WINDOW dependency ${dependency.id} requires a valid arrival window with latestAt not before earliestAt.`);
}
export function evaluateDependencies(trip: Trip, timings: Record<string, ItemTiming | null>): DependencyCheck[] {
  return trip.dependencies.map((dependency) => {
    validateDependency(dependency);
    const predecessor = timings[dependency.fromItemId], successor = timings[dependency.toItemId];
    const base = { dependencyId: dependency.id, predecessorItemId: dependency.fromItemId, successorItemId: dependency.toItemId } as const;
    if (dependency.kind === "CONNECTION") {
      const actualBufferMinutes = predecessor && successor ? minutes(successor.startAt) - minutes(predecessor.endAt) : null;
      const minimumBufferMinutes = dependency.minimumBufferMinutes ?? 0, passed = actualBufferMinutes !== null && actualBufferMinutes >= minimumBufferMinutes;
      return { ...base, kind: "CONNECTION" as const, predecessorCompletionAt: predecessor?.endAt ?? null, successorStartAt: successor?.startAt ?? null, actualBufferMinutes, minimumBufferMinutes, passed, message: passed ? `Connection buffer is ${actualBufferMinutes} minutes.` : `Connection requires ${minimumBufferMinutes} minutes; actual buffer is ${actualBufferMinutes ?? "unavailable"}.` };
    }
    if (dependency.kind === "TEMPORAL") {
      const passed = !!predecessor && !!successor && predecessor.endAt <= successor.startAt;
      return { ...base, kind: "TEMPORAL" as const, predecessorCompletionAt: predecessor?.endAt ?? null, successorStartAt: successor?.startAt ?? null, passed, message: passed ? `${dependency.fromItemId} completes before ${dependency.toItemId} starts.` : `${dependency.fromItemId} completes at ${predecessor?.endAt ?? "an unavailable time"}, which is after or cannot be compared with ${dependency.toItemId} starting at ${successor?.startAt ?? "an unavailable time"}.` };
    }
    if (dependency.kind === "LOCATION") {
      const from = itemLocations(trip, dependency.fromItemId), to = itemLocations(trip, dependency.toItemId), passed = from.end !== null && to.start !== null && from.end === to.start;
      return { ...base, kind: "LOCATION" as const, predecessorLocationId: from.end, successorLocationId: to.start, passed, message: passed ? `Location continuity verified at ${from.end}.` : from.end === null || to.start === null ? "Location continuity could not be verified because a canonical location ID is missing." : `Location continuity fails: ${from.end} does not match ${to.start}.` };
    }
    const window = dependency.arrivalWindow!, completion = predecessor?.endAt ?? null;
    const passed = completion !== null && (!window.earliestAt || completion >= window.earliestAt) && completion <= window.latestAt;
    return { ...base, kind: "WINDOW" as const, predecessorCompletionAt: completion, earliestAt: window.earliestAt ?? null, latestAt: window.latestAt, passed, message: passed ? `Arrival ${completion} is within the required window.` : `Arrival ${completion ?? "is unavailable"} must be within ${window.earliestAt ?? "the beginning of time"} and ${window.latestAt}.` };
  });
}
function connectionChecks(checks: DependencyCheck[]): ConnectionCheck[] {
  return checks.filter((check): check is Extract<DependencyCheck, { kind: "CONNECTION" }> => check.kind === "CONNECTION").map((check) => ({ dependencyId: `${check.predecessorItemId}->${check.successorItemId}`, predecessorItemId: check.predecessorItemId, successorItemId: check.successorItemId, predecessorArrivalAt: check.predecessorCompletionAt, successorDepartureAt: check.successorStartAt, actualBufferMinutes: check.actualBufferMinutes, minimumBufferMinutes: check.minimumBufferMinutes, passed: check.passed }));
}
function evaluations(trip: Trip, impact: ImpactAnalysis, candidate: GeneratedRecoveryCandidate, timings = repairedTimings(trip, impact, candidate), checks = evaluateDependencies(trip, timings)): ConstraintEvaluation[] {
  const result: ConstraintEvaluation[] = [];
  const final = trip.items.filter((x) => x.kind === "transport").map((x) => ({ id: x.id, endAt: timings[x.id]?.endAt })).filter((x): x is { id: string; endAt: string } => Boolean(x.endAt)).sort((a, b) => b.endAt.localeCompare(a.endAt))[0];
  const focus = candidate.alternatives[0]?.replacementForBookingId ?? impact.disruptedItemIds[0];
  const add = (kind: ConstraintViolation["kind"], itemId: string, passed: boolean, message: string) => result.push({ kind, itemId, passed, message });
  if (trip.constraints.latestArrivalAt) add("ARRIVAL_DEADLINE", final?.id ?? focus, !!final && final.endAt <= trip.constraints.latestArrivalAt, `Final arrival ${final?.endAt ?? "is unavailable"} must be no later than ${trip.constraints.latestArrivalAt}.`);
  if (trip.constraints.maxExtraBudget !== undefined) add("MAX_EXTRA_BUDGET", focus, candidate.extraCost <= trip.constraints.maxExtraBudget, `Extra cost ${candidate.extraCost} must not exceed ${trip.constraints.maxExtraBudget}.`);
  if (trip.constraints.noOvernight) {
    const overnight = trip.items.find((x) => {
      if (x.kind !== "transport" || !timings[x.id]) return false;
      const start = new Date(`${timings[x.id]!.startAt}Z`), end = new Date(`${timings[x.id]!.endAt}Z`);
      return start.toISOString().slice(0, 10) !== end.toISOString().slice(0, 10) || start.getUTCHours() >= 23 || start.getUTCHours() < 5 || end.getUTCHours() >= 23 || end.getUTCHours() < 5;
    });
    add("NO_OVERNIGHT", overnight?.id ?? focus, !overnight, overnight ? "Recovery requires overnight travel while overnight travel is prohibited." : "No overnight travel is required.");
  }
  for (const check of checks) add(check.kind, check.successorItemId, check.passed, check.message);
  return result;
}
function validate(trip: Trip, impact: ImpactAnalysis, candidate: GeneratedRecoveryCandidate): ValidatedRecoveryCandidate { const times = repairedTimings(trip, impact, candidate); const dependencyChecks = evaluateDependencies(trip, times); const checks = connectionChecks(dependencyChecks); const violations = evaluations(trip, impact, candidate, times, dependencyChecks).filter((x) => !x.passed).map(({ kind, itemId, message }) => ({ kind, itemId, message })); return { ...candidate, repairedTimings: times, connectionChecks: checks, dependencyChecks, feasible: !violations.length, violations }; }
function auditFor(runId: string, status: DecisionAudit["status"], source: DecisionAudit["decisionSource"], selectedCandidateId: string | null, constraints: Trip["constraints"], trip: Trip, impact: ImpactAnalysis, candidates: ValidatedRecoveryCandidate[], appliedPriority?: RecoveryPriority): DecisionAudit {
  const audited: CandidateDecisionAudit[] = candidates.map((candidate) => ({
    candidateId: candidate.id,
    feasible: candidate.feasible,
    finalArrivalAt: candidate.finalArrivalAt,
    extraCost: candidate.extraCost,
    constraintChecks: evaluations(trip, impact, candidate, candidate.repairedTimings, candidate.dependencyChecks),
    dependencyChecks: candidate.dependencyChecks,
    violations: candidate.violations,
  }));
  return { runId, status, decisionSource: source, selectedCandidateId, effectiveConstraints: structuredClone(constraints), ...(appliedPriority ? { appliedPriority } : {}), candidates: audited, noFeasibleReasons: audited.flatMap((candidate) => candidate.violations) };
}
function rankedCandidates(candidates: ValidatedRecoveryCandidate[], priority?: RecoveryPriority) {
  return [...candidates].filter((candidate) => candidate.feasible).sort((a, b) => priority === "EARLIER_ARRIVAL"
    ? a.finalArrivalAt.localeCompare(b.finalArrivalAt) || a.extraCost - b.extraCost || a.id.localeCompare(b.id)
    : a.extraCost - b.extraCost || a.finalArrivalAt.localeCompare(b.finalArrivalAt) || a.id.localeCompare(b.id));
}
function fallback(candidates: ValidatedRecoveryCandidate[], priority?: RecoveryPriority): RecoveryRecommendation { const best = rankedCandidates(candidates, priority)[0]; if (!best) throw new TechnicalFailure("NO_FEASIBLE", "No feasible candidates."); return { selectedCandidateId: best.id, decisionSource: "DETERMINISTIC_FALLBACK", reason: `${best.id} is the ${priority === "EARLIER_ARRIVAL" ? "earliest-arriving" : "lowest-cost"} feasible recovery.` }; }
function plan(trip: Trip, impact: ImpactAnalysis, candidate: ValidatedRecoveryCandidate): RecoveryPlan {
  const times = candidate.repairedTimings; const original = trip.items.filter((x) => x.kind === "transport").map((x) => timing(trip, x.id)).sort((a, b) => b.endAt.localeCompare(a.endAt))[0].endAt;
  return { selectedCandidateId: candidate.id, items: trip.items.map((item) => ({ itemId: item.id, kind: item.kind, label: item.label, impactState: candidate.impactStates[item.id], recoveryChange: candidate.recoveryChanges[item.id], original: timing(trip, item.id), repaired: times[item.id], ...(candidate.alternatives.find((x) => x.replacementForBookingId === item.id) ? { replacedByAlternativeId: candidate.alternatives.find((x) => x.replacementForBookingId === item.id)!.id } : {}) })), extraCost: candidate.extraCost, originalFinalArrivalAt: original, repairedFinalArrivalAt: candidate.finalArrivalAt, arrivalDeltaMinutes: minutes(candidate.finalArrivalAt) - minutes(original), constraintResults: evaluations(trip, impact, candidate, times, candidate.dependencyChecks) };
}
function actions(planValue: RecoveryPlan, candidate: ValidatedRecoveryCandidate): TravellerAction[] { return candidate.alternatives.map((alternative, index) => ({ id: `ACT-${index + 1}`, kind: "BOOK_REPLACEMENT", itemId: alternative.replacementForBookingId, description: `Book simulated replacement ${alternative.id}.`, automated: false })); }
export function parseRequest(body: unknown): RecoveryRunRequest {
  const value = body as Record<string, unknown>; const disruption = value?.disruption as Record<string, unknown>;
  if (!value || typeof value.tripId !== "string" || !Number.isInteger(value.tripVersion) || !disruption || disruption.source !== "SIMULATED" || typeof disruption.scenarioId !== "string" || typeof disruption.bookingId !== "string" || (disruption.kind !== "delay" && disruption.kind !== "cancellation")) throw new RecoveryInputError("INVALID_REQUEST", "Invalid recovery-run request.");
  if (disruption.delayMinutes !== undefined && (!Number.isInteger(disruption.delayMinutes) || (disruption.kind === "delay" && (disruption.delayMinutes as number) <= 0))) throw new RecoveryInputError("INVALID_REQUEST", "Invalid delayMinutes.");
  if (value.demoAttempt !== undefined && (!Number.isInteger(value.demoAttempt) || (value.demoAttempt as number) < 0)) throw new RecoveryInputError("INVALID_REQUEST", "Invalid demoAttempt.");
  const constraintOverrides = parseOverrides(value.constraintOverrides);
  return { tripId: value.tripId, tripVersion: value.tripVersion as number, disruption: disruption as unknown as Disruption, ...(value.demoAttempt === undefined ? {} : { demoAttempt: value.demoAttempt as number }), ...(constraintOverrides === undefined ? {} : { constraintOverrides }) };
}
export async function getTrip(tripId: string) {
  const trip = tripById(tripId);
  return trip ? structuredClone(trip) : null;
}
function catalogueItem(item: Trip["items"][number]): JourneyCatalogueItem {
  if (item.kind === "transport") {
    const first = item.legs[0], last = item.legs.at(-1)!;
    return { id: item.id, kind: item.kind, label: item.label, origin: first.origin, destination: last.destination, departureAt: first.departureAt, arrivalAt: last.arrivalAt };
  }
  if (item.kind === "accommodation") return { id: item.id, kind: item.kind, label: item.label, location: item.location, checkInAt: item.checkInAt, checkOutAt: item.checkOutAt };
  return { id: item.id, kind: item.kind, label: item.label, location: item.location, startsAt: item.startsAt, endsAt: item.endsAt };
}
export async function getJourneyCatalogue(): Promise<JourneyCatalogueResponse> {
  const grouped = new Map<string, JourneyCatalogueEntry>();
  for (const scenario of supportedScenarios()) {
    const firstTransport = scenario.trip.items.find((item) => item.kind === "transport");
    const lastTransport = [...scenario.trip.items].reverse().find((item) => item.kind === "transport");
    if (!firstTransport || !lastTransport || firstTransport.kind !== "transport" || lastTransport.kind !== "transport") continue;
    const existing = grouped.get(scenario.trip.id);
    if (existing) { existing.supportedDisruptions.push(structuredClone(scenario.profile)); continue; }
    grouped.set(scenario.trip.id, {
      tripId: scenario.trip.id, tripVersion: scenario.trip.version,
      label: `${firstTransport.legs[0].origin} to ${lastTransport.legs.at(-1)!.destination}`,
      origin: firstTransport.legs[0].origin, destination: lastTransport.legs.at(-1)!.destination,
      journeyDate: firstTransport.legs[0].departureAt.slice(0, 10), currency: scenario.trip.currency,
      defaultConstraints: structuredClone(scenario.trip.constraints), items: scenario.trip.items.map(catalogueItem),
      supportedDisruptions: [structuredClone(scenario.profile)],
    });
  }
  return { journeys: [...grouped.values()] };
}
function assertSupportedDisruption(scenario: NonNullable<ReturnType<typeof scenarioById>>, trip: Trip, disruption: Disruption) {
  const profile = scenario.profile;
  if (!scenario || scenario.trip.id !== trip.id) throw new RecoveryInputError("DOMAIN_REJECTED", "The disruption profile is not supported for this trip and booking.");
  // Legacy demo-only scenarios intentionally remain callable by their exact fixture request,
  // but are never returned by the ordinary selectable journey catalogue.
  if (!profile) {
    if (scenario.disruption.bookingId !== disruption.bookingId || scenario.disruption.kind !== disruption.kind || scenario.disruption.delayMinutes !== disruption.delayMinutes) throw new RecoveryInputError("DOMAIN_REJECTED", "The demo disruption does not match its supported fixture.");
    return;
  }
  if (profile.id !== disruption.scenarioId || profile.bookingId !== disruption.bookingId || profile.kind !== disruption.kind) throw new RecoveryInputError("DOMAIN_REJECTED", "The disruption profile is not supported for this trip and booking.");
  if (disruption.kind === "cancellation") {
    if (disruption.delayMinutes !== undefined) throw new RecoveryInputError("DOMAIN_REJECTED", "A cancellation must not include delayMinutes.");
    return;
  }
  const range = profile.delayRange;
  if (!range) {
    if (disruption.delayMinutes !== scenario.disruption.delayMinutes) throw new RecoveryInputError("DOMAIN_REJECTED", "This delay profile does not accept a changed delay duration.");
    return;
  }
  const delay = disruption.delayMinutes;
  if (typeof delay !== "number" || !Number.isInteger(delay) || delay < range.minimumMinutes || delay > range.maximumMinutes || (delay - range.minimumMinutes) % range.stepMinutes !== 0) throw new RecoveryInputError("DOMAIN_REJECTED", `delayMinutes must be ${range.minimumMinutes}-${range.maximumMinutes} in ${range.stepMinutes}-minute steps for this profile.`);
}
export async function runRecovery(request: RecoveryRunRequest, deps: RecoveryDeps = {}): Promise<RecoveryRunResult> {
  const baselineTrip = await getTrip(request.tripId); if (!baselineTrip) throw new RecoveryInputError("TRIP_NOT_FOUND", `Trip ${request.tripId} was not found.`); if (baselineTrip.version !== request.tripVersion) throw new RecoveryInputError("STALE_TRIP_VERSION", `Trip is at version ${baselineTrip.version}.`);
  const { priority, ...hardConstraintOverrides } = request.constraintOverrides ?? {};
  // An explicit priority is scoped to this calculation; legacy requests use the fixture unchanged.
  const trip: Trip = { ...baselineTrip, constraints: { ...baselineTrip.constraints, ...hardConstraintOverrides } };
  const scenario = scenarioById(request.disruption.scenarioId);
  if (!scenario) throw new RecoveryInputError("DOMAIN_REJECTED", "The selected disruption profile is not supported.");
  assertSupportedDisruption(scenario, trip, request.disruption);
  const impact = analyzeImpact(trip, request.disruption);
  let alternatives: Alternative[];
  try {
    if (scenario.failOnFirstAttempt && (request.demoAttempt ?? 0) === 0) throw new TechnicalFailure("SIMULATED_TRANSPORT_ADAPTER_OUTAGE", "The simulated rail adapter is temporarily unavailable.");
    alternatives = deps.findAlternatives ? await deps.findAlternatives({ trip, disruption: request.disruption, impact }) : structuredClone(scenario.alternatives);
  }
  catch (error) { throw error instanceof TechnicalFailure ? error : new TechnicalFailure("TRANSPORT_ADAPTER_FAILED", error instanceof Error ? error.message : "Transport adapter failed."); }
  const candidateIds = new Set<string>();
  for (const alternative of alternatives) {
    const candidateId = candidateIdFor(alternative);
    if (candidateIds.has(candidateId)) throw new TechnicalFailure("ADAPTER_CONTRACT_VIOLATION", `Duplicate recovery candidate ID ${candidateId} returned by the alternatives adapter.`);
    candidateIds.add(candidateId);
  }
  const candidates = alternatives.map((x) => candidateFor(trip, request.disruption, impact, x)).map((x) => validate(trip, impact, x)); const runId = `run-${request.disruption.scenarioId}-v${trip.version}`; const base = { runId, tripVersion: trip.version, impact, candidates, effectiveConstraints: structuredClone(trip.constraints) };
  if (!candidates.some((x) => x.feasible)) return { ...base, status: "NO_FEASIBLE_RECOVERY", recommendation: null, recoveryPlan: null, actions: [], decisionAudit: auditFor(runId, "NO_FEASIBLE_RECOVERY", "NONE", null, trip.constraints, trip, impact, candidates, priority) };
  const feasible = candidates.filter((candidate) => candidate.feasible);
  let recommendation: RecoveryRecommendation | undefined;
  if (deps.recommender) {
    try {
      const timeoutMs = deps.recommendationTimeoutMs ?? AI_RECOMMENDATION_BUDGET_MS;
      const draft = await recommendWithinBudget(deps.recommender, { trip, impact, feasibleCandidates: feasible, activePriority: priority }, timeoutMs);
      const validated = validateAiRecommendation(trip, feasible, draft, priority);
      recommendation = validated.recommendation;
      if (!recommendation) deps.onRecommendationDiagnostic?.({ category: "POST_VALIDATION_REJECTED", rejection: validated.rejection });
    } catch (error) {
      if (error instanceof RecommendationProviderError) deps.onRecommendationDiagnostic?.({ category: error.category, ...(error.httpStatus === undefined ? {} : { httpStatus: error.httpStatus }) });
      else deps.onRecommendationDiagnostic?.({ category: "PROVIDER_FAILURE" });
    }
  }
  recommendation ??= fallback(candidates, priority); const selected = candidates.find((x) => x.id === recommendation.selectedCandidateId)!; const recoveryPlan = plan(trip, impact, selected);
  return { ...base, status: "RECOVERED", recommendation, recoveryPlan, actions: actions(recoveryPlan, selected), decisionAudit: auditFor(runId, "RECOVERED", recommendation.decisionSource, recommendation.selectedCandidateId, trip.constraints, trip, impact, candidates, priority) };
}
