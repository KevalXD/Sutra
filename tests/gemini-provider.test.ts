import assert from "node:assert/strict";
import test from "node:test";
import { goldenDisruption, goldenTrip } from "@/lib/domain/fixtures/golden-rail-delay-01";
import { ApiError } from "@google/genai";
import { GEMINI_REQUEST_TIMEOUT_MS, GeminiRecommendationProvider, type GeminiClient } from "@/lib/recovery/gemini-recommendation-provider";
import { selectRecommendationProvider, type ProviderFactories } from "@/lib/recovery/provider-selection";
import { AI_RECOMMENDATION_BUDGET_MS, runRecovery, type RecommendationProvider } from "@/lib/recovery/core";

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

test("Gemini retries one transient 503 and accepts the validated AI recommendation", async () => {
  let calls = 0;
  const client: GeminiClient = {
    models: {
      generateContent: async () => {
        calls += 1;
        if (calls === 1) throw new ApiError({ message: "temporary overload", status: 503 });
        return { text: JSON.stringify(output) };
      },
    },
  };
  const result = await runRecovery(request(), {
    recommender: new GeminiRecommendationProvider({ apiKey: "test-key", model: "gemini-test", client }),
  });
  assert.equal(calls, 2);
  assert.equal(result.status === "RECOVERED" && result.recommendation.selectedCandidateId, "RC-A");
  assert.equal(result.status === "RECOVERED" && result.recommendation.decisionSource, "AI");
});

test("two Gemini 503 responses retain deterministic fallback", async () => {
  let calls = 0;
  const client: GeminiClient = {
    models: {
      generateContent: async () => {
        calls += 1;
        throw new ApiError({ message: "temporary overload", status: 503 });
      },
    },
  };
  const diagnostics: unknown[] = [];
  const result = await runRecovery(request(), {
    recommender: new GeminiRecommendationProvider({ apiKey: "test-key", model: "gemini-test", client }),
    onRecommendationDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });
  assert.equal(calls, 2);
  assert.equal(result.status === "RECOVERED" && result.recommendation.selectedCandidateId, "RC-B");
  assert.equal(result.status === "RECOVERED" && result.recommendation.decisionSource, "DETERMINISTIC_FALLBACK");
  assert.deepEqual(diagnostics, [{ category: "PROVIDER_API_ERROR", httpStatus: 503, providerErrorName: "ApiError" }]);
});

test("Gemini API and parsing failures emit distinct safe fallback diagnostics", async () => {
  const apiFailure: GeminiClient = { models: { generateContent: async () => { throw new ApiError({ message: "not found", status: 404 }); } } };
  const parseFailure: GeminiClient = { models: { generateContent: async () => ({ text: "not-json" }) } };
  for (const [client, expected] of [[apiFailure, { category: "PROVIDER_MODEL_UNAVAILABLE", httpStatus: 404, providerErrorName: "ApiError" }], [parseFailure, { category: "PROVIDER_RESPONSE_PARSE_ERROR" }]] as const) {
    const diagnostics: unknown[] = [];
    const result = await runRecovery(request(), { recommender: new GeminiRecommendationProvider({ apiKey: "test-key", model: "gemini-test", client }), onRecommendationDiagnostic: (diagnostic) => diagnostics.push(diagnostic) });
    assert.equal(result.status === "RECOVERED" && result.recommendation.decisionSource, "DETERMINISTIC_FALLBACK");
    assert.deepEqual(diagnostics, [expected]);
  }
});

test("Gemini ApiError status safely distinguishes auth, model, quota, and generic API failures", async () => {
  for (const [status, category] of [[400, "PROVIDER_API_ERROR"], [401, "PROVIDER_AUTHENTICATION_ERROR"], [403, "PROVIDER_AUTHENTICATION_ERROR"], [404, "PROVIDER_MODEL_UNAVAILABLE"], [429, "PROVIDER_QUOTA_ERROR"]] as const) {
    const diagnostics: unknown[] = [];
    const client: GeminiClient = { models: { generateContent: async () => { throw new ApiError({ message: "Bearer test-key must never be logged", status }); } } };
    const result = await runRecovery(request(), { recommender: new GeminiRecommendationProvider({ apiKey: "test-key", model: "gemini-test", client }), onRecommendationDiagnostic: (diagnostic) => diagnostics.push(diagnostic) });
    assert.equal(result.status === "RECOVERED" && result.recommendation.decisionSource, "DETERMINISTIC_FALLBACK");
    assert.deepEqual(diagnostics, [{ category, httpStatus: status, providerErrorName: "ApiError" }]);
    assert.equal(JSON.stringify(diagnostics).includes("test-key"), false);
  }
});

test("Gemini does not retry authentication, permission, invalid-request, or missing-model errors", async () => {
  for (const status of [400, 401, 403, 404]) {
    let calls = 0;
    const client: GeminiClient = {
      models: {
        generateContent: async () => {
          calls += 1;
          throw new ApiError({ message: "non-retryable failure", status });
        },
      },
    };
    const result = await runRecovery(request(), {
      recommender: new GeminiRecommendationProvider({ apiKey: "test-key", model: "gemini-test", client }),
    });
    assert.equal(calls, 1);
    assert.equal(result.status === "RECOVERED" && result.recommendation.decisionSource, "DETERMINISTIC_FALLBACK");
  }
});

test("Gemini connection and unknown errors preserve safe fallback without raw messages", async () => {
  for (const error of [Object.assign(new Error("DNS host internal.example"), { name: "APIConnectionError" }), new Error("Authorization: Bearer test-key")]) {
    const diagnostics: unknown[] = [];
    const client: GeminiClient = { models: { generateContent: async () => { throw error; } } };
    const result = await runRecovery(request(), { recommender: new GeminiRecommendationProvider({ apiKey: "test-key", model: "gemini-test", client }), onRecommendationDiagnostic: (diagnostic) => diagnostics.push(diagnostic) });
    assert.equal(result.status === "RECOVERED" && result.recommendation.decisionSource, "DETERMINISTIC_FALLBACK");
    assert.equal(JSON.stringify(diagnostics).includes("test-key"), false);
    assert.equal(JSON.stringify(diagnostics).includes("internal.example"), false);
  }
});

test("Gemini retries one 503 beyond the SDK attempt and then falls back", async () => {
  let calls = 0;
  const provider = new GeminiRecommendationProvider({
    apiKey: "test-key", model: "gemini-test", fetchFn: async () => {
      calls += 1;
      return new Response("temporarily unavailable", { status: 503 });
    },
  });
  const result = await runRecovery(request(), { recommender: provider });
  assert.equal(calls, 2);
  assert.equal(result.status === "RECOVERED" && result.recommendation.selectedCandidateId, "RC-B");
  assert.equal(
    GEMINI_REQUEST_TIMEOUT_MS,
    AI_RECOMMENDATION_BUDGET_MS - 500,
  );
});

test("the recommendation deadline cancels a pending Gemini retry", async () => {
  let calls = 0;
  const client: GeminiClient = {
    models: {
      generateContent: async (input) => {
        calls += 1;
        if (calls === 1) throw new ApiError({ message: "temporary overload", status: 503 });
        const signal = (input as { config?: { abortSignal?: AbortSignal } }).config?.abortSignal;
        return new Promise<never>((_resolve, reject) => {
          if (!signal) {
            reject(new Error("The recommendation deadline signal was not propagated."));
            return;
          }
          if (signal.aborted) {
            reject(new Error("The recommendation deadline elapsed."));
            return;
          }
          signal.addEventListener("abort", () => reject(new Error("The recommendation deadline elapsed.")), { once: true });
        });
      },
    },
  };
  const started = performance.now();
  const result = await runRecovery(request(), {
    recommender: new GeminiRecommendationProvider({ apiKey: "test-key", model: "gemini-test", client }),
    recommendationTimeoutMs: 25,
  });
  const elapsed = performance.now() - started;
  assert.ok(elapsed >= 20 && elapsed < 250, `fallback took ${elapsed}ms`);
  assert.equal(calls <= 2, true);
  assert.equal(result.status === "RECOVERED" && result.recommendation.selectedCandidateId, "RC-B");
  assert.equal(result.status === "RECOVERED" && result.recommendation.decisionSource, "DETERMINISTIC_FALLBACK");
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

test("AI-required mode selects Gemini exclusively and records the requirement", () => {
  const calls: string[] = [];
  const selection = selectRecommendationProvider({
    SUTRA_AI_REQUIRED: "true",
    SUTRA_AI_PROVIDER: "auto",
    GEMINI_API_KEY: "g",
    OPENAI_API_KEY: "o",
  }, factories(calls));
  assert.equal(selection.aiRequired, true);
  assert.equal(selection.provider, "gemini");
  assert.deepEqual(calls, ["gemini"]);
});

test("AI-required mode refuses missing Gemini credentials and conflicting OpenAI selection", () => {
  const calls: string[] = [];
  const missing = selectRecommendationProvider({ SUTRA_AI_REQUIRED: "true", OPENAI_API_KEY: "o" }, factories(calls));
  assert.equal(missing.aiRequired, true);
  assert.equal(missing.recommender, undefined);
  assert.match(missing.diagnostic ?? "", /GEMINI_API_KEY/);
  const conflict = selectRecommendationProvider({
    SUTRA_AI_REQUIRED: "true",
    SUTRA_AI_PROVIDER: "openai",
    GEMINI_API_KEY: "g",
    OPENAI_API_KEY: "o",
  }, factories(calls));
  assert.equal(conflict.aiRequired, true);
  assert.equal(conflict.recommender, undefined);
  assert.match(conflict.diagnostic ?? "", /requires Gemini/);
  assert.deepEqual(calls, []);
});

test("AI-required mode reports Gemini initialization failure without exposing provider details", () => {
  const selection = selectRecommendationProvider(
    { SUTRA_AI_REQUIRED: "true", GEMINI_API_KEY: "g" },
    { gemini: () => { throw new Error("private provider initialization detail"); }, openai: () => fakeProvider },
  );
  assert.equal(selection.aiRequired, true);
  assert.equal(selection.recommender, undefined);
  assert.equal(selection.diagnostic, "AI-required mode could not initialize Gemini.");
  assert.doesNotMatch(selection.diagnostic, /private provider initialization detail/);
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
