import assert from "node:assert/strict";
import test from "node:test";
import { goldenDisruption, goldenTrip } from "@/lib/domain/fixtures/golden-rail-delay-01";
import { demoScenarioFor } from "@/lib/domain/fixtures/recovery-scenarios";
import { runRecovery } from "@/lib/recovery/core";

const request = () => ({ tripId: goldenTrip.id, tripVersion: goldenTrip.version, disruption: goldenDisruption });

test("a recovered decision selects one feasible, uniquely audited candidate", async () => {
  const result = await runRecovery(request());
  assert.equal(result.status, "RECOVERED");
  if (result.status !== "RECOVERED") return;

  const selected = result.candidates.filter((candidate) => candidate.id === result.recommendation.selectedCandidateId);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].feasible, true);
  assert.equal(result.recoveryPlan.selectedCandidateId, result.recommendation.selectedCandidateId);
  assert.equal(result.decisionAudit.status, "RECOVERED");
  assert.equal(result.decisionAudit.selectedCandidateId, result.recommendation.selectedCandidateId);
  assert.equal(result.decisionAudit.decisionSource, result.recommendation.decisionSource);
  assert.deepEqual(result.decisionAudit.candidates.map((candidate) => candidate.candidateId), result.candidates.map((candidate) => candidate.id));
  assert.equal(new Set(result.candidates.map((candidate) => candidate.id)).size, result.candidates.length);
});

test("an infeasible recovery has no selection and audits only failed candidates", async () => {
  const fixture = demoScenarioFor("infeasible");
  const result = await runRecovery({ tripId: fixture.trip.id, tripVersion: fixture.trip.version, disruption: fixture.disruption });
  assert.equal(result.status, "NO_FEASIBLE_RECOVERY");
  if (result.status !== "NO_FEASIBLE_RECOVERY") return;

  assert.equal(result.recommendation, null);
  assert.equal(result.recoveryPlan, null);
  assert.equal(result.decisionAudit.status, "NO_FEASIBLE_RECOVERY");
  assert.equal(result.decisionAudit.decisionSource, "NONE");
  assert.equal(result.decisionAudit.selectedCandidateId, null);
  assert.ok(result.candidates.every((candidate) => !candidate.feasible));
  assert.ok(result.candidates.every((candidate) => candidate.violations.length > 0));
  assert.deepEqual(result.decisionAudit.noFeasibleReasons, result.decisionAudit.candidates.flatMap((candidate) => candidate.violations));
});

test("hard constraints and an explicit priority constrain both fallback and AI selections", async () => {
  const lowerCost = await runRecovery({ ...request(), constraintOverrides: { priority: "LOWER_COST" } }, {
    recommender: { recommend: async () => ({ selectedCandidateId: "RC-A", preference: "LOWER_COST", comparedCandidateId: "RC-B", facts: { selectedArrivalAt: "2026-11-10T17:45:00", selectedExtraCost: 450, comparedArrivalAt: "2026-11-10T18:30:00", comparedExtraCost: 350 } }) },
  });
  assert.equal(lowerCost.status === "RECOVERED" && lowerCost.recommendation.selectedCandidateId, "RC-B");

  const constrained = await runRecovery({ ...request(), constraintOverrides: { latestArrivalAt: "2026-11-10T18:00:00", priority: "LOWER_COST" } });
  assert.equal(constrained.status, "RECOVERED");
  if (constrained.status !== "RECOVERED") return;
  assert.equal(constrained.recommendation.selectedCandidateId, "RC-A");
  assert.equal(constrained.candidates.find((candidate) => candidate.id === "RC-B")?.feasible, false);
});
