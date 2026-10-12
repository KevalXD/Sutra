// Error taxonomy. The domain knows nothing about HTTP; lib/api maps these to status codes.
// Rule from the freeze: a technical failure must never be reported as NO_FEASIBLE_RECOVERY.

export type RecoveryErrorCode =
  | "INVALID_REQUEST" //       400
  | "TRIP_NOT_FOUND" //        404
  | "BOOKING_NOT_FOUND" //     404
  | "STALE_TRIP_VERSION" //    409
  | "DOMAIN_REJECTED"; //      422

/** The caller's input was wrong. Safe to show to the caller. */
export class RecoveryInputError extends Error {
  constructor(
    public readonly code: RecoveryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RecoveryInputError";
  }
}

/** Our side failed (adapter down, adapter broke its contract, unsupported data). Maps to TECHNICAL_ERROR. */
export class TechnicalFailure extends Error {
  constructor(
    public readonly code: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "TechnicalFailure";
  }
}

/** Run an external port call; anything that is not already one of our errors becomes a TechnicalFailure. */
export async function guardPort<T>(code: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof RecoveryInputError || err instanceof TechnicalFailure) throw err;
    throw new TechnicalFailure(code, err instanceof Error ? err.message : "Unknown failure", { cause: err });
  }
}
