export type BookingKind = "flight" | "train" | "hotel";
export interface Booking { id: string; kind: BookingKind; origin: string; dest: string; start: string; end: string; cost: number; refundRate?: number }
export interface TravelGoal { label: string; city: string; arriveBy: string; stayUntil?: string }
export interface Constraints { home: string; maxExtraBudget: number; noOvernight?: boolean; mustBeAt?: TravelGoal[] }
export interface Itinerary { id: string; currency: string; bookings: Booking[]; constraints: Constraints }
export type DisruptionKind = "delay" | "cancel";
export interface Disruption { bookingId: string; kind: DisruptionKind; delayMin?: number }
export type ViolationKind = "route" | "connection" | "hotel" | "overnight" | "deadline" | "budget";
export interface ConstraintViolation { kind: ViolationKind; bookingId: string; message: string }
export interface RecoveryResult { feasible: boolean; itinerary: Booking[]; changes: number; extraCost: number; violations: ConstraintViolation[]; explanation: string; affectedBookingIds: string[] }
export interface RecoveryCandidate extends RecoveryResult { id: string; label: string; arrival: string }
export interface ImpactStep { bookingId: string; reason: ViolationKind | "delay" | "cancel"; text: string }
export interface DisruptionAnalysis { disruption: Disruption; affectedBookingIds: string[]; impact: ImpactStep[] }
export interface ApiError { code: "ITINERARY_LOAD_FAILED" | "INVALID_DISRUPTION" | "RECOVERY_SERVICE_UNAVAILABLE" | "ALTERNATIVES_LOAD_FAILED"; message: string }
export type ScenarioId = "delay" | "cancellation" | "infeasible" | "error";
export type Phase = "IDLE" | "TRIP_LOADED" | "DISRUPTION_DETECTED" | "IMPACT_ANALYSIS" | "RECOVERY_ANALYSIS" | "RECOVERY_READY" | "NO_FEASIBLE_RECOVERY" | "TECHNICAL_ERROR";
export type Diff = "UNCHANGED" | "CHANGED" | "NEW" | "AFFECTED";
