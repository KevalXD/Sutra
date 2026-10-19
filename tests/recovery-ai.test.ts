import assert from "node:assert/strict";
import test from "node:test";
import { goldenDisruption, goldenTrip } from "@/lib/domain/fixtures/golden-rail-delay-01";
import { demoScenarioFor } from "@/lib/domain/fixtures/recovery-scenarios";
import { OpenAiRecommendationProvider, configuredOpenAiRecommendationProvider } from "@/lib/recovery/openai-recommendation-provider";
import { runRecovery, type RecommendationProvider } from "@/lib/recovery/core";

const request = () => ({ tripId: goldenTrip.id, tripVersion: goldenTrip.version, disruption: goldenDisruption });
const rcAFacts = { selectedArrivalAt: "2026-11-10T17:45:00", selectedExtraCost: 450, comparedArrivalAt: "2026-11-10T18:30:00", comparedExtraCost: 350 };
const rcA: RecommendationProvider = { recommend: async () => ({ selectedCandidateId: "RC-A", preference: "EARLIER_ARRIVAL", comparedCandidateId: "RC-B", facts: rcAFacts }) };

test("a valid AI choice of RC-A is accepted with a verified earlier-arrival and cost trade-off", async () => {
  const result = await runRecovery(request(), { recommender: rcA });
  assert.equal(result.status, "RECOVERED");
  if (result.status !== "RECOVERED") return;
  assert.equal(result.recommendation.selectedCandidateId, "RC-A");
  assert.equal(result.recommendation.decisionSource, "AI");
  assert.match(result.recommendation.reason, /17:45/);
  assert.deepEqual(result.recommendation.tradeoffs, ["RC-A arrives 45 minutes earlier than RC-B.", "RC-A costs ₹100 more than RC-B."]);
});

for (const [label, recommender] of [
  ["an unknown candidate", { recommend: async () => ({ selectedCandidateId: "RC-Z", preference: "EARLIER_ARRIVAL", facts: rcAFacts }) }],
  ["an infeasible candidate", { recommend: async () => ({ selectedCandidateId: "RC-C", preference: "EARLIER_ARRIVAL", facts: rcAFacts }) }],
  ["contradictory objective explanation prose", { recommend: async () => ({ selectedCandidateId: "RC-A", preference: "EARLIER_ARRIVAL", comparedCandidateId: "RC-B", facts: rcAFacts, reason: "RC-A arrives at 10:00 for ₹0." }) }],
  ["contradictory structured candidate facts", { recommend: async () => ({ selectedCandidateId: "RC-A", preference: "EARLIER_ARRIVAL", comparedCandidateId: "RC-B", facts: { ...rcAFacts, selectedExtraCost: 0 } }) }],
] as const) {
  test(`${label} is rejected and uses deterministic RC-B fallback`, async () => {
    const result = await runRecovery(request(), { recommender: recommender as RecommendationProvider });
    assert.equal(result.status, "RECOVERED");
    assert.equal(result.status === "RECOVERED" && result.recommendation.selectedCandidateId, "RC-B");
    assert.equal(result.status === "RECOVERED" && result.recommendation.decisionSource, "DETERMINISTIC_FALLBACK");
  });
}

test("provider failures use deterministic RC-B fallback", async () => {
  const result = await runRecovery(request(), { recommender: { recommend: async () => { throw new Error("network unavailable"); } } });
  assert.equal(result.status === "RECOVERED" && result.recommendation.selectedCandidateId, "RC-B");
});

test("a real recommendation timeout falls back deterministically and records PROVIDER_TIMEOUT", async () => {
  const diagnostics: unknown[] = [];
  const result = await runRecovery(request(), {
    recommender: { recommend: async () => new Promise(() => {}) },
    recommendationTimeoutMs: 20,
    onRecommendationDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });
  assert.equal(result.status, "RECOVERED");
  if (result.status !== "RECOVERED") return;
  assert.equal(result.recommendation.selectedCandidateId, "RC-B");
  assert.equal(result.recommendation.decisionSource, "DETERMINISTIC_FALLBACK");
  assert.equal(result.decisionAudit.decisionSource, result.recommendation.decisionSource);
  assert.deepEqual(diagnostics, [{ category: "PROVIDER_TIMEOUT" }]);
});

test("post-validation rejection is diagnosed without weakening the deterministic fallback", async () => {
  const diagnostics: unknown[] = [];
  const result = await runRecovery(request(), { recommender: { recommend: async () => ({ selectedCandidateId: "RC-A", preference: "EARLIER_ARRIVAL", comparedCandidateId: "RC-B", facts: { ...rcAFacts, selectedExtraCost: 0 } }) }, onRecommendationDiagnostic: (diagnostic) => diagnostics.push(diagnostic) });
  assert.equal(result.status === "RECOVERED" && result.recommendation.selectedCandidateId, "RC-B");
  assert.deepEqual(diagnostics, [{ category: "POST_VALIDATION_REJECTED", rejection: "SELECTED_FACT_MISMATCH" }]);
});

test("the provider sees only feasible candidates and is never called when no recovery is feasible", async () => {
  let seen: string[] = []; let calls = 0;
  await runRecovery(request(), { recommender: { recommend: async (context) => { calls += 1; seen = context.feasibleCandidates.map((candidate) => candidate.id); return rcA.recommend(context); } } });
  assert.equal(calls, 1); assert.deepEqual(seen, ["RC-A", "RC-B"]);
  const fixture = demoScenarioFor("infeasible");
  const noFeasible = await runRecovery({ tripId: fixture.trip.id, tripVersion: fixture.trip.version, disruption: fixture.disruption }, { recommender: { recommend: async () => { calls += 1; throw new Error("must not run"); } } });
  assert.equal(noFeasible.status, "NO_FEASIBLE_RECOVERY"); assert.equal(calls, 1);
});

test("the provider receives the explicit priority and cannot override its deterministic ranking", async () => {
  let activePriority: string | undefined;
  let seen: string[] = [];
  const result = await runRecovery({ ...request(), constraintOverrides: { priority: "LOWER_COST" } }, {
    recommender: { recommend: async (context) => {
      activePriority = context.activePriority;
      seen = context.feasibleCandidates.map((candidate) => candidate.id);
      // A valid-but-wrong AI choice must be rejected in favour of the priority fallback.
      return { selectedCandidateId: "RC-A", preference: "LOWER_COST", comparedCandidateId: "RC-B", facts: rcAFacts };
    } },
  });
  assert.equal(activePriority, "LOWER_COST");
  assert.deepEqual(seen, ["RC-A", "RC-B"]);
  assert.equal(result.status === "RECOVERED" && result.recommendation.selectedCandidateId, "RC-B");
  assert.equal(result.status === "RECOVERED" && result.decisionAudit.appliedPriority, "LOWER_COST");
});

test("OpenAI adapter sends only feasible facts and parses a strict structured selection", async () => {
  let requestBody: Record<string, unknown> | undefined;
  const provider = new OpenAiRecommendationProvider({ apiKey: "test-key", model: "test-model", fetchFn: async (_url, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: JSON.stringify({ selectedCandidateId: "RC-A", preference: "EARLIER_ARRIVAL", comparedCandidateId: "RC-B", facts: rcAFacts }) }] }] }), { status: 200 });
  } });
  const result = await runRecovery(request(), { recommender: provider });
  assert.equal(result.status === "RECOVERED" && result.recommendation.decisionSource, "AI");
  const input = (requestBody?.input as { content: string }[])[1].content;
  assert.deepEqual(JSON.parse(input).feasibleCandidates.map((candidate: { id: string }) => candidate.id), ["RC-A", "RC-B"]);
  assert.equal(JSON.stringify(requestBody).includes("test-key"), false);
});

test("OpenAI HTTP, malformed output, and adapter timeout retain distinct safe fallback diagnostics", async () => {
  const cases = [
    [new OpenAiRecommendationProvider({ apiKey: "test-key", model: "test-model", fetchFn: async () => new Response("unavailable", { status: 503 }) }), { category: "PROVIDER_API_ERROR", httpStatus: 503 }],
    [new OpenAiRecommendationProvider({ apiKey: "test-key", model: "test-model", fetchFn: async () => new Response(JSON.stringify({ output_text: "not-json" }), { status: 200 }) }), { category: "PROVIDER_RESPONSE_PARSE_ERROR" }],
    [new OpenAiRecommendationProvider({ apiKey: "test-key", model: "test-model", timeoutMs: 10, fetchFn: async () => new Promise<Response>(() => undefined) }), { category: "PROVIDER_TIMEOUT" }],
  ] as const;
  for (const [recommender, expected] of cases) {
    const diagnostics: unknown[] = [];
    const result = await runRecovery(request(), { recommender, recommendationTimeoutMs: 100, onRecommendationDiagnostic: (diagnostic) => diagnostics.push(diagnostic) });
    assert.equal(result.status === "RECOVERED" && result.recommendation.decisionSource, "DETERMINISTIC_FALLBACK");
    assert.deepEqual(diagnostics, [expected]);
  }
});

test("missing OpenAI configuration leaves the provider unconfigured", () => {
  const previous = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  assert.equal(configuredOpenAiRecommendationProvider(), undefined);
  if (previous) process.env.OPENAI_API_KEY = previous;
});
