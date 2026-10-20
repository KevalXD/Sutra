import assert from "node:assert/strict";
import test from "node:test";
import { goldenDisruption, goldenTrip } from "@/lib/domain/fixtures/golden-rail-delay-01";
import { executeRecoveryRun } from "@/lib/recovery/route-runner";

test("the canonical recovery route injects an explicitly selected provider into the recovery pipeline", async () => {
  const outcome = await executeRecoveryRun({ tripId: goldenTrip.id, tripVersion: goldenTrip.version, disruption: goldenDisruption }, {
    provider: "gemini", model: "gemini-test",
    recommender: { recommend: async () => ({ selectedCandidateId: "RC-A", preference: "EARLIER_ARRIVAL", comparedCandidateId: "RC-B", facts: { selectedArrivalAt: "2026-11-10T17:45:00", selectedExtraCost: 450, comparedArrivalAt: "2026-11-10T18:30:00", comparedExtraCost: 350 } }) },
  });
  const body = outcome.body as { status: string; recommendation: { selectedCandidateId: string; decisionSource: string } };
  assert.equal(outcome.status, 200);
  assert.equal(body.status, "RECOVERED");
  assert.equal(body.recommendation.selectedCandidateId, "RC-A");
  assert.equal(body.recommendation.decisionSource, "AI");
});

test("the canonical route converts missing required Gemini configuration into AI_UNAVAILABLE", async () => {
  const outcome = await executeRecoveryRun(
    { tripId: goldenTrip.id, tripVersion: goldenTrip.version, disruption: goldenDisruption },
    { aiRequired: true, diagnostic: "AI-required mode needs GEMINI_API_KEY." },
  );
  assert.equal(outcome.status, 500);
  const body = outcome.body as { error: { code: string }; decisionAudit: { decisionSource: string } };
  assert.equal(body.error.code, "AI_UNAVAILABLE");
  assert.equal(body.decisionAudit.decisionSource, "NONE");
});
