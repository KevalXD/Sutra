export type RecoveryStatus = "RUNNING" | "RECOVERED" | "NO_FEASIBLE_RECOVERY" | "TECHNICAL_ERROR";
export type DecisionSource = "AI" | "DETERMINISTIC_FALLBACK";
export interface LiveTrip { id: string; externalTripId: string; version: number; currency: string; items: unknown[]; dependencies: unknown[]; constraints: { latestArrivalAt?: string; maxExtraBudget?: number; noOvernight: boolean; softPreferences?: string[] }; }
export interface LiveDisruption { bookingId: string; kind: "delay" | "cancellation"; delayMinutes?: number; source: "LIVE_PROVIDER"; providerEventId: string; observedAt: string; affectedItemIds?: string[]; reasons?: { itemId: string; reason: string }[]; }
export interface Candidate { id: string; feasible: boolean; violations: { kind: string; itemId: string; message: string }[]; extraCost: number; finalArrivalAt: string; payload: unknown; }
export interface RecoveryOutput { status: RecoveryStatus; runId: string; tripVersion: number; impact: unknown; candidates: Candidate[]; recommendation: { selectedCandidateId: string; decisionSource: DecisionSource; reason: string } | null; recoveryPlan: unknown; actions: string[]; }
