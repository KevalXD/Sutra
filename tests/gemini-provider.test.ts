import assert from "node:assert/strict";
import test from "node:test";
import { goldenDisruption, goldenTrip } from "@/lib/domain/fixtures/golden-rail-delay-01";
import { GEMINI_REQUEST_TIMEOUT_MS, GeminiRecommendationProvider, type GeminiClient } from "@/lib/recovery/gemini-recommendation-provider";
import { selectRecommendationProvider, type ProviderFactories } from "@/lib/recovery/provider-selection";
import { runRecovery, type RecommendationProvider } from "@/lib/recovery/core";

const request = () => ({ tripId: goldenTrip.id, tripVersion: goldenTrip.version, disruption: goldenDisruption });
const output = { selectedCandidateId: "RC-A", preference: "EARLIER_ARRIVAL" as const, comparedCandidateId: "RC-B", facts: { selectedArrivalAt: "2026-11-10T17:45:00", selectedExtraCost: 450, comparedArrivalAt: "2026-11-10T18:30:00", comparedExtraCost: 350 } };
const fakeProvider: RecommendationProvider = { recommend: async () => output };
const factories = (calls: string[]): ProviderFactories => ({ gemini: () => { calls.push("gemini"); return fakeProvider; }, openai: () => { calls.push("openai"); return fakeProvider; } });

test("Gemini adapter requests strict JSON output and maps it through the shared validated interface", async () => {
  let params: Record<string, unknown> | undefined;
  const client: GeminiClient = { models: { generateContent: async (input) => { params = input as Record<string, unknown>; return { text: JSON.stringify(output) }; } } };
  const provider = new GeminiRecommendationProvider({ apiKey: "test-key", model: "gemini-test", timeoutMs: 1234, client });
  const result = await runRecovery(request(), { recommender: provider });
  assert.equal(result.status === "RECOVERED" && result.recommendation.selectedCandidateId, "RC-A");
  assert.equal(result.status === "RECOVERED" && result.recommendation.decisionSource, "AI");
  assert.equal(params?.model, "gemini-test");
  assert.equal((params?.config as { responseMimeType: string }).responseMimeType, "application/json");
  assert.match(String(params?.contents), /"id":"RC-A"/);
  assert.match(String(params?.contents), /"id":"RC-B"/);
  assert.doesNotMatch(String(params?.contents), /RC-C/);
});

test("Gemini API and parsing failures emit distinct safe fallback diagnostics", async () => {
  const apiFailure: GeminiClient = { models: { generateContent: async () => { const error = new Error("not found") as Error & { status: number }; error.status = 404; throw error; } } };
  const parseFailure: GeminiClient = { models: { generateContent: async () => ({ text: "not-json" }) } };
  for (const [client, expected] of [[apiFailure, { category: "PROVIDER_API_ERROR", httpStatus: 404 }], [parseFailure, { category: "PROVIDER_RESPONSE_PARSE_ERROR" }]] as const) {
    const diagnostics: unknown[] = [];
    const result = await runRecovery(request(), { recommender: new GeminiRecommendationProvider({ apiKey: "test-key", model: "gemini-test", client }), onRecommendationDiagnostic: (diagnostic) => diagnostics.push(diagnostic) });
    assert.equal(result.status === "RECOVERED" && result.recommendation.decisionSource, "DETERMINISTIC_FALLBACK");
    assert.deepEqual(diagnostics, [expected]);
  }
});

test("Gemini disables the SDK's default retries for a 503 and falls back", async () => {
  let calls = 0;
  const provider = new GeminiRecommendationProvider({
    apiKey: "test-key", model: "gemini-test", fetchFn: async () => {
      calls += 1;
      return new Response("temporarily unavailable", { status: 503 });
    },
  });
  const result = await runRecovery(request(), { recommender: provider });
  assert.equal(calls, 1);
  assert.equal(result.status === "RECOVERED" && result.recommendation.selectedCandidateId, "RC-B");
  assert.equal(GEMINI_REQUEST_TIMEOUT_MS, 9_500);
});

test("a hung provider is cut off by the total recommendation budget before deterministic fallback", async () => {
  const started = performance.now();
  const result = await runRecovery(request(), {
    recommender: { recommend: async () => new Promise<never>(() => undefined) },
    recommendationTimeoutMs: 25,
  });
  const elapsed = performance.now() - started;
  assert.ok(elapsed >= 20 && elapsed < 250, `fallback took ${elapsed}ms`);
  assert.equal(result.status === "RECOVERED" && result.recommendation.selectedCandidateId, "RC-B");
});

test("malformed Gemini output and Gemini HTTP-like failures preserve deterministic fallback", async () => {
  const malformed: GeminiClient = { models: { generateContent: async () => ({ text: "not-json" }) } };
  const failed: GeminiClient = { models: { generateContent: async () => { throw new Error("Gemini HTTP 503"); } } };
  for (const client of [malformed, failed]) {
    const result = await runRecovery(request(), { recommender: new GeminiRecommendationProvider({ apiKey: "test-key", model: "gemini-test", client }) });
    assert.equal(result.status === "RECOVERED" && result.recommendation.selectedCandidateId, "RC-B");
    assert.equal(result.status === "RECOVERED" && result.recommendation.decisionSource, "DETERMINISTIC_FALLBACK");
  }
});

test("provider selection prefers Gemini in automatic mode and does not instantiate OpenAI", () => {
  const calls: string[] = [];
  const selection = selectRecommendationProvider({ GEMINI_API_KEY: "g", OPENAI_API_KEY: "o" }, factories(calls));
  assert.equal(selection.provider, "gemini"); assert.deepEqual(calls, ["gemini"]);
});

test("explicit Gemini selection constructs Gemini with its configured model", () => {
  const calls: string[] = [];
  const selection = selectRecommendationProvider({ SUTRA_AI_PROVIDER: "gemini", GEMINI_API_KEY: "g", SUTRA_GEMINI_MODEL: "gemini-test" }, factories(calls));
  assert.equal(selection.provider, "gemini"); assert.equal(selection.model, "gemini-test"); assert.ok(selection.recommender); assert.deepEqual(calls, ["gemini"]);
});

test("provider selection explicitly selects OpenAI or falls back to OpenAI in auto mode", () => {
  let calls: string[] = [];
  let selection = selectRecommendationProvider({ SUTRA_AI_PROVIDER: "openai", OPENAI_API_KEY: "o", GEMINI_API_KEY: "g" }, factories(calls));
  assert.equal(selection.provider, "openai"); assert.deepEqual(calls, ["openai"]);
  calls = [];
  selection = selectRecommendationProvider({ OPENAI_API_KEY: "o" }, factories(calls));
  assert.equal(selection.provider, "openai"); assert.deepEqual(calls, ["openai"]);
});

test("missing explicit credentials yields an actionable diagnostic and no provider", () => {
  const calls: string[] = [];
  const selection = selectRecommendationProvider({ SUTRA_AI_PROVIDER: "gemini" }, factories(calls));
  assert.equal(selection.recommender, undefined); assert.match(selection.diagnostic ?? "", /GEMINI_API_KEY is missing/); assert.deepEqual(calls, []);
  const unconfigured = selectRecommendationProvider({}, factories(calls));
  assert.equal(unconfigured.recommender, undefined); assert.match(unconfigured.diagnostic ?? "", /No AI provider credentials/);
});
