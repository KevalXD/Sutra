// Parses an untrusted JSON body into a RecoveryRunRequest. Hand-rolled: no new dependency for one shape.

import { RecoveryInputError } from "../domain/errors";
import type { Disruption, RecoveryRunRequest } from "../domain/types";

const bad = (msg: string) => new RecoveryInputError("INVALID_REQUEST", msg);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function parseRecoveryRunRequest(body: unknown): RecoveryRunRequest {
  if (!isObj(body)) throw bad("Request body must be a JSON object.");
  const { tripId, tripVersion, disruption } = body;
  if (typeof tripId !== "string" || !tripId) throw bad("tripId must be a non-empty string.");
  if (!Number.isInteger(tripVersion)) throw bad("tripVersion must be an integer.");
  if (!isObj(disruption)) throw bad("disruption must be an object.");

  if (disruption.source !== "SIMULATED") throw bad('disruption.source must be "SIMULATED".');
  if (typeof disruption.scenarioId !== "string" || !disruption.scenarioId) throw bad("disruption.scenarioId must be a non-empty string.");
  if (typeof disruption.bookingId !== "string" || !disruption.bookingId) throw bad("disruption.bookingId must be a non-empty string.");
  if (disruption.kind !== "delay" && disruption.kind !== "cancellation") throw bad('disruption.kind must be "delay" or "cancellation".');
  if (disruption.delayMinutes !== undefined && typeof disruption.delayMinutes !== "number") throw bad("disruption.delayMinutes must be a number.");

  return {
    tripId,
    tripVersion: tripVersion as number,
    disruption: {
      source: "SIMULATED",
      scenarioId: disruption.scenarioId,
      bookingId: disruption.bookingId,
      kind: disruption.kind,
      ...(disruption.delayMinutes !== undefined ? { delayMinutes: disruption.delayMinutes } : {}),
    } satisfies Disruption,
  };
}
