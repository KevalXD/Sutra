import assert from "node:assert/strict";
import test from "node:test";
import { evaluateDependencies, TechnicalFailure } from "@/lib/recovery/core";
import type { Trip } from "@/lib/domain/types";

const baseTrip = (): Trip => ({
  id: "dependency-test", version: 1, currency: "INR", constraints: { noOvernight: false },
  items: [
    { id: "A", kind: "transport", label: "A", mode: "rail", legs: [{ id: "A-1", bookingId: "A", origin: "Same station", destination: "Bengaluru", originLocationId: "station:a", destinationLocationId: "city:blr", departureAt: "2026-11-12T08:00:00", arrivalAt: "2026-11-12T17:30:00" }] },
    { id: "B", kind: "activity", label: "B", location: "Bengaluru", locationId: "city:blr", startsAt: "2026-11-12T18:30:00", endsAt: "2026-11-12T20:00:00" },
  ], dependencies: [],
});
const timings = { A: { startAt: "2026-11-12T08:00:00", endAt: "2026-11-12T17:30:00" }, B: { startAt: "2026-11-12T18:30:00", endAt: "2026-11-12T20:00:00" } };

test("dependency evaluator applies connection, temporal, location, and window semantics", () => {
  const trip = baseTrip();
  trip.dependencies = [
    { id: "connection", fromItemId: "A", toItemId: "B", kind: "CONNECTION", minimumBufferMinutes: 30 },
    { id: "temporal", fromItemId: "A", toItemId: "B", kind: "TEMPORAL" },
    { id: "location", fromItemId: "A", toItemId: "B", kind: "LOCATION" },
    { id: "window", fromItemId: "A", toItemId: "B", kind: "WINDOW", arrivalWindow: { earliestAt: "2026-11-12T17:00:00", latestAt: "2026-11-12T18:00:00" } },
  ];
  const checks = evaluateDependencies(trip, timings);
  assert.ok(checks.every((check) => check.passed));
  assert.equal(checks.find((check) => check.kind === "CONNECTION")?.actualBufferMinutes, 60);
});

test("dependency evaluator fails closed for missing timing and location identities", () => {
  const trip = baseTrip();
  trip.items[1] = { ...trip.items[1], locationId: undefined } as typeof trip.items[1];
  trip.dependencies = [
    { id: "connection", fromItemId: "A", toItemId: "B", kind: "CONNECTION", minimumBufferMinutes: 30 },
    { id: "temporal", fromItemId: "A", toItemId: "B", kind: "TEMPORAL" },
    { id: "location", fromItemId: "A", toItemId: "B", kind: "LOCATION" },
    { id: "window", fromItemId: "A", toItemId: "B", kind: "WINDOW", arrivalWindow: { latestAt: "2026-11-12T18:00:00" } },
  ];
  const checks = evaluateDependencies(trip, { A: null, B: timings.B });
  assert.ok(checks.every((check) => !check.passed));
  assert.equal(checks.find((check) => check.kind === "LOCATION")?.message.includes("canonical location ID"), true);
});

test("window evaluator rejects early and late arrivals and invalid definitions", () => {
  const trip = baseTrip();
  trip.dependencies = [{ id: "window", fromItemId: "A", toItemId: "B", kind: "WINDOW", arrivalWindow: { earliestAt: "2026-11-12T17:00:00", latestAt: "2026-11-12T18:00:00" } }];
  assert.equal(evaluateDependencies(trip, { ...timings, A: { ...timings.A, endAt: "2026-11-12T16:59:00" } })[0].passed, false);
  assert.equal(evaluateDependencies(trip, { ...timings, A: { ...timings.A, endAt: "2026-11-12T18:01:00" } })[0].passed, false);
  trip.dependencies[0].arrivalWindow = { earliestAt: "2026-11-12T19:00:00", latestAt: "2026-11-12T18:00:00" };
  assert.throws(() => evaluateDependencies(trip, timings), (error) => error instanceof TechnicalFailure && error.code === "INVALID_DEPENDENCY");
});
