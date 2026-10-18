export type BookingKind = "flight" | "train" | "hotel" | "activity";
/** `cost` is optional because normalized itinerary items may not include a fare. */
export interface Booking {
  id: string;
  kind: BookingKind;
  origin: string;
  dest: string;
  start: string;
  end: string;
  cost?: number;
  refundRate?: number;
  originalStart?: string;
  originalEnd?: string;
  impactState?: "UNCHANGED" | "DISRUPTED" | "AFFECTED";
  recoveryChange?: "UNCHANGED" | "CHANGED" | "REPLACED" | "CANCELLED";
}
export interface TravelGoal {
  label: string;
  city: string;
  arriveBy: string;
  stayUntil?: string;
}
export interface Constraints {
  home: string;
  maxExtraBudget: number;
  noOvernight?: boolean;
  mustBeAt?: TravelGoal[];
}
export interface ConstraintOverrides {
  latestArrivalAt?: string;
  maxExtraBudget?: number;
  noOvernight?: boolean;
  priority?: "LOWER_COST" | "EARLIER_ARRIVAL";
}
export interface Itinerary {
  id: string;
  currency: string;
  bookings: Booking[];
  constraints: Constraints;
}
export type DisruptionKind = "delay" | "cancel";
export interface Disruption {
  bookingId: string;
  kind: DisruptionKind;
  delayMin?: number;
}
export type ViolationKind =
  | "route"
  | "connection"
  | "temporal"
  | "location"
  | "window"
  | "hotel"
  | "overnight"
  | "deadline"
  | "budget";
export interface ConstraintViolation {
  kind: ViolationKind;
  bookingId: string;
  message: string;
}
export interface ConnectionCheck {
  predecessorBookingId: string;
  successorBookingId: string;
  predecessorArrivalAt: string | null;
  replacementDepartureAt: string | null;
  actualBufferMinutes: number | null;
  minimumBufferMinutes: number;
  passed: boolean;
}
/** An API-returned proposal. It is never evidence that an external transaction occurred. */
export interface TravellerAction {
  id: string;
  kind:
    | "BOOK_REPLACEMENT"
    | "NOTIFY_ACCOMMODATION"
    | "REVIEW_CANCELLED_BOOKING";
  itemId: string;
  description: string;
  automated: boolean;
}
import type { DecisionAudit } from "./domain/types";
export interface RecoveryResult {
  feasible: boolean;
  itinerary: Booking[];
  changes: number;
  extraCost: number;
  violations: ConstraintViolation[];
  explanation: string;
  affectedBookingIds: string[];
  actions: TravellerAction[];
  connectionChecks?: ConnectionCheck[];
  decisionSource?: "AI" | "DETERMINISTIC_FALLBACK";
  tradeoffs?: string[];
  audit?: DecisionAudit;
}
export interface RecoveryCandidate extends RecoveryResult {
  id: string;
  label: string;
  arrival: string;
}
export interface ImpactStep {
  bookingId: string;
  reason: ViolationKind | "delay" | "cancel";
  text: string;
}
export interface DisruptionAnalysis {
  disruption: Disruption;
  affectedBookingIds: string[];
  impact: ImpactStep[];
}
export interface ApiError {
  code:
    | "ITINERARY_LOAD_FAILED"
    | "INVALID_DISRUPTION"
    | "RECOVERY_SERVICE_UNAVAILABLE"
    | "ALTERNATIVES_LOAD_FAILED";
  message: string;
  audit?: import("./domain/types").DecisionAudit;
}
export type ScenarioId = "delay" | "cancellation" | "infeasible" | "error";
export type Phase =
  | "IDLE"
  | "TRIP_LOADED"
  | "DISRUPTION_DETECTED"
  | "IMPACT_ANALYSIS"
  | "RECOVERY_ANALYSIS"
  | "RECOVERY_READY"
  | "NO_FEASIBLE_RECOVERY"
  | "TECHNICAL_ERROR";
export type Diff = "UNCHANGED" | "CHANGED" | "NEW" | "AFFECTED" | "DISRUPTED";
