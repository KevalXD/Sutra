import assert from "node:assert/strict";
import test from "node:test";
import { supportedScenarios } from "@/lib/domain/fixtures/recovery-scenarios";
import type { RecoveryRunResult, SupportedDisruptionProfile, Trip } from "@/lib/domain/types";
import { recoveryRunOutcome, tripsOutcome } from "@/lib/recovery/http";
import { runRecovery, type RecommendationProvider } from "@/lib/recovery/core";

const delayScenarios = supportedScenarios().filter((scenario) => scenario.profile.kind === "delay");
const cancellationScenario = supportedScenarios().find((scenario) => scenario.profile.kind === "cancellation")!;

const requestFor = (scenario: typeof delayScenarios[number], delayMinutes: number, constraintOverrides?: object) => ({
  tripId: scenario.trip.id,
  tripVersion: scenario.trip.version,
  disruption: { ...scenario.disruption, delayMinutes },
  ...(constraintOverrides ? { constraintOverrides } : {}),
});
const delaysFor = (profile: SupportedDisruptionProfile) => {
  const range = profile.delayRange!;
  return Array.from({ length: (range.maximumMinutes - range.minimumMinutes) / range.stepMinutes + 1 }, (_, index) => range.minimumMinutes + index * range.stepMinutes);
};
const previousMinute = (timestamp: string) => new Date(Date.parse(`${timestamp}Z`) - 60_000).toISOString().slice(0, 19);

function assertCanonicalResult(result: RecoveryRunResult, trip: Trip, disruptedBookingId: string) {
  assert.equal(new Set(result.impact.disruptedItemIds).size, result.impact.disruptedItemIds.length);
  assert.equal(new Set(result.impact.affectedItemIds).size, result.impact.affectedItemIds.length);
  assert.ok(result.impact.disruptedItemIds.includes(disruptedBookingId));
  assert.equal(new Set(result.candidates.map((candidate) => candidate.id)).size, result.candidates.length);
  assert.deepEqual(result.decisionAudit.candidates.map((candidate) => candidate.candidateId), result.candidates.map((candidate) => candidate.id));

  for (const candidate of result.candidates) {
    assert.equal(candidate.feasible, candidate.violations.length === 0, `${candidate.id} feasibility must agree with violations`);
    for (const alternative of candidate.alternatives) {
      assert.ok(Date.parse(`${alternative.departureAt}Z`) < Date.parse(`${alternative.arrivalAt}Z`), `${alternative.id} must have increasing times`);
      assert.ok(alternative.extraCost >= 0);
      const repaired = candidate.repairedTimings[alternative.replacementForBookingId];
      assert.deepEqual(repaired, { startAt: alternative.departureAt, endAt: alternative.arrivalAt });
    }
    const transportEnds = trip.items
      .filter((item) => item.kind === "transport")
      .map((item) => candidate.repairedTimings[item.id]?.endAt)
      .filter((value): value is string => Boolean(value));
    assert.equal(candidate.finalArrivalAt, [...transportEnds].sort().at(-1));
    for (const check of candidate.dependencyChecks.filter((check) => !check.passed)) {
      assert.ok(candidate.violations.some((violation) => violation.kind === check.kind && violation.itemId === check.successorItemId), `${candidate.id} must record failed ${check.kind}`);
    }
  }

  if (result.status === "RECOVERED") {
    const selected = result.candidates.filter((candidate) => candidate.id === result.recommendation.selectedCandidateId);
    assert.equal(selected.length, 1);
    assert.equal(selected[0].feasible, true);
    assert.equal(selected[0].violations.length, 0);
    assert.equal(result.recoveryPlan.selectedCandidateId, selected[0].id);
    assert.equal(result.decisionAudit.selectedCandidateId, selected[0].id);
    assert.equal(result.decisionAudit.decisionSource, result.recommendation.decisionSource);
  } else {
    assert.equal(result.recommendation, null);
    assert.equal(result.recoveryPlan, null);
    assert.equal(result.decisionAudit.decisionSource, "NONE");
  }
}

test("catalogue ranges and canonical delay validation agree for every route", async () => {
  const catalogue = await tripsOutcome();
  assert.equal(catalogue.status, 200);
  const listed = new Map(catalogue.body.journeys.flatMap((journey) => journey.supportedDisruptions.map((profile) => [profile.id, profile])));

  for (const scenario of delayScenarios) {
    const profile = scenario.profile;
    assert.deepEqual(listed.get(profile.id)?.delayRange, profile.delayRange);
    const baseline = structuredClone(scenario.trip);
    for (const delayMinutes of delaysFor(profile)) {
      const response = await recoveryRunOutcome(requestFor(scenario, delayMinutes));
      assert.equal(response.status, 200, `${profile.id} accepts ${delayMinutes}`);
      assertCanonicalResult(response.body as RecoveryRunResult, scenario.trip, profile.bookingId);
    }
    const range = profile.delayRange!;
    for (const delayMinutes of [0, -30, range.minimumMinutes - 1, range.maximumMinutes + 1, range.minimumMinutes + range.stepMinutes / 2, range.minimumMinutes + 0.5]) {
      const response = await recoveryRunOutcome(requestFor(scenario, delayMinutes));
      assert.ok(response.status === 400 || response.status === 422, `${profile.id} rejects ${delayMinutes}`);
    }
    assert.deepEqual(scenario.trip, baseline, `${profile.id} validation must not mutate its fixture`);
  }
});

test("golden cancellation remains an independently validated canonical recovery", async () => {
  const scenario = cancellationScenario;
  const response = await recoveryRunOutcome({ tripId: scenario.trip.id, tripVersion: scenario.trip.version, disruption: scenario.disruption });
  assert.equal(response.status, 200);
  assertCanonicalResult(response.body as RecoveryRunResult, scenario.trip, scenario.profile.bookingId);
});

test("new independently selectable train-delay profiles map to the canonical journeys and alternatives", async () => {
  const catalogue = await tripsOutcome();
  const byTrip = new Map(catalogue.body.journeys.map((journey) => [journey.tripId, journey]));
  const expected = [
    ["trip-golden-rail-delay-01", "golden-rail-b-delay-01", "RAIL-B"],
    ["trip-mangaluru-bengaluru-01", "mangaluru-bengaluru-rail-d-delay-01", "RAIL-D"],
    ["trip-bengaluru-chennai-01", "bengaluru-jolarpet-rail-f-delay-01", "RAIL-F"],
  ] as const;
  const range = { minimumMinutes: 30, maximumMinutes: 180, stepMinutes: 30 };
  assert.equal(new Set(supportedScenarios().map((scenario) => scenario.id)).size, supportedScenarios().length);
  for (const [tripId, scenarioId, bookingId] of expected) {
    const scenario = delayScenarios.find((value) => value.id === scenarioId)!;
    assert.equal(scenario.trip.id, tripId);
    assert.equal(scenario.profile.bookingId, bookingId);
    assert.equal(scenario.profile.kind, "delay");
    assert.deepEqual(scenario.profile.delayRange, range);
    assert.ok(byTrip.get(tripId)?.supportedDisruptions.some((profile) => profile.id === scenarioId && profile.bookingId === bookingId));
    const response = await recoveryRunOutcome(requestFor(scenario, 120));
    assert.equal(response.status, 200);
    const body = response.body as Extract<RecoveryRunResult, { status: "RECOVERED" }>;
    assert.equal(body.impact.disruptedItemIds[0], bookingId);
    assert.ok(body.candidates.every((candidate) => candidate.alternatives.every((alternative) => alternative.replacementForBookingId === bookingId)));
    assert.equal(body.decisionAudit.selectedCandidateId, body.recommendation.selectedCandidateId);
  }
});

test("RAIL-F recovery uses repaired upstream timing for connection and budget checks", async () => {
  const scenario = delayScenarios.find((value) => value.id === "bengaluru-jolarpet-rail-f-delay-01")!;
  const response = await recoveryRunOutcome(requestFor(scenario, 90));
  assert.equal(response.status, 200);
  const body = response.body as Extract<RecoveryRunResult, { status: "RECOVERED" }>;
  const byId = new Map(body.candidates.map((candidate) => [candidate.id, candidate]));
  assert.deepEqual(byId.get("BF-A")?.connectionChecks[0], {
    dependencyId: "RAIL-F->RAIL-G", predecessorItemId: "RAIL-F", successorItemId: "RAIL-G",
    predecessorArrivalAt: "2026-11-16T12:15:00", successorDepartureAt: "2026-11-16T13:00:00", actualBufferMinutes: 45, minimumBufferMinutes: 30, passed: true,
  });
  assert.equal(byId.get("BF-A")?.feasible, true);
  assert.equal(byId.get("BF-B")?.feasible, true);
  assert.ok(byId.get("BF-C")?.violations.some((violation) => violation.kind === "CONNECTION" && violation.itemId === "RAIL-G"));
  assert.ok(byId.get("BF-D")?.violations.some((violation) => violation.kind === "MAX_EXTRA_BUDGET"));
  assert.equal(body.recommendation.selectedCandidateId, "BF-B");
  assert.equal(body.recoveryPlan.selectedCandidateId, "BF-B");
});

test("RAIL-B and RAIL-D recovery candidates retain their actual downstream dependency checks", async () => {
  const railB = delayScenarios.find((value) => value.id === "golden-rail-b-delay-01")!;
  const railD = delayScenarios.find((value) => value.id === "mangaluru-bengaluru-rail-d-delay-01")!;
  for (const [scenario, requiredDependencies] of [
    [railB, ["DEP-RAIL-A-RAIL-B", "DEP-RAIL-B-HOTEL-1"]],
    [railD, ["DEP-RAIL-C-RAIL-D", "DEP-RAIL-D-ACTIVITY-WINDOW", "DEP-ACTIVITY-HOTEL-TEMPORAL"]],
  ] as const) {
    const response = await recoveryRunOutcome(requestFor(scenario, 120));
    assert.equal(response.status, 200);
    const body = response.body as Extract<RecoveryRunResult, { status: "RECOVERED" }>;
    for (const candidate of body.candidates) {
      assert.ok(requiredDependencies.every((dependencyId) => candidate.dependencyChecks.some((check) => check.dependencyId === dependencyId)));
      assert.ok(candidate.alternatives.every((alternative) => alternative.replacementForBookingId === scenario.profile.bookingId));
    }
    assert.ok(body.candidates.some((candidate) => candidate.feasible));
  }
});

test("route-wide budget and deadline overrides revalidate candidates and preserve fixtures", async () => {
  for (const scenario of delayScenarios) {
    const baseline = structuredClone(scenario.trip);
    const delayMinutes = delaysFor(scenario.profile)[0];
    const baselineResult = await runRecovery(requestFor(scenario, delayMinutes));
    const earliest = baselineResult.candidates.map((candidate) => candidate.finalArrivalAt).sort()[0];
    for (const constraintOverrides of [{ maxExtraBudget: 0 }, { latestArrivalAt: previousMinute(earliest) }]) {
      const result = await runRecovery(requestFor(scenario, delayMinutes, constraintOverrides));
      assert.deepEqual(result.effectiveConstraints, { ...baseline, constraints: { ...baseline.constraints, ...constraintOverrides } }.constraints);
      assert.equal(result.status, "NO_FEASIBLE_RECOVERY");
      assert.equal(result.recommendation, null);
      assert.equal(result.recoveryPlan, null);
      assert.equal(result.decisionAudit.decisionSource, "NONE");
    }
    assert.deepEqual(scenario.trip, baseline);
  }
});

test("equal priority ranking values use the existing candidate-ID tie break", async () => {
  const scenario = delayScenarios.find((value) => value.trip.id === "trip-golden-rail-delay-01")!;
  const alternatives = [
    { id: "ZZ-ALT", replacementForBookingId: "RAIL-B", departureAt: "2026-11-10T15:30:00", arrivalAt: "2026-11-10T17:45:00", extraCost: 400, source: "SIMULATED_OFFER" as const },
    { id: "AA-ALT", replacementForBookingId: "RAIL-B", departureAt: "2026-11-10T15:30:00", arrivalAt: "2026-11-10T17:45:00", extraCost: 400, source: "SIMULATED_OFFER" as const },
  ];
  for (const priority of ["LOWER_COST", "EARLIER_ARRIVAL"] as const) {
    const result = await runRecovery(requestFor(scenario, 120, { priority }), { findAlternatives: async () => alternatives });
    assert.equal(result.status, "RECOVERED");
    assert.equal(result.status === "RECOVERED" && result.recommendation.selectedCandidateId, "AA");
    assert.equal(result.decisionAudit.appliedPriority, priority);
  }
});

test("offline recommenders receive only feasible candidates and fallback remains accurately audited across every route", async () => {
  for (const scenario of delayScenarios) {
    const delayMinutes = delaysFor(scenario.profile)[0];
    let calls = 0;
    const recommender: RecommendationProvider = { recommend: async ({ feasibleCandidates }) => {
      calls += 1;
      assert.ok(feasibleCandidates.length > 0);
      assert.ok(feasibleCandidates.every((candidate) => candidate.feasible && candidate.violations.length === 0));
      const selected = feasibleCandidates[0];
      return { selectedCandidateId: selected.id, preference: "EARLIER_ARRIVAL", facts: { selectedArrivalAt: selected.finalArrivalAt, selectedExtraCost: selected.extraCost } };
    } };
    const result = await runRecovery(requestFor(scenario, delayMinutes), { recommender });
    assert.equal(result.status, "RECOVERED");
    if (result.status === "RECOVERED") {
      assert.equal(calls, 1);
      assert.equal(result.recommendation.decisionSource, "AI");
      assert.equal(result.decisionAudit.decisionSource, "AI");
    }

    const fallback = await runRecovery(requestFor(scenario, delayMinutes), { recommender: { recommend: async () => { throw new Error("offline provider failure"); } } });
    assert.equal(fallback.status, "RECOVERED");
    if (fallback.status === "RECOVERED") {
      assert.equal(fallback.recommendation.decisionSource, "DETERMINISTIC_FALLBACK");
      assert.equal(fallback.decisionAudit.decisionSource, "DETERMINISTIC_FALLBACK");
    }

    const unknown = await runRecovery(requestFor(scenario, delayMinutes), { recommender: { recommend: async () => ({ selectedCandidateId: "NOT-A-CANDIDATE", preference: "EARLIER_ARRIVAL", facts: { selectedArrivalAt: "2026-01-01T00:00:00", selectedExtraCost: 0 } }) } });
    assert.equal(unknown.status, "RECOVERED");
    if (unknown.status === "RECOVERED") {
      assert.equal(unknown.recommendation.decisionSource, "DETERMINISTIC_FALLBACK");
      assert.equal(unknown.decisionAudit.decisionSource, "DETERMINISTIC_FALLBACK");
    }

    const priorityMismatch = await runRecovery(requestFor(scenario, delayMinutes, { priority: "LOWER_COST" }), { recommender: { recommend: async (context) => {
      const selected = context.feasibleCandidates[0];
      return { selectedCandidateId: selected.id, preference: "EARLIER_ARRIVAL", facts: { selectedArrivalAt: selected.finalArrivalAt, selectedExtraCost: selected.extraCost } };
    } } });
    assert.equal(priorityMismatch.status, "RECOVERED");
    if (priorityMismatch.status === "RECOVERED") {
      assert.equal(priorityMismatch.recommendation.decisionSource, "DETERMINISTIC_FALLBACK");
      assert.equal(priorityMismatch.decisionAudit.decisionSource, "DETERMINISTIC_FALLBACK");
      assert.equal(priorityMismatch.decisionAudit.appliedPriority, "LOWER_COST");
    }

    let noFeasibleCalls = 0;
    const noFeasible = await runRecovery(requestFor(scenario, delayMinutes, { maxExtraBudget: 0 }), { recommender: { recommend: async () => { noFeasibleCalls += 1; throw new Error("must not run"); } } });
    assert.equal(noFeasible.status, "NO_FEASIBLE_RECOVERY");
    assert.equal(noFeasibleCalls, 0);
  }
});
