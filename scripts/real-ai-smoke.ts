import { loadEnvConfig } from "@next/env";
import { goldenDisruption, goldenTrip } from "@/lib/domain/fixtures/golden-rail-delay-01";
import { runRecovery, type RecommendationDiagnostic } from "@/lib/recovery/core";
import { selectRecommendationProvider } from "@/lib/recovery/provider-selection";

loadEnvConfig(process.cwd());

async function main() {
  const selection = selectRecommendationProvider();
  if (!selection.recommender) {
    console.error(JSON.stringify({ verification: "NOT VERIFIED", reason: "No configured AI provider is available.", diagnostic: selection.diagnostic ?? null }));
    process.exitCode = 2;
    return;
  }
  const diagnostics: RecommendationDiagnostic[] = [];
  const result = await runRecovery({
    tripId: goldenTrip.id,
    tripVersion: goldenTrip.version,
    disruption: goldenDisruption,
    constraintOverrides: { priority: "EARLIER_ARRIVAL" },
  }, {
    recommender: selection.recommender,
    onRecommendationDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });

  const verified = result.status === "RECOVERED"
    && result.recommendation.decisionSource === "AI"
    && result.decisionAudit.decisionSource === "AI"
    && result.recommendation.selectedCandidateId === "RC-A"
    && result.decisionAudit.selectedCandidateId === "RC-A"
    && result.recoveryPlan.selectedCandidateId === "RC-A"
    && result.candidates.filter((candidate) => candidate.id === "RC-A" && candidate.feasible && candidate.violations.length === 0).length === 1
    && result.recommendation.tradeoffs?.includes("RC-A arrives 45 minutes earlier than RC-B.")
    && result.recommendation.tradeoffs?.includes("RC-A costs ₹100 more than RC-B.");

  console.log(JSON.stringify({
    verification: verified ? "VERIFIED" : "FAILED",
    provider: selection.provider,
    model: selection.model,
    status: result.status,
    selectedCandidateId: result.status === "RECOVERED" ? result.recommendation.selectedCandidateId : null,
    decisionSource: result.status === "RECOVERED" ? result.recommendation.decisionSource : null,
    auditDecisionSource: result.decisionAudit.decisionSource,
    diagnostics,
  }));
  if (!verified) process.exitCode = 1;
}

main().catch(() => {
  console.error(JSON.stringify({ verification: "FAILED", reason: "The smoke test could not complete." }));
  process.exitCode = 1;
});
