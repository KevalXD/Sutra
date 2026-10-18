import test from "node:test";
import assert from "node:assert/strict";
import { goldenCandidates, goldenCancellation, goldenDisruption, goldenTrip } from "../src/fixtures/golden.js";
import { analyzeImpact, runRecovery, validateCandidate } from "../src/domain.js";
import type { CandidateRanker } from "../src/ai.js";

test("golden recovery uses AI-selected earlier feasible option", async () => { const r = await runRecovery("run-1", goldenTrip, goldenDisruption, goldenCandidates(goldenTrip, goldenDisruption), { rank: async () => ({ candidateId: "RC-A", reason: "Earlier arrival", tradeoffs: [] }) }); assert.equal(r.status, "RECOVERED"); assert.equal(r.recommendation?.selectedCandidateId, "RC-A"); assert.equal(r.recommendation?.decisionSource, "AI"); assert.deepEqual(r.recoveryPlan?.originalItinerary, goldenTrip.items); });
test("missing or failed AI falls back deterministically to lowest cost", async () => { const failing: CandidateRanker = { rank: async () => { throw new Error("timeout"); } }; const r = await runRecovery("run-2", goldenTrip, goldenDisruption, goldenCandidates(goldenTrip, goldenDisruption), failing); assert.equal(r.recommendation?.selectedCandidateId, "RC-B"); assert.equal(r.recommendation?.decisionSource, "DETERMINISTIC_FALLBACK"); });
test("hard constraints reject deadline, overnight and budget violations", async () => { const r = await runRecovery("run-3", goldenTrip, goldenDisruption, goldenCandidates(goldenTrip, goldenDisruption)); const byId = new Map(r.candidates.map(c => [c.id, c])); assert.equal(byId.get("RC-C")?.feasible, false); assert.equal(byId.get("RC-D")?.feasible, false); assert.equal(byId.get("RC-E")?.feasible, false); assert.ok(byId.get("RC-C")?.violations.some(v => v.kind === "ARRIVAL_DEADLINE")); assert.ok(byId.get("RC-D")?.violations.some(v => v.kind === "NO_OVERNIGHT")); assert.ok(byId.get("RC-E")?.violations.some(v => v.kind === "MAX_EXTRA_BUDGET")); });
test("cancellation is processed and preserves unaffected bookings", async () => { const r = await runRecovery("run-4", goldenTrip, goldenCancellation, goldenCandidates(goldenTrip, goldenCancellation)); assert.equal(r.status, "RECOVERED"); assert.equal(r.recoveryPlan?.originalItinerary.find(i => i.id === "rail-b")?.id, "rail-b"); });
test("all infeasible candidates produce a terminal no-feasible result", async () => { const candidates = goldenCandidates(goldenTrip, goldenDisruption).map(c => ({ ...c, extraCost: 900, finalArrivalAt: "2026-10-11T21:00:00+05:30" })); const r = await runRecovery("run-5", goldenTrip, goldenDisruption, candidates); assert.equal(r.status, "NO_FEASIBLE_RECOVERY"); assert.equal(r.recommendation, null); });
test("unknown AI candidate cannot be selected", async () => { const r = await runRecovery("run-6", goldenTrip, goldenDisruption, goldenCandidates(goldenTrip, goldenDisruption), { rank: async () => ({ candidateId: "UNKNOWN", reason: "bad", tradeoffs: [] }) }); assert.equal(r.recommendation?.decisionSource, "DETERMINISTIC_FALLBACK"); assert.equal(r.recommendation?.selectedCandidateId, "RC-B"); });
test("invalid connection is rejected independently", () => { const c = goldenCandidates(goldenTrip, goldenDisruption)[0];
  c.itinerary.push(structuredClone(goldenTrip.items.find(item => item.id === "rail-b")!));
  c.recoveryChanges["rail-b"] = "UNCHANGED";
  const trip = structuredClone(goldenTrip); trip.dependencies[0].minimumBufferMinutes = 999; const checked = validateCandidate(c, trip); assert.equal(checked.feasible, false); assert.ok(checked.violations.some(v => v.kind === "CONNECTION")); });

test("impact analysis propagates across the rail connection to the hotel", () => {
  const impact = analyzeImpact(goldenTrip, goldenDisruption);
  assert.deepEqual(new Set(impact.affectedItemIds), new Set(["rail-b", "hotel-1"]));
  assert.equal(impact.impactStates["rail-a"], "DISRUPTED");
  assert.equal(impact.impactStates["rail-b"], "AFFECTED");
  assert.equal(impact.impactStates["hotel-1"], "AFFECTED");
});
test("through-rail recovery removes the missed connection and preserves the hotel", async () => {
  const result = await runRecovery("run-through", goldenTrip, goldenDisruption, goldenCandidates(goldenTrip, goldenDisruption));
  assert.equal(result.status, "RECOVERED");
  const selected = result.candidates.find(candidate => candidate.id === result.recommendation?.selectedCandidateId);
  assert.ok(selected?.feasible);
  assert.equal(selected?.itinerary.some(item => item.id === "rail-b"), false);
  assert.equal(selected?.itinerary.some(item => item.id === "hotel-1"), true);
  assert.equal(selected?.recoveryChanges["rail-b"], "CANCELLED");
});
test("replacement cannot evade a connection constraint by retaining the missed original leg", () => {
  const candidate = goldenCandidates(goldenTrip, goldenDisruption)[0];
  const trip = structuredClone(goldenTrip);
  trip.dependencies[0].minimumBufferMinutes = 999;
  const checked = validateCandidate(candidate, trip);
  assert.equal(checked.feasible, true, "a direct through service replaces the disrupted leg and cancels the obsolete connection");
});
