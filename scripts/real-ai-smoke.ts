import { loadEnvConfig } from "@next/env";
import { goldenDisruption, goldenTrip } from "@/lib/domain/fixtures/golden-rail-delay-01";
import type { ValidatedRecoveryCandidate } from "@/lib/domain/types";
import { runRecovery, type RecommendationDiagnostic, type RecommendationProvider } from "@/lib/recovery/core";
import { selectRecommendationProvider } from "@/lib/recovery/provider-selection";

loadEnvConfig(process.cwd());

type SmokeScenario = {
  name: string;
  expectedCandidateId: string;
  input: Parameters<typeof runRecovery>[0];
  verifyBackendCandidate?: (candidate: ValidatedRecoveryCandidate) => boolean;
};

const scenarios: SmokeScenario[] = [
  {
    name: "golden-rail-delay",
    expectedCandidateId: "RC-A",
    input: { tripId: goldenTrip.id, tripVersion: goldenTrip.version, disruption: goldenDisruption, constraintOverrides: { priority: "EARLIER_ARRIVAL" } },
  },
  {
    name: "bengaluru-to-jaipur-flight-cancellation",
    expectedCandidateId: "FDJ-A",
    input: {
      tripId: "trip-bengaluru-delhi-jaipur-01",
      tripVersion: 1,
      disruption: { source: "SIMULATED", scenarioId: "bengaluru-delhi-flight-cancellation-01", bookingId: "FLIGHT-BLR-DEL", kind: "cancellation" },
      constraintOverrides: { latestArrivalAt: "2026-12-05T16:30:00", maxExtraBudget: 4000, noOvernight: true, priority: "LOWER_COST" },
    },
    verifyBackendCandidate: (candidate) => candidate.extraCost <= 4000
      && candidate.connectionChecks.some((check) => check.passed && check.actualBufferMinutes !== null && check.actualBufferMinutes >= check.minimumBufferMinutes),
  },
];

async function verifyScenario(scenario: SmokeScenario, recommender: RecommendationProvider) {
  const diagnostics: RecommendationDiagnostic[] = [];
  const result = await runRecovery(scenario.input, { recommender, onRecommendationDiagnostic: (diagnostic) => diagnostics.push(diagnostic) });
  const selectedCandidate = result.status === "RECOVERED" ? result.candidates.find((candidate) => candidate.id === scenario.expectedCandidateId) : undefined;
  const verified = result.status === "RECOVERED"
    && result.recommendation.decisionSource === "AI"
    && result.decisionAudit.decisionSource === "AI"
    && result.recommendation.selectedCandidateId === scenario.expectedCandidateId
    && result.decisionAudit.selectedCandidateId === scenario.expectedCandidateId
    && result.recoveryPlan.selectedCandidateId === scenario.expectedCandidateId
    && Boolean(selectedCandidate?.feasible)
    && selectedCandidate?.violations.length === 0
    && (!scenario.verifyBackendCandidate || Boolean(selectedCandidate && scenario.verifyBackendCandidate(selectedCandidate)))
    && diagnostics.length === 0;

  console.log(JSON.stringify({ scenario: scenario.name, verification: verified ? "VERIFIED" : "FAILED", status: result.status, selectedCandidateId: result.status === "RECOVERED" ? result.recommendation.selectedCandidateId : null, decisionSource: result.status === "RECOVERED" ? result.recommendation.decisionSource : null, auditDecisionSource: result.decisionAudit.decisionSource, diagnostics }));
  return verified;
}

async function main() {
  const selection = selectRecommendationProvider();
  if (!selection.recommender || selection.provider !== "gemini") {
    console.error(JSON.stringify({ verification: "NOT VERIFIED", reason: "A configured Gemini provider is required.", provider: selection.provider ?? null, model: selection.model ?? null, diagnostic: selection.diagnostic ?? null }));
    process.exitCode = 2;
    return;
  }
  const results = await Promise.all(scenarios.map((scenario) => verifyScenario(scenario, selection.recommender!)));
  if (results.some((verified) => !verified)) process.exitCode = 1;
}

main().catch(() => {
  console.error(JSON.stringify({ verification: "FAILED", reason: "The smoke test could not complete." }));
  process.exitCode = 1;
});
