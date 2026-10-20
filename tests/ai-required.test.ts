import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "@google/genai";
import { goldenDisruption, goldenTrip } from "@/lib/domain/fixtures/golden-rail-delay-01";
import { recoveryRunOutcome } from "@/lib/recovery/http";
import { GeminiRecommendationProvider, type GeminiClient } from "@/lib/recovery/gemini-recommendation-provider";

const request = () => ({
  tripId: goldenTrip.id,
  tripVersion: goldenTrip.version,
  disruption: goldenDisruption,
});

const validDraft = {
  selectedCandidateId: "RC-A",
  preference: "EARLIER_ARRIVAL" as const,
  comparedCandidateId: "RC-B",
  facts: {
    selectedArrivalAt: "2026-11-10T17:45:00",
    selectedExtraCost: 450,
    comparedArrivalAt: "2026-11-10T18:30:00",
    comparedExtraCost: 350,
  },
};

function assertAiUnavailable(outcome: Awaited<ReturnType<typeof recoveryRunOutcome>>) {
  assert.equal(outcome.status, 500);
  const body = outcome.body as {
    status: string;
    error: { code: string };
    decisionAudit: { decisionSource: string; technicalError?: { code: string } };
  };
  assert.equal(body.status, "TECHNICAL_ERROR");
  assert.equal(body.error.code, "AI_UNAVAILABLE");
  assert.equal(body.decisionAudit.technicalError?.code, "AI_UNAVAILABLE");
  assert.equal(body.decisionAudit.decisionSource, "NONE");
}

test("AI-required recovery returns only an independently validated AI recommendation and matching audit", async () => {
  const client: GeminiClient = {
    models: {
      generateContent: async () => ({ text: JSON.stringify(validDraft) }),
    },
  };
  const outcome = await recoveryRunOutcome(request(), {
    aiRequired: true,
    recommender: new GeminiRecommendationProvider({ apiKey: "test-key", model: "test-model", client }),
  });
  assert.equal(outcome.status, 200);
  const body = outcome.body as {
    status: string;
    recommendation: { selectedCandidateId: string; decisionSource: string };
    decisionAudit: { selectedCandidateId: string; decisionSource: string };
    candidates: { id: string; feasible: boolean; violations: unknown[] }[];
  };
  assert.equal(body.status, "RECOVERED");
  assert.equal(body.recommendation.selectedCandidateId, "RC-A");
  assert.equal(body.recommendation.decisionSource, "AI");
  assert.equal(body.decisionAudit.selectedCandidateId, body.recommendation.selectedCandidateId);
  assert.equal(body.decisionAudit.decisionSource, body.recommendation.decisionSource);
  assert.deepEqual(body.candidates.find((candidate) => candidate.id === "RC-A")?.violations, []);
  assert.equal(body.candidates.find((candidate) => candidate.id === "RC-A")?.feasible, true);
});

test("AI-required recovery returns AI_UNAVAILABLE on provider failure", async () => {
  const outcome = await recoveryRunOutcome(request(), {
    aiRequired: true,
    recommender: { recommend: async () => { throw new Error("provider unavailable"); } },
  });
  assertAiUnavailable(outcome);
});

test("AI-required recovery returns AI_UNAVAILABLE on recommendation timeout", async () => {
  const outcome = await recoveryRunOutcome(request(), {
    aiRequired: true,
    recommendationTimeoutMs: 15,
    recommender: { recommend: async () => new Promise<never>(() => undefined) },
  });
  assertAiUnavailable(outcome);
});

test("AI-required recovery returns AI_UNAVAILABLE for malformed Gemini output", async () => {
  const client: GeminiClient = { models: { generateContent: async () => ({ text: "not-json" }) } };
  const outcome = await recoveryRunOutcome(request(), {
    aiRequired: true,
    recommender: new GeminiRecommendationProvider({ apiKey: "test-key", model: "test-model", client }),
  });
  assertAiUnavailable(outcome);
});

test("AI-required recovery returns AI_UNAVAILABLE when independent validation rejects output", async () => {
  const diagnostics: unknown[] = [];
  const outcome = await recoveryRunOutcome(request(), {
    aiRequired: true,
    onRecommendationDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    recommender: {
      recommend: async () => ({
        ...validDraft,
        facts: { ...validDraft.facts, selectedExtraCost: 0 },
      }),
    },
  });
  assertAiUnavailable(outcome);
  assert.deepEqual(diagnostics, [{ category: "POST_VALIDATION_REJECTED", rejection: "SELECTED_FACT_MISMATCH" }]);
});

test("AI-required mode never converts a Gemini HTTP failure into deterministic success", async () => {
  const client: GeminiClient = {
    models: {
      generateContent: async () => {
        throw new ApiError({ message: "provider failure", status: 503 });
      },
    },
  };
  const outcome = await recoveryRunOutcome(request(), {
    aiRequired: true,
    recommender: new GeminiRecommendationProvider({ apiKey: "test-key", model: "test-model", client }),
  });
  assertAiUnavailable(outcome);
});
