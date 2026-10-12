import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { demoScenarioFor } from "@/lib/domain/fixtures/recovery-scenarios";
import { runRecovery } from "@/lib/recovery/core";
import { presentRun, presentTrip } from "@/lib/rail-presentation";

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

test("frontend renders a technical error distinctly with a retry action", async () => {
  const { TechnicalErrorView } = await import("@/components/sutra/sections");
  const html = renderToStaticMarkup(createElement(TechnicalErrorView, { error: { code: "RECOVERY_SERVICE_UNAVAILABLE", message: "Recovery could not be calculated. Please retry." }, onRetry: noop }));
  assert.match(html, /system problem, not a recovery result/i);
  assert.match(html, /Retry/);
});
