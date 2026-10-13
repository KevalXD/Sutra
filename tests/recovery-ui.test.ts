import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { demoScenarioFor } from "@/lib/domain/fixtures/recovery-scenarios";
import { goldenDisruption, goldenTrip } from "@/lib/domain/fixtures/golden-rail-delay-01";
import { runRecovery } from "@/lib/recovery/core";
import { presentRun, presentTrip } from "@/lib/rail-presentation";
import { getTrip, runScenario } from "@/lib/api";

const noop = () => {};
// The application uses Next's automatic JSX runtime; tsx's Node test transform
// uses the classic runtime, so expose React before loading the client components.
(globalThis as typeof globalThis & { React?: typeof React }).React = React;

test("frontend renders the cancellation recovery supplied by the API projection", async () => {
  const fixture = demoScenarioFor("cancellation");
  const run = await runRecovery({ tripId: fixture.trip.id, tripVersion: fixture.trip.version, disruption: fixture.disruption });
  assert.equal(run.status, "RECOVERED");
  if (run.status !== "RECOVERED") return;
  const { RecoveryResultView } = await import("@/components/sutra/result");
  const projected = presentRun(fixture.trip, run);
  const html = renderToStaticMarkup(createElement(RecoveryResultView, { trip: presentTrip(fixture.trip), result: projected.result, candidates: projected.candidates, selectedId: projected.selectedId, onRestart: noop }));
  assert.match(html, /Journey repaired/);
  assert.match(html, /CC-A/);
});

test("frontend renders no-feasible explanations from API candidate violations", async () => {
  const fixture = demoScenarioFor("infeasible");
  const run = await runRecovery({ tripId: fixture.trip.id, tripVersion: fixture.trip.version, disruption: fixture.disruption });
  assert.equal(run.status, "NO_FEASIBLE_RECOVERY");
  const { NoFeasibleView } = await import("@/components/sutra/result");
  const projected = presentRun(fixture.trip, run);
  const html = renderToStaticMarkup(createElement(NoFeasibleView, { trip: presentTrip(fixture.trip), result: projected.result, candidates: projected.candidates, onRestart: noop }));
  assert.match(html, /No feasible recovery/);
  assert.match(html, /Arrival deadline/);
});

test("frontend labels a post-validated AI recommendation and renders backend-derived trade-offs", async () => {
  const run = await runRecovery({ tripId: goldenTrip.id, tripVersion: goldenTrip.version, disruption: goldenDisruption }, { recommender: { recommend: async () => ({ selectedCandidateId: "RC-A", preference: "EARLIER_ARRIVAL", comparedCandidateId: "RC-B", facts: { selectedArrivalAt: "2026-11-10T17:45:00", selectedExtraCost: 450, comparedArrivalAt: "2026-11-10T18:30:00", comparedExtraCost: 350 } }) } });
  assert.equal(run.status, "RECOVERED");
  if (run.status !== "RECOVERED") return;
  const { RecoveryResultView } = await import("@/components/sutra/result");
  const projected = presentRun(goldenTrip, run);
  const html = renderToStaticMarkup(createElement(RecoveryResultView, { trip: presentTrip(goldenTrip), result: projected.result, candidates: projected.candidates, selectedId: projected.selectedId, onRestart: noop }));
  assert.match(html, /AI recommendation \(post-validated\)/);
  assert.match(html, /RC-A arrives 45 minutes earlier than RC-B/);
});

test("frontend renders API-returned traveller actions as pending traveller work", async () => {
  const run = await runRecovery({ tripId: goldenTrip.id, tripVersion: goldenTrip.version, disruption: goldenDisruption });
  assert.equal(run.status, "RECOVERED");
  if (run.status !== "RECOVERED") return;
  const { RecoveryResultView } = await import("@/components/sutra/result");
  const projected = presentRun(goldenTrip, run);
  const html = renderToStaticMarkup(createElement(RecoveryResultView, { trip: presentTrip(goldenTrip), result: projected.result, candidates: projected.candidates, selectedId: projected.selectedId, onRestart: noop }));
  assert.match(html, /What to do next/);
  assert.match(html, /Book simulated replacement RC-B-ALT\./);
  assert.match(html, /BOOK REPLACEMENT.*booking\/item: RAIL-B/);
  assert.match(html, /Traveller action required/);
  assert.match(html, /Not completed automatically — no booking or reservation has been changed\./);
  assert.doesNotMatch(html, /Booking confirmed/);
});

test("frontend API client uses only canonical v1 trip and recovery-run endpoints", async () => {
  const originalFetch = globalThis.fetch;
  const paths: string[] = [];
  const run = await runRecovery({ tripId: goldenTrip.id, tripVersion: goldenTrip.version, disruption: goldenDisruption });
  globalThis.fetch = (async (input: string | URL | Request) => {
    paths.push(typeof input === "string" ? input : input.toString());
    return new Response(JSON.stringify(paths.length === 1 ? goldenTrip : run), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    await getTrip("delay", 0);
    await runScenario("delay", 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(paths, ["/api/v1/trips/trip-golden-rail-delay-01", "/api/v1/recovery-runs"]);
});

test("presentation renders validator-provided delayed timing and connection buffers", async () => {
  const run = await runRecovery({ tripId: goldenTrip.id, tripVersion: goldenTrip.version, disruption: goldenDisruption });
  assert.equal(run.status, "RECOVERED");
  if (run.status !== "RECOVERED") return;
  const projected = presentRun(goldenTrip, run);
  const rcA = projected.candidates.find((candidate) => candidate.id === "RC-A")!;
  const rcB = projected.candidates.find((candidate) => candidate.id === "RC-B")!;
  const railA = projected.result.itinerary.find((booking) => booking.id === "RAIL-A")!;
  assert.equal(railA.end, "2026-11-10T15:00:00");
  assert.equal(railA.originalEnd, "2026-11-10T13:00:00");
  assert.equal(railA.impactState, "DISRUPTED");
  assert.equal(railA.recoveryChange, "UNCHANGED");
  assert.deepEqual(rcA.connectionChecks?.[0] && { departure: rcA.connectionChecks[0].replacementDepartureAt, buffer: rcA.connectionChecks[0].actualBufferMinutes, minimum: rcA.connectionChecks[0].minimumBufferMinutes }, { departure: "2026-11-10T15:30:00", buffer: 30, minimum: 30 });
  assert.deepEqual(rcB.connectionChecks?.[0] && { departure: rcB.connectionChecks[0].replacementDepartureAt, buffer: rcB.connectionChecks[0].actualBufferMinutes, minimum: rcB.connectionChecks[0].minimumBufferMinutes }, { departure: "2026-11-10T16:00:00", buffer: 60, minimum: 30 });
  const { RecoveryResultView } = await import("@/components/sutra/result");
  const html = renderToStaticMarkup(createElement(RecoveryResultView, { trip: presentTrip(goldenTrip), result: projected.result, candidates: projected.candidates, selectedId: projected.selectedId, onRestart: noop }));
  assert.match(html, /Disrupted timing/);
  assert.match(html, /Disrupted/);
  assert.doesNotMatch(html, /CHANGED RAIL-A/);
  assert.match(html, /30m buffer/);
  assert.match(html, /1h 00m buffer/);
});

test("frontend renders a technical error distinctly with a retry action", async () => {
  const { TechnicalErrorView } = await import("@/components/sutra/sections");
  const html = renderToStaticMarkup(createElement(TechnicalErrorView, { error: { code: "RECOVERY_SERVICE_UNAVAILABLE", message: "Recovery could not be calculated. Please retry." }, onRetry: noop }));
  assert.match(html, /system problem, not a recovery result/i);
  assert.match(html, /Retry/);
});
