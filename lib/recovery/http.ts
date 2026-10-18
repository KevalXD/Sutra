import { RecoveryInputError, TechnicalFailure, getTrip, parseRequest, runRecovery, type RecoveryDeps } from "./core";

export async function recoveryRunOutcome(body: unknown, deps?: RecoveryDeps) {
  try { return { status: 200, body: await runRecovery(parseRequest(body), deps) }; }
  catch (error) {
    if (error instanceof RecoveryInputError) {
      const status = error.code === "INVALID_REQUEST" ? 400 : error.code === "TRIP_NOT_FOUND" || error.code === "BOOKING_NOT_FOUND" ? 404 : error.code === "STALE_TRIP_VERSION" ? 409 : 422;
      return { status, body: { error: { code: error.code, message: error.message } } };
    }
    const code = error instanceof TechnicalFailure ? error.code : "INTERNAL_ERROR";
    console.error("[recovery] technical failure", error);
    const message = error instanceof Error ? error.message : "Recovery could not be calculated.";
    return { status: 500, body: { status: "TECHNICAL_ERROR", error: { code, message: "Recovery could not be calculated. Please retry." }, decisionAudit: { runId: "unavailable", status: "TECHNICAL_ERROR", decisionSource: "NONE", selectedCandidateId: null, effectiveConstraints: null, candidates: [], noFeasibleReasons: [], technicalError: { code, message } } } };
  }
}

export async function tripOutcome(tripId: string) {
  const trip = await getTrip(tripId);
  return trip ? { status: 200, body: trip } : { status: 404, body: { error: { code: "TRIP_NOT_FOUND", message: `Trip ${tripId} was not found.` } } };
}
