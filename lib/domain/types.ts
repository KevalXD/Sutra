export type TransportMode = "rail";

export type ItineraryItemKind =
  | "transport"
  | "accommodation"
  | "activity";

export type DisruptionKind =
  | "delay"
  | "cancellation";

export type ImpactState =
  | "UNCHANGED"
  | "AFFECTED"
  | "DISRUPTED";

export type RecoveryChange =
  | "UNCHANGED"
  | "CHANGED"
  | "REPLACED"
  | "CANCELLED";

export type RecoveryStatus =
  | "RECOVERED"
  | "NO_FEASIBLE_RECOVERY"
  | "TECHNICAL_ERROR";

export type SoftPreference =
  | "LOWER_COST"
  | "EARLIER_ARRIVAL"
  | "FEWER_CHANGES"
  | "PRESERVE_ITINERARY";

/** The two traveller-selectable ranking objectives for an explicit recovery run. */
export type RecoveryPriority = Extract<SoftPreference, "LOWER_COST" | "EARLIER_ARRIVAL">;

export type DependencyKind =
  | "TEMPORAL"
  | "CONNECTION"
  | "LOCATION"
  | "WINDOW";

export type ConstraintKind =
  | "ARRIVAL_DEADLINE"
  | "MAX_EXTRA_BUDGET"
  | "NO_OVERNIGHT";

export interface Trip {
  id: string;
  version: number;
  currency: string;
  items: ItineraryItem[];
  dependencies: Dependency[];
  constraints: ConstraintSet;
}

export interface ItineraryItemBase {
  id: string;
  kind: ItineraryItemKind;
  label: string;
}

export interface TransportBooking extends ItineraryItemBase {
  kind: "transport";
  mode: TransportMode;
  legs: TransportLeg[];
}

export interface TransportLeg {
  id: string;
  bookingId: string;
  origin: string;
  destination: string;
  originLocationId?: string;
  destinationLocationId?: string;
  departureAt: string;
  arrivalAt: string;
}

export interface AccommodationBooking extends ItineraryItemBase {
  kind: "accommodation";
  location: string;
  locationId?: string;
  checkInAt: string;
  checkOutAt: string;
}

export interface ActivityCommitment extends ItineraryItemBase {
  kind: "activity";
  location: string;
  locationId?: string;
  startsAt: string;
  endsAt: string;
}

export type ItineraryItem =
  | TransportBooking
  | AccommodationBooking
  | ActivityCommitment;

export interface ConstraintSet {
  latestArrivalAt?: string;
  maxExtraBudget?: number;
  noOvernight: boolean;
  softPreferences?: SoftPreference[];
}
/** Optional per-run values. They never alter the stored trip fixture. */
export interface ConstraintOverrides {
  latestArrivalAt?: string;
  maxExtraBudget?: number;
  noOvernight?: boolean;
  /** Per-run ranking objective; never mutates the stored trip. */
  priority?: RecoveryPriority;
}

export interface Dependency {
  id: string;
  fromItemId: string;
  toItemId: string;
  kind: DependencyKind;
  minimumBufferMinutes?: number;
  arrivalWindow?: { earliestAt?: string; latestAt: string };
}

export interface Disruption {
  source: "SIMULATED";
  scenarioId: string;
  bookingId: string;
  kind: DisruptionKind;
  delayMinutes?: number;
}

/** A backend-supported disruption that can be selected from the journey catalogue. */
export interface SupportedDisruptionProfile {
  id: string;
  label: string;
  bookingId: string;
  bookingLabel: string;
  kind: DisruptionKind;
  /** Present only when the profile accepts a caller-selected delay duration. */
  delayRange?: { minimumMinutes: number; maximumMinutes: number; stepMinutes: number };
}

export interface JourneyCatalogueItem {
  id: string;
  kind: ItineraryItemKind;
  label: string;
  origin?: string;
  destination?: string;
  departureAt?: string;
  arrivalAt?: string;
  location?: string;
  checkInAt?: string;
  checkOutAt?: string;
  startsAt?: string;
  endsAt?: string;
}

export interface JourneyCatalogueEntry {
  tripId: string;
  tripVersion: number;
  /** Every catalogue journey is synthetic fixture data, never live inventory. */
  source: "SIMULATED";
  label: string;
  origin: string;
  destination: string;
  journeyDate: string;
  currency: string;
  defaultConstraints: ConstraintSet;
  items: JourneyCatalogueItem[];
  supportedDisruptions: SupportedDisruptionProfile[];
}

export interface JourneyCatalogueResponse {
  journeys: JourneyCatalogueEntry[];
}

export interface Alternative {
  id: string;
  replacementForBookingId: string;
  departureAt: string;
  arrivalAt: string;
  extraCost: number;
  source: "SIMULATED_OFFER";
}

export interface RecoveryCandidate {
  id: string;
  alternatives: Alternative[];
  impactStates: Record<string, ImpactState>;
  recoveryChanges: Record<string, RecoveryChange>;
  feasible: boolean;
  violations: ConstraintViolation[];
  extraCost: number;
  finalArrivalAt: string;
}

export interface ConstraintViolation {
  kind: ConstraintKind | DependencyKind;
  itemId: string;
  message: string;
}

export interface RecoveryRecommendation {
  selectedCandidateId: string;
  decisionSource: "AI" | "DETERMINISTIC_FALLBACK";
  reason: string;
  tradeoffs?: string[];
}

export type DecisionAuditSource = "AI" | "DETERMINISTIC_FALLBACK" | "NONE";

export interface CandidateDecisionAudit {
  candidateId: string;
  feasible: boolean;
  finalArrivalAt: string;
  extraCost: number;
  constraintChecks: ConstraintEvaluation[];
  dependencyChecks: DependencyCheck[];
  violations: ConstraintViolation[];
}

/** Backend-authored evidence for the recommendation shown to a traveller. */
export interface DecisionAudit {
  runId: string;
  status: RecoveryStatus;
  decisionSource: DecisionAuditSource;
  selectedCandidateId: string | null;
  effectiveConstraints: ConstraintSet | null;
  /** Present only when this calculation received an explicit traveller priority. */
  appliedPriority?: RecoveryPriority;
  candidates: CandidateDecisionAudit[];
  noFeasibleReasons: ConstraintViolation[];
  technicalError?: { code: string; message: string };
}

export interface ItemTiming { startAt: string; endAt: string }
export interface ImpactReason { itemId: string; reason: string }
export interface ImpactAnalysis {
  disruptedItemIds: string[];
  affectedItemIds: string[];
  reasons: ImpactReason[];
  impactStates: Record<string, ImpactState>;
  disruptedTimings: Record<string, ItemTiming | null>;
}

/** A proposal before deterministic feasibility validation. */
export interface GeneratedRecoveryCandidate {
  id: string;
  alternatives: Alternative[];
  impactStates: Record<string, ImpactState>;
  recoveryChanges: Record<string, RecoveryChange>;
  extraCost: number;
  finalArrivalAt: string;
}

/** Public candidate shape defined by the frozen API contract. */
export interface ValidatedRecoveryCandidate extends GeneratedRecoveryCandidate {
  feasible: boolean;
  violations: ConstraintViolation[];
  /** Canonical repaired timing used for feasibility validation. */
  repairedTimings: Record<string, ItemTiming | null>;
  /** Canonical connection facts, calculated against the repaired itinerary. */
  connectionChecks: ConnectionCheck[];
  dependencyChecks: DependencyCheck[];
}

export interface ConstraintEvaluation extends ConstraintViolation { passed: boolean }
export interface ConnectionCheck {
  dependencyId: string;
  predecessorItemId: string;
  successorItemId: string;
  predecessorArrivalAt: string | null;
  successorDepartureAt: string | null;
  actualBufferMinutes: number | null;
  minimumBufferMinutes: number;
  passed: boolean;
}
export interface DependencyCheckBase {
  dependencyId: string;
  kind: DependencyKind;
  predecessorItemId: string;
  successorItemId: string;
  passed: boolean;
  message: string;
}
export type DependencyCheck =
  | (DependencyCheckBase & { kind: "CONNECTION"; predecessorCompletionAt: string | null; successorStartAt: string | null; actualBufferMinutes: number | null; minimumBufferMinutes: number })
  | (DependencyCheckBase & { kind: "TEMPORAL"; predecessorCompletionAt: string | null; successorStartAt: string | null })
  | (DependencyCheckBase & { kind: "LOCATION"; predecessorLocationId: string | null; successorLocationId: string | null })
  | (DependencyCheckBase & { kind: "WINDOW"; predecessorCompletionAt: string | null; earliestAt: string | null; latestAt: string | null });
export interface RepairedItem {
  itemId: string; kind: ItineraryItemKind; label: string;
  impactState: ImpactState; recoveryChange: RecoveryChange;
  original: ItemTiming; repaired: ItemTiming | null; replacedByAlternativeId?: string;
}
export interface RecoveryPlan {
  selectedCandidateId: string; items: RepairedItem[]; extraCost: number;
  originalFinalArrivalAt: string; repairedFinalArrivalAt: string;
  arrivalDeltaMinutes: number; constraintResults: ConstraintEvaluation[];
}
export interface TravellerAction {
  id: string; kind: "BOOK_REPLACEMENT" | "NOTIFY_ACCOMMODATION" | "REVIEW_CANCELLED_BOOKING";
  itemId: string; description: string; automated: false;
}
/** `demoAttempt` only controls the pre-defined transient demo outage retry. */
export interface RecoveryRunRequest { tripId: string; tripVersion: number; disruption: Disruption; demoAttempt?: number; constraintOverrides?: ConstraintOverrides }
interface RecoveryRunBase { runId: string; tripVersion: number; impact: ImpactAnalysis; candidates: ValidatedRecoveryCandidate[]; effectiveConstraints: ConstraintSet }
export interface RecoveredRun extends RecoveryRunBase {
  status: "RECOVERED"; recommendation: RecoveryRecommendation; recoveryPlan: RecoveryPlan; actions: TravellerAction[]; decisionAudit: DecisionAudit;
}
export interface NoFeasibleRun extends RecoveryRunBase {
  status: "NO_FEASIBLE_RECOVERY"; recommendation: null; recoveryPlan: null; actions: []; decisionAudit: DecisionAudit;
}
export type RecoveryRunResult = RecoveredRun | NoFeasibleRun;
