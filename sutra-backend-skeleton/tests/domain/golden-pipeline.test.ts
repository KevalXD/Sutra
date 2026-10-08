import { test } from "node:test";
import assert from "node:assert/strict";
import { goldenCandidates, goldenDisruption, goldenExpectedFallback, goldenTrip } from "../../lib/domain/fixtures/golden-rail-delay-01";
import { analyzeImpact } from "../../lib/domain/impact";
import { buildCandidates } from "../../lib/domain/candidates";
import { validateAll } from "../../lib/domain/validation";
import { SimulatedRailAdapter } from "../../lib/adapters/simulated-rail-adapter";
import { InMemoryTripRepository } from "../../lib/adapters/in-memory-trip-repository";
import { runRecovery } from "../../lib/application/run-recovery";
import { handleStartRecovery } from "../../lib/api/http";
import { intersectsOvernight } from "../../lib/domain/time";
import type { RecoveryRunRequest, Alternative } from "../../lib/domain/types";
import type { RecoveryDeps } from "../../lib/application/run-recovery";

const deps = (): RecoveryDeps => ({ trips: new InMemoryTripRepository(), transport: new SimulatedRailAdapter() });
const request = (): RecoveryRunRequest => ({ tripId: goldenTrip.id, tripVersion: 1, disruption: { ...goldenDisruption } });

test("stage 1: impact matches golden ground truth", () => {
  const impact = analyzeImpact(goldenTrip, goldenDisruption);
  assert.deepEqual(impact.disruptedItemIds, ["RAIL-A"]);
  assert.deepEqual(impact.affectedItemIds, ["RAIL-B", "HOTEL-1"]);
  assert.deepEqual(impact.reasons, [
    { itemId: "RAIL-B", reason: "Connection is missed after the delay." },
    { itemId: "HOTEL-1", reason: "Expected arrival shifts later." },
  ]);
  assert.equal(impact.disruptedTimings["RAIL-A"]?.endAt, "2026-11-10T15:00:00");
});

test("stages 2-3: candidates and verdicts reproduce the fixture exactly", async () => {
  const impact = analyzeImpact(goldenTrip, goldenDisruption);
  const alts = await new SimulatedRailAdapter().findAlternatives({ trip: goldenTrip, disruption: goldenDisruption, impact });
  const validated = validateAll(goldenTrip, impact, buildCandidates(goldenTrip, goldenDisruption, impact, alts));
  assert.deepEqual(validated, goldenCandidates);
});

test("full run: RECOVERED, deterministic fallback picks RC-B and says so", async () => {
  const r = await runRecovery(request(), deps());
  assert.equal(r.status, "RECOVERED");
  if (r.status !== "RECOVERED") return;
  assert.equal(r.recommendation.selectedCandidateId, goldenExpectedFallback.selectedCandidateId);
  assert.equal(r.recommendation.decisionSource, "DETERMINISTIC_FALLBACK");
  assert.equal(r.candidates.length, 5);
  assert.equal(r.recoveryPlan.arrivalDeltaMinutes, 180); // 15:30 -> 18:30
  assert.ok(r.recoveryPlan.constraintResults.every((e) => e.passed));
  const hotel = r.recoveryPlan.items.find((i) => i.itemId === "HOTEL-1")!;
  assert.equal(hotel.impactState, "AFFECTED"); // impact and recovery change are separate
  assert.equal(hotel.recoveryChange, "UNCHANGED");
  assert.ok(r.actions.length >= 2 && r.actions.every((a) => a.automated === false));
});

test("runs are repeatable and never mutate the baseline trip", async () => {
  const d = deps();
  const before = JSON.stringify(goldenTrip);
  const a = await runRecovery(request(), d);
  const b = await runRecovery(request(), d);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(goldenTrip), before);
});

test("AI recommendation of a feasible candidate is accepted and labelled AI", async () => {
  const r = await runRecovery(request(), {
    ...deps(),
    recommender: { recommend: async () => ({ selectedCandidateId: "RC-A", reason: "Earlier arrival." }) },
  });
  assert.equal(r.status === "RECOVERED" && r.recommendation.decisionSource, "AI");
  assert.equal(r.status === "RECOVERED" && r.recommendation.selectedCandidateId, "RC-A");
});

for (const [name, pick] of [["infeasible RC-E", "RC-E"], ["nonexistent RC-Z", "RC-Z"]] as const) {
  test(`AI picking ${name} is rejected -> fallback, not labelled AI`, async () => {
    const r = await runRecovery(request(), { ...deps(), recommender: { recommend: async () => ({ selectedCandidateId: pick, reason: "x" }) } });
    assert.equal(r.status === "RECOVERED" && r.recommendation.decisionSource, "DETERMINISTIC_FALLBACK");
    assert.equal(r.status === "RECOVERED" && r.recommendation.selectedCandidateId, "RC-B");
  });
}

test("AI throwing falls back instead of failing the run", async () => {
  const r = await runRecovery(request(), { ...deps(), recommender: { recommend: async () => { throw new Error("timeout"); } } });
  assert.equal(r.status, "RECOVERED");
});

test("AI only ever receives feasible candidates", async () => {
  let seen: string[] = [];
  await runRecovery(request(), { ...deps(), recommender: { recommend: async (ctx) => { seen = ctx.feasibleCandidates.map((c) => c.id); return { selectedCandidateId: "RC-A", reason: "x" }; } } });
  assert.deepEqual(seen, ["RC-A", "RC-B"]);
});

test("zero feasible -> NO_FEASIBLE_RECOVERY as an application result (HTTP 200)", async () => {
  const onlyBad: RecoveryDeps = {
    ...deps(),
    transport: { findAlternatives: async () => (await new SimulatedRailAdapter().findAlternatives({ trip: goldenTrip, disruption: goldenDisruption, impact: analyzeImpact(goldenTrip, goldenDisruption) })).filter((a) => ["RC-C-ALT", "RC-D-ALT", "RC-E-ALT"].includes(a.id)) },
  };
  const out = await handleStartRecovery(request(), onlyBad);
  assert.equal(out.status, 200);
  const r = out.body as { status: string; recommendation: unknown; recoveryPlan: unknown };
  assert.equal(r.status, "NO_FEASIBLE_RECOVERY");
  assert.equal(r.recommendation, null);
  assert.equal(r.recoveryPlan, null);
});

test("adapter outage is TECHNICAL_ERROR (5xx), never NO_FEASIBLE_RECOVERY", async () => {
  const out = await handleStartRecovery(request(), { ...deps(), transport: { findAlternatives: async () => { throw new Error("rail API down"); } } });
  assert.ok(out.status >= 500);
  assert.equal((out.body as { status: string }).status, "TECHNICAL_ERROR");
});

test("malformed adapter output is a technical failure, not an infeasible verdict", async () => {
  const broken: Alternative = { id: "X-ALT", replacementForBookingId: "NOPE", departureAt: "2026-11-10T16:00:00", arrivalAt: "2026-11-10T15:00:00", extraCost: 1, source: "SIMULATED_OFFER" };
  const out = await handleStartRecovery(request(), { ...deps(), transport: { findAlternatives: async () => [broken] } });
  assert.ok(out.status >= 500);
});

test("HTTP semantics for bad input", async () => {
  const d = deps();
  assert.equal((await handleStartRecovery("nope", d)).status, 400);
  assert.equal((await handleStartRecovery({ ...request(), tripId: "ghost" }, d)).status, 404);
  assert.equal((await handleStartRecovery({ ...request(), tripVersion: 7 }, d)).status, 409);
  const missing = request(); missing.disruption.bookingId = "RAIL-Z";
  assert.equal((await handleStartRecovery(missing, d)).status, 404);
  const hotel = request(); hotel.disruption.bookingId = "HOTEL-1";
  assert.equal((await handleStartRecovery(hotel, d)).status, 422);
  const zero = request(); zero.disruption.delayMinutes = 0;
  assert.equal((await handleStartRecovery(zero, d)).status, 422);
  const unknown = request(); unknown.disruption.scenarioId = "mystery";
  assert.equal((await handleStartRecovery(unknown, d)).status, 422);
});

test("disruption that leaves every dependency intact is rejected (422), not fabricated into a result", async () => {
  // With a 0-minute buffer, a 10-minute delay on RAIL-A still makes the 13:30 connection (arrives 13:10).
  const relaxed = structuredClone(goldenTrip);
  relaxed.dependencies = relaxed.dependencies.filter((d) => d.kind !== "WINDOW");
  relaxed.dependencies[0].minimumBufferMinutes = 0;
  const d: RecoveryDeps = { ...deps(), trips: new InMemoryTripRepository([relaxed]) };
  const r = request(); r.disruption.delayMinutes = 10;
  assert.equal((await handleStartRecovery(r, d)).status, 422);
});

test("delaying RAIL-B still affects the hotel via its WINDOW dependency", () => {
  const impact = analyzeImpact(goldenTrip, { ...goldenDisruption, bookingId: "RAIL-B", delayMinutes: 5 });
  assert.deepEqual(impact.affectedItemIds, ["HOTEL-1"]);
});

test("boundaries: arriving exactly at the deadline passes; overnight window edges", async () => {
  assert.equal(intersectsOvernight("2026-11-10T21:00:00", "2026-11-10T23:00:00"), false);
  assert.equal(intersectsOvernight("2026-11-10T21:00:00", "2026-11-10T23:01:00"), true);
  assert.equal(intersectsOvernight("2026-11-11T05:00:00", "2026-11-11T07:00:00"), false);
  const impact = analyzeImpact(goldenTrip, goldenDisruption);
  const alt: Alternative = { id: "RC-T-ALT", replacementForBookingId: "RAIL-B", departureAt: "2026-11-10T16:00:00", arrivalAt: "2026-11-10T19:00:00", extraCost: 500, source: "SIMULATED_OFFER" };
  const [c] = validateAll(goldenTrip, impact, buildCandidates(goldenTrip, goldenDisruption, impact, [alt]));
  assert.equal(c.feasible, true); // 19:00 == deadline, ₹500 == budget
});

test("connection violation: replacement departing before delayed arrival + buffer is infeasible", () => {
  const impact = analyzeImpact(goldenTrip, goldenDisruption);
  const alt: Alternative = { id: "RC-T-ALT", replacementForBookingId: "RAIL-B", departureAt: "2026-11-10T15:29:00", arrivalAt: "2026-11-10T17:00:00", extraCost: 100, source: "SIMULATED_OFFER" };
  const [c] = validateAll(goldenTrip, impact, buildCandidates(goldenTrip, goldenDisruption, impact, [alt]));
  assert.equal(c.feasible, false);
  assert.equal(c.violations[0].kind, "CONNECTION");
});

test("cancellation of RAIL-A with no replacement for it: candidate marks it CANCELLED", () => {
  const d = { ...goldenDisruption, kind: "cancellation" as const, delayMinutes: undefined };
  delete (d as { delayMinutes?: number }).delayMinutes;
  const impact = analyzeImpact(goldenTrip, d);
  assert.deepEqual(impact.affectedItemIds, ["RAIL-B", "HOTEL-1"]);
  const alt: Alternative = { id: "RC-T-ALT", replacementForBookingId: "RAIL-A", departureAt: "2026-11-10T10:00:00", arrivalAt: "2026-11-10T14:00:00", extraCost: 100, source: "SIMULATED_OFFER" };
  const [c] = buildCandidates(goldenTrip, d, impact, [alt]);
  assert.equal(c.recoveryChanges["RAIL-A"], "REPLACED");
});
