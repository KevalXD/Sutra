import assert from "node:assert/strict";
import test from "node:test";
import { goldenDisruption, goldenTrip } from "@/lib/domain/fixtures/golden-rail-delay-01";
import { cancellationNoRecoveryScenario, demoScenarioFor } from "@/lib/domain/fixtures/recovery-scenarios";
import { recoveryRunOutcome, tripOutcome, tripsOutcome } from "@/lib/recovery/http";
import type { RecoveryRunResult } from "@/lib/domain/types";

const request = () => ({ tripId: goldenTrip.id, tripVersion: goldenTrip.version, disruption: goldenDisruption });

test("root trip endpoint returns the canonical versioned trip", async () => {
  const response = await tripOutcome(goldenTrip.id);
  assert.equal(response.status, 200);
  assert.equal((response.body as typeof goldenTrip).id, goldenTrip.id);
  assert.equal((response.body as typeof goldenTrip).version, 1);
});

test("journey catalogue exposes only supported selectable journeys and profiles", async () => {
  const response = await tripsOutcome();
  assert.equal(response.status, 200);
  const body = response.body;
  assert.deepEqual(body.journeys.map((journey) => journey.tripId), ["trip-golden-rail-delay-01", "trip-mangaluru-bengaluru-01"]);
  const golden = body.journeys[0];
  assert.equal(golden.origin, "Mangaluru Central");
  assert.equal(golden.destination, "Mysuru Junction");
  assert.equal(golden.tripVersion, 1);
  assert.deepEqual(golden.supportedDisruptions.map((profile) => profile.id), ["golden-rail-delay-01", "rail-cancellation-01"]);
  assert.deepEqual(golden.supportedDisruptions[0].delayRange, { minimumMinutes: 30, maximumMinutes: 180, stepMinutes: 30 });
  assert.equal(golden.items[0].departureAt, "2026-11-10T09:00:00");
  assert.equal(golden.items[2].location, "Mysuru");
  assert.equal(JSON.stringify(body).includes("technical-error-retry-01"), false);
  assert.equal(JSON.stringify(body).includes("no-feasible-recovery-01"), false);
  const bengaluru = body.journeys[1];
  assert.equal(bengaluru.destination, "Bengaluru City");
  assert.deepEqual(bengaluru.items.map((item) => item.id), ["RAIL-C", "RAIL-D"]);
  assert.deepEqual(bengaluru.supportedDisruptions.map((profile) => profile.id), ["mangaluru-bengaluru-delay-01"]);
});

test("configurable delays validate declared range and alter canonical timing", async () => {
  for (const delayMinutes of [30, 120, 150, 180]) {
    const response = await recoveryRunOutcome({ ...request(), disruption: { ...goldenDisruption, delayMinutes } });
    assert.equal(response.status, 200);
  }
  const shortDelay = await recoveryRunOutcome({ ...request(), disruption: { ...goldenDisruption, delayMinutes: 30 } });
  const shortBody = shortDelay.body as { candidates: { id: string; repairedTimings: Record<string, { endAt: string }> }[] };
  assert.equal(shortBody.candidates[0].repairedTimings["RAIL-A"].endAt, "2026-11-10T13:30:00");
  for (const delayMinutes of [0, -30, 45, 181, 30.5]) {
    const response = await recoveryRunOutcome({ ...request(), disruption: { ...goldenDisruption, delayMinutes } });
    assert.ok(response.status === 400 || response.status === 422);
    assert.ok(["INVALID_REQUEST", "DOMAIN_REJECTED"].includes((response.body as { error: { code: string } }).error.code));
  }
});

test("configured profiles reject mismatched trip, booking, kind, and cancellation delay", async () => {
  assert.equal((await recoveryRunOutcome({ ...request(), disruption: { ...goldenDisruption, bookingId: "RAIL-B" } })).status, 422);
  assert.equal((await recoveryRunOutcome({ ...request(), disruption: { ...goldenDisruption, kind: "cancellation", delayMinutes: undefined } })).status, 422);
  const cancellation = demoScenarioFor("cancellation");
  assert.equal((await recoveryRunOutcome({ tripId: cancellation.trip.id, tripVersion: cancellation.trip.version, disruption: { ...cancellation.disruption, delayMinutes: 30 } })).status, 422);
});

test("the Bengaluru fixture recomputes its connection and reaches both recovery outcomes", async () => {
  const base = { tripId: "trip-mangaluru-bengaluru-01", tripVersion: 1, disruption: { source: "SIMULATED" as const, scenarioId: "mangaluru-bengaluru-delay-01", bookingId: "RAIL-C", kind: "delay" as const } };
  const recovered = await recoveryRunOutcome({ ...base, disruption: { ...base.disruption, delayMinutes: 30 } });
  assert.equal(recovered.status, 200);
  const recoveredBody = recovered.body as { status: string; candidates: { id: string; connectionChecks: { actualBufferMinutes: number; passed: boolean }[] }[] };
  assert.equal(recoveredBody.status, "RECOVERED");
  assert.deepEqual(recoveredBody.candidates.find((candidate) => candidate.id === "MB-A")?.connectionChecks[0], { dependencyId: "RAIL-C->RAIL-D", predecessorItemId: "RAIL-C", successorItemId: "RAIL-D", predecessorArrivalAt: "2026-11-12T12:30:00", successorDepartureAt: "2026-11-12T13:00:00", actualBufferMinutes: 30, minimumBufferMinutes: 30, passed: true });
  const infeasible = await recoveryRunOutcome({ ...base, disruption: { ...base.disruption, delayMinutes: 150 } });
  assert.equal((infeasible.body as { status: string }).status, "NO_FEASIBLE_RECOVERY");
});

test("root recovery endpoint runs the real canonical pipeline", async () => {
  const response = await recoveryRunOutcome(request());
  assert.equal(response.status, 200);
  const body = response.body as { status: string; candidates: { id: string; feasible: boolean; violations: { kind: string }[] }[]; recommendation: { decisionSource: string }; actions: { kind: string; itemId: string; description: string; automated: boolean }[] };
  assert.equal(body.status, "RECOVERED");
  assert.deepEqual(body.candidates.filter((candidate) => candidate.feasible).map((candidate) => candidate.id), ["RC-A", "RC-B"]);
  assert.deepEqual(body.candidates.find((candidate) => candidate.id === "RC-D")?.violations.map((violation) => violation.kind), ["ARRIVAL_DEADLINE", "NO_OVERNIGHT"]);
  assert.equal(body.recommendation.decisionSource, "DETERMINISTIC_FALLBACK");
  assert.deepEqual(body.actions, [{ id: "ACT-1", kind: "BOOK_REPLACEMENT", itemId: "RAIL-B", description: "Book simulated replacement RC-B-ALT.", automated: false }]);
});

test("recovery responses include a backend-authored decision audit for every candidate", async () => {
  const response = await recoveryRunOutcome(request());
  const body = response.body as Extract<RecoveryRunResult, { status: "RECOVERED" }>;
  assert.equal(body.decisionAudit.status, "RECOVERED");
  assert.equal(body.decisionAudit.selectedCandidateId, body.recommendation.selectedCandidateId);
  assert.equal(body.decisionAudit.decisionSource, body.recommendation.decisionSource);
  assert.deepEqual(body.decisionAudit.effectiveConstraints, body.effectiveConstraints);
  assert.deepEqual(body.decisionAudit.candidates.map((candidate) => candidate.candidateId), body.candidates.map((candidate) => candidate.id));
  assert.ok(body.decisionAudit.candidates.find((candidate) => candidate.candidateId === "RC-D")?.constraintChecks.some((check) => !check.passed));
});

test("constraint overrides are independently validated and select RC-C through deterministic fallback", async () => {
  const response = await recoveryRunOutcome({ ...request(), constraintOverrides: { latestArrivalAt: "2026-11-10T20:00:00", maxExtraBudget: 300, noOvernight: true } });
  assert.equal(response.status, 200);
  const body = response.body as { status: string; effectiveConstraints: { latestArrivalAt: string; maxExtraBudget: number; noOvernight: boolean }; recommendation: { selectedCandidateId: string; decisionSource: string } | null; candidates: { id: string; feasible: boolean; violations: { kind: string }[] }[] };
  assert.equal(body.status, "RECOVERED");
  assert.deepEqual(body.effectiveConstraints, { ...goldenTrip.constraints, latestArrivalAt: "2026-11-10T20:00:00", maxExtraBudget: 300, noOvernight: true });
  assert.deepEqual(body.candidates.filter((candidate) => candidate.feasible).map((candidate) => candidate.id), ["RC-C"]);
  assert.equal(body.recommendation?.selectedCandidateId, "RC-C");
  assert.equal(body.recommendation?.decisionSource, "DETERMINISTIC_FALLBACK");
  assert.deepEqual(body.candidates.find((candidate) => candidate.id === "RC-D")?.violations.map((violation) => violation.kind), ["ARRIVAL_DEADLINE", "NO_OVERNIGHT"]);
});

test("strict constraints return no recovery with backend-derived reasons and do not mutate the fixture", async () => {
  const baseline = structuredClone(goldenTrip.constraints);
  const response = await recoveryRunOutcome({ ...request(), constraintOverrides: { latestArrivalAt: "2026-11-10T19:00:00", maxExtraBudget: 300, noOvernight: true } });
  assert.equal(response.status, 200);
  const body = response.body as { status: string; recommendation: unknown; recoveryPlan: unknown; candidates: { id: string; violations: { kind: string }[] }[] };
  assert.equal(body.status, "NO_FEASIBLE_RECOVERY");
  assert.equal(body.recommendation, null); assert.equal(body.recoveryPlan, null);
  assert.deepEqual(body.candidates.find((candidate) => candidate.id === "RC-A")?.violations.map((violation) => violation.kind), ["MAX_EXTRA_BUDGET"]);
  assert.deepEqual(body.candidates.find((candidate) => candidate.id === "RC-C")?.violations.map((violation) => violation.kind), ["ARRIVAL_DEADLINE"]);
  assert.deepEqual(goldenTrip.constraints, baseline);
  const repeat = await recoveryRunOutcome(request());
  assert.deepEqual((repeat.body as { effectiveConstraints: unknown }).effectiveConstraints, baseline);
});

test("no-feasible responses keep the audit source empty and expose blocking reasons", async () => {
  const response = await recoveryRunOutcome({ ...request(), constraintOverrides: { latestArrivalAt: "2026-11-10T19:00:00", maxExtraBudget: 300, noOvernight: true } });
  const body = response.body as Extract<RecoveryRunResult, { status: "NO_FEASIBLE_RECOVERY" }>;
  assert.equal(body.decisionAudit.status, "NO_FEASIBLE_RECOVERY");
  assert.equal(body.decisionAudit.decisionSource, "NONE");
  assert.equal(body.decisionAudit.selectedCandidateId, null);
  assert.ok(body.decisionAudit.noFeasibleReasons.some((reason) => reason.kind === "MAX_EXTRA_BUDGET"));
  assert.ok(body.decisionAudit.noFeasibleReasons.some((reason) => reason.kind === "ARRIVAL_DEADLINE"));
});

test("constraint override input rejects malformed timestamps, budgets, booleans, and unknown fields", async () => {
  const invalid = [
    { maxExtraBudget: -1 }, { maxExtraBudget: "300" }, { latestArrivalAt: "not-a-date" },
    { latestArrivalAt: "2026-02-30T19:00:00" }, { noOvernight: "true" }, { unexpected: true }, null,
  ];
  for (const constraintOverrides of invalid) assert.equal((await recoveryRunOutcome({ ...request(), constraintOverrides })).status, 400);
});

test("golden delay exposes validator-derived disrupted timing and connection facts", async () => {
  const response = await recoveryRunOutcome(request());
  const body = response.body as unknown as { candidates: { id: string; repairedTimings: Record<string, { endAt: string } | null>; connectionChecks: { predecessorArrivalAt: string; successorDepartureAt: string; actualBufferMinutes: number; minimumBufferMinutes: number; passed: boolean }[]; recoveryChanges: Record<string, string>; impactStates: Record<string, string> }[] };
  const rcA = body.candidates.find((candidate) => candidate.id === "RC-A")!;
  const rcB = body.candidates.find((candidate) => candidate.id === "RC-B")!;
  assert.equal(rcA.repairedTimings["RAIL-A"]?.endAt, "2026-11-10T15:00:00");
  assert.deepEqual(rcA.connectionChecks[0] && { predecessorArrivalAt: rcA.connectionChecks[0].predecessorArrivalAt, replacementDepartureAt: rcA.connectionChecks[0].successorDepartureAt, actualBufferMinutes: rcA.connectionChecks[0].actualBufferMinutes, minimumBufferMinutes: rcA.connectionChecks[0].minimumBufferMinutes, passed: rcA.connectionChecks[0].passed }, { predecessorArrivalAt: "2026-11-10T15:00:00", replacementDepartureAt: "2026-11-10T15:30:00", actualBufferMinutes: 30, minimumBufferMinutes: 30, passed: true });
  assert.deepEqual(rcB.connectionChecks[0] && { predecessorArrivalAt: rcB.connectionChecks[0].predecessorArrivalAt, replacementDepartureAt: rcB.connectionChecks[0].successorDepartureAt, actualBufferMinutes: rcB.connectionChecks[0].actualBufferMinutes, minimumBufferMinutes: rcB.connectionChecks[0].minimumBufferMinutes, passed: rcB.connectionChecks[0].passed }, { predecessorArrivalAt: "2026-11-10T15:00:00", replacementDepartureAt: "2026-11-10T16:00:00", actualBufferMinutes: 60, minimumBufferMinutes: 30, passed: true });
  assert.equal(rcA.impactStates["RAIL-A"], "DISRUPTED");
  assert.equal(rcA.recoveryChanges["RAIL-A"], "UNCHANGED");
});

test("root recovery endpoint maps invalid, stale, and missing requests", async () => {
  assert.equal((await recoveryRunOutcome("bad")).status, 400);
  assert.equal((await recoveryRunOutcome({ ...request(), tripId: "missing" })).status, 404);
  assert.equal((await recoveryRunOutcome({ ...request(), tripVersion: 2 })).status, 409);
});

test("root recovery distinguishes infeasibility from a technical adapter failure", async () => {
  const noFeasible = await recoveryRunOutcome(request(), { findAlternatives: async () => [] });
  assert.equal((noFeasible.body as { status: string }).status, "NO_FEASIBLE_RECOVERY");
  const technical = await recoveryRunOutcome(request(), { findAlternatives: async () => { throw new Error("adapter outage"); } });
  assert.equal(technical.status, 500);
  assert.equal((technical.body as { status: string }).status, "TECHNICAL_ERROR");
});

test("cancellation uses the canonical trip and returns a validated simulated replacement", async () => {
  const fixture = demoScenarioFor("cancellation");
  const response = await recoveryRunOutcome({ tripId: fixture.trip.id, tripVersion: fixture.trip.version, disruption: fixture.disruption });
  assert.equal(response.status, 200);
  const body = response.body as { status: string; tripVersion: number; impact: { disruptedItemIds: string[]; affectedItemIds: string[] }; recommendation: { selectedCandidateId: string } | null; candidates: { id: string; feasible: boolean; recoveryChanges: Record<string, string> }[] };
  assert.equal(body.status, "RECOVERED");
  assert.equal(body.tripVersion, goldenTrip.version);
  assert.deepEqual(body.impact.disruptedItemIds, ["RAIL-A"]);
  assert.deepEqual(body.impact.affectedItemIds, ["RAIL-B", "HOTEL-1"]);
  assert.equal(body.recommendation?.selectedCandidateId, "CC-A");
  assert.equal(body.candidates.find((candidate) => candidate.id === "CC-A")?.recoveryChanges["RAIL-A"], "REPLACED");
  assert.equal(body.candidates.find((candidate) => candidate.id === "CC-B")?.feasible, false);
});

test("cancellation with only invalid offers is a 200 NO_FEASIBLE_RECOVERY with rejection reasons", async () => {
  const fixture = cancellationNoRecoveryScenario;
  const response = await recoveryRunOutcome({ tripId: fixture.trip.id, tripVersion: fixture.trip.version, disruption: fixture.disruption });
  assert.equal(response.status, 200);
  const body = response.body as { status: string; recommendation: unknown; candidates: { feasible: boolean; violations: unknown[] }[] };
  assert.equal(body.status, "NO_FEASIBLE_RECOVERY");
  assert.equal(body.recommendation, null);
  assert.ok(body.candidates.every((candidate) => !candidate.feasible && candidate.violations.length > 0));
});

test("the independent no-feasible fixture retains every failed candidate and never selects one", async () => {
  const fixture = demoScenarioFor("infeasible");
  const response = await recoveryRunOutcome({ tripId: fixture.trip.id, tripVersion: fixture.trip.version, disruption: fixture.disruption });
  assert.equal(response.status, 200);
  const body = response.body as { status: string; recommendation: unknown; recoveryPlan: unknown; candidates: { feasible: boolean; violations: { kind: string }[] }[] };
  assert.equal(body.status, "NO_FEASIBLE_RECOVERY");
  assert.equal(body.recommendation, null);
  assert.equal(body.recoveryPlan, null);
  assert.deepEqual(body.candidates.map((candidate) => candidate.feasible), [false, false, false]);
  assert.deepEqual(body.candidates[1].violations.map((violation) => violation.kind), ["ARRIVAL_DEADLINE", "NO_OVERNIGHT"]);
});

test("the controlled adapter outage is TECHNICAL_ERROR once and the retry reaches recovery", async () => {
  const fixture = demoScenarioFor("error");
  const base = { tripId: fixture.trip.id, tripVersion: fixture.trip.version, disruption: fixture.disruption };
  const first = await recoveryRunOutcome({ ...base, demoAttempt: 0 });
  assert.equal(first.status, 500);
  assert.equal((first.body as { status: string; error: { code: string } }).status, "TECHNICAL_ERROR");
  assert.equal((first.body as { error: { code: string } }).error.code, "SIMULATED_TRANSPORT_ADAPTER_OUTAGE");
  const retry = await recoveryRunOutcome({ ...base, demoAttempt: 1 });
  assert.equal(retry.status, 200);
  assert.equal((retry.body as { status: string; recommendation: { decisionSource: string } }).status, "RECOVERED");
  assert.equal((retry.body as { recommendation: { decisionSource: string } }).recommendation.decisionSource, "DETERMINISTIC_FALLBACK");
});
