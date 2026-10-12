// HTTP mapping for the /api/v1 boundary (04_SYSTEM_ARCHITECTURE §8). Framework-free so it can be unit tested.
// NO_FEASIBLE_RECOVERY is a 200 result; TECHNICAL_ERROR is a 5xx and is never reshaped into infeasibility.

import { RecoveryInputError, TechnicalFailure } from "../domain/errors";
import type { RecoveryErrorCode } from "../domain/errors";
import type { TripRepository } from "../domain/ports";
import { parseRecoveryRunRequest } from "../application/request";
import { runRecovery, type RecoveryDeps } from "../application/run-recovery";

export interface HttpOutcome {
  status: number;
  body: unknown;
}

const STATUS: Record<RecoveryErrorCode, number> = {
  INVALID_REQUEST: 400,
  TRIP_NOT_FOUND: 404,
  BOOKING_NOT_FOUND: 404,
  STALE_TRIP_VERSION: 409,
  DOMAIN_REJECTED: 422,
};

export function toErrorOutcome(err: unknown): HttpOutcome {
  if (err instanceof RecoveryInputError) {
    return { status: STATUS[err.code], body: { error: { code: err.code, message: err.message } } };
  }
  // Internal details are logged server-side, not leaked to the browser.
  console.error("[recovery] technical failure", err);
  const code = err instanceof TechnicalFailure ? err.code : "INTERNAL_ERROR";
  return {
    status: err instanceof TechnicalFailure && /ADAPTER|REPOSITORY/.test(err.code) ? 502 : 500,
    body: { status: "TECHNICAL_ERROR", error: { code, message: "Recovery could not be calculated. Please retry." } },
  };
}

export async function handleStartRecovery(body: unknown, deps: RecoveryDeps): Promise<HttpOutcome> {
  try {
    return { status: 200, body: await runRecovery(parseRecoveryRunRequest(body), deps) };
  } catch (err) {
    return toErrorOutcome(err);
  }
}

export async function handleGetTrip(tripId: string, trips: TripRepository): Promise<HttpOutcome> {
  try {
    const trip = await trips.getTrip(tripId);
    if (!trip) throw new RecoveryInputError("TRIP_NOT_FOUND", `Trip ${tripId} was not found.`);
    return { status: 200, body: trip };
  } catch (err) {
    return toErrorOutcome(err);
  }
}
