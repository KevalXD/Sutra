export type TransportMode = "rail";
export type ItineraryItemKind = "transport" | "accommodation" | "activity";
export type DisruptionKind = "delay" | "cancellation";
export type ImpactState = "UNCHANGED" | "AFFECTED" | "DISRUPTED";
export type RecoveryChange = "UNCHANGED" | "CHANGED" | "REPLACED" | "CANCELLED";
export type RecoveryStatus = "RECOVERED" | "NO_FEASIBLE_RECOVERY" | "TECHNICAL_ERROR";
export type DecisionSource = "AI" | "DETERMINISTIC_FALLBACK";
export type SoftPreference = "LOWER_COST" | "EARLIER_ARRIVAL" | "FEWER_CHANGES" | "PRESERVE_ITINERARY";
export type DependencyKind = "TEMPORAL" | "CONNECTION" | "LOCATION" | "WINDOW";
export type ConstraintKind = "ARRIVAL_DEADLINE" | "MAX_EXTRA_BUDGET" | "NO_OVERNIGHT" | "CONNECTION" | "CHRONOLOGY" | "IDENTITY";

export interface Trip { id: string; externalTripId?: string; version: number; currency: string; items: ItineraryItem[]; dependencies: Dependency[]; constraints: ConstraintSet; }
export interface ItineraryItemBase { id: string; kind: ItineraryItemKind; label: string; cost?: number; }
export interface TransportBooking extends ItineraryItemBase { kind: "transport"; mode: TransportMode; legs: TransportLeg[]; }
export interface TransportLeg { id: string; bookingId: string; origin: string; destination: string; departureAt: string; arrivalAt: string; }
export interface AccommodationBooking extends ItineraryItemBase { kind: "accommodation"; location: string; checkInAt: string; checkOutAt: string; }
export interface ActivityCommitment extends ItineraryItemBase { kind: "activity"; location: string; startsAt: string; endsAt: string; }
export type ItineraryItem = TransportBooking | AccommodationBooking | ActivityCommitment;
export interface ConstraintSet { latestArrivalAt?: string; maxExtraBudget?: number; noOvernight: boolean; softPreferences?: SoftPreference[]; }
export interface Dependency { id: string; fromItemId: string; toItemId: string; kind: DependencyKind; minimumBufferMinutes?: number; }
export interface Disruption { source: "SIMULATED" | "LIVE_PROVIDER"; scenarioId: string; bookingId: string; kind: DisruptionKind; delayMinutes?: number; providerEventId?: string; observedAt?: string; }
export interface Alternative { id: string; replacementForBookingId: string; departureAt: string; arrivalAt: string; extraCost: number; source: "SIMULATED_OFFER" | "LIVE_PROVIDER"; replacementItem?: TransportBooking; }
export interface ConstraintViolation { kind: ConstraintKind; itemId: string; message: string; }
export interface ImpactReason { itemId: string; reason: string; }
export interface ImpactAnalysis { disruptedItemIds: string[]; affectedItemIds: string[]; impactStates: Record<string, ImpactState>; reasons: ImpactReason[]; }
export interface RecoveryCandidate { id: string; tripId: string; alternatives: Alternative[]; itinerary: ItineraryItem[]; impactStates: Record<string, ImpactState>; recoveryChanges: Record<string, RecoveryChange>; feasible: boolean; violations: ConstraintViolation[]; extraCost: number; finalArrivalAt: string; }
export interface RecoveryRecommendation { selectedCandidateId: string; decisionSource: DecisionSource; rankingStrategy: string; reason: string; tradeoffs: string[]; }
export interface RecoveryOutput { runId: string; status: RecoveryStatus; trip: Trip; disruption: Disruption; impact: ImpactAnalysis; candidates: RecoveryCandidate[]; recommendation: RecoveryRecommendation | null; recoveryPlan: { originalItinerary: ItineraryItem[]; repairedItinerary: ItineraryItem[]; extraCost: number; finalArrivalAt: string; changes: Record<string, RecoveryChange>; } | null; actions: string[]; error?: { code: string; message: string }; }
export interface StoredRun { id: string; tripId: string; tripVersion: number; status: RecoveryStatus | "RUNNING"; request: unknown; userId?: string; result?: RecoveryOutput; createdAt: string; completedAt?: string; }
