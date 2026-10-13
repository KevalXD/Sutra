import assert from "node:assert/strict";
import test from "node:test";
import { goldenDisruption, goldenTrip } from "@/lib/domain/fixtures/golden-rail-delay-01";
import { cancellationNoRecoveryScenario, demoScenarioFor } from "@/lib/domain/fixtures/recovery-scenarios";
import { recoveryRunOutcome, tripOutcome } from "@/lib/recovery/http";

const request = () => ({ tripId: goldenTrip.id, tripVersion: goldenTrip.version, disruption: goldenDisruption });

test("root trip endpoint returns the canonical versioned trip", async () => {
  const response = await tripOutcome(goldenTrip.id);
  assert.equal(response.status, 200);
  assert.equal((response.body as typeof goldenTrip).id, goldenTrip.id);
  assert.equal((response.body as typeof goldenTrip).version, 1);
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
