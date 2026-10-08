// Sutra canonical domain model (Round 1 freeze, docs/planning/12_FINAL_FREEZE.md).
//
// Pipeline (each arrow is a pure stage in lib/domain, orchestrated by lib/application):
//
//   Disruption
//     -> ImpactAnalysis                (impact.ts)
//     -> RecoveryCandidate[]           (candidates.ts)   proposals, no verdict yet
//     -> ValidatedCandidate[]          (validation.ts)   + feasible / violations
//     -> RecoveryRecommendation        (ranking.ts)      AI (M4) or deterministic fallback
//     -> RecoveryPlan + actions        (plan.ts)
//
// Deviations from the freeze document are marked `FREEZE-DELTA` and listed in lib/domain/README.md.

export type TransportMode = "rail";

export type ItineraryItemKind = "transport" | "accommodation" | "activity";

export type DisruptionKind = "delay" | "cancellation";

/** What the disruption does to an item. Separate from what the recovery does (RecoveryChange). */
export type ImpactState = "UNCHANGED" | "AFFECTED" | "DISRUPTED";

export type RecoveryChange = "UNCHANGED" | "CHANGED" | "REPLACED" | "CANCELLED";

export type RecoveryStatus = "RECOVERED" | "NO_FEASIBLE_RECOVERY" | "TECHNICAL_ERROR";

export type SoftPreference =
  | "LOWER_COST"
  | "EARLIER_ARRIVAL"
  | "FEWER_CHANGES"
  | "PRESERVE_ITINERARY";

export type DependencyKind = "TEMPORAL" | "CONNECTION" | "LOCATION" | "WINDOW";

/** Traveller-level hard constraints. FREEZE-DELTA: was `LATEST_ARRIVAL` in the earlier fixture; the freeze says `ARRIVAL_DEADLINE`. */
export type ConstraintKind = "ARRIVAL_DEADLINE" | "MAX_EXTRA_BUDGET" | "NO_OVERNIGHT";

/** FREEZE-DELTA: `WINDOW` added so a broken WINDOW dependency (e.g. hotel) can be reported honestly. */
export type ViolationKind = ConstraintKind | "CONNECTION" | "WINDOW";

// ---------------------------------------------------------------- Trip

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
  departureAt: string;
  arrivalAt: string;
}

export interface AccommodationBooking extends ItineraryItemBase {
  kind: "accommodation";
  location: string;
  checkInAt: string;
  checkOutAt: string;
}

export interface ActivityCommitment extends ItineraryItemBase {
  kind: "activity";
  location: string;
  startsAt: string;
  endsAt: string;
}

export type ItineraryItem = TransportBooking | AccommodationBooking | ActivityCommitment;

export interface ConstraintSet {
  latestArrivalAt?: string;
  maxExtraBudget?: number;
  noOvernight: boolean;
  softPreferences?: SoftPreference[];
}

export interface Dependency {
  id: string;
  fromItemId: string;
  toItemId: string;
  kind: DependencyKind;
  minimumBufferMinutes?: number;
}

// ---------------------------------------------------------------- Stage 0: Disruption

export interface Disruption {
  source: "SIMULATED";
  scenarioId: string;
  bookingId: string;
  kind: DisruptionKind;
  delayMinutes?: number;
}

// ---------------------------------------------------------------- Stage 1: ImpactAnalysis

/** Start/end of an item on the timeline (transport: first departure to last arrival; stay: check-in to check-out). */
export interface ItemTiming {
  startAt: string;
  endAt: string;
}

export interface ImpactReason {
  itemId: string;
  reason: string;
}

/** Deterministic consequences of a disruption. Says nothing about how to recover. */
export interface ImpactAnalysis {
  disruptedItemIds: string[];
  affectedItemIds: string[];
  reasons: ImpactReason[];
  /** Every trip item has an entry. */
  impactStates: Record<string, ImpactState>;
  /** Expected timing of each *directly disrupted* item after the disruption; `null` = cancelled. */
  disruptedTimings: Record<string, ItemTiming | null>;
}

// ---------------------------------------------------------------- Stage 2: RecoveryCandidate

/** A replacement transport offer. FREEZE-DELTA: `departureAt` is required (the earlier fixture omitted it). */
export interface Alternative {
  id: string;
  replacementForBookingId: string;
  departureAt: string;
  arrivalAt: string;
  extraCost: number;
  source: "SIMULATED_OFFER";
}

/**
 * A complete proposed repair. A proposal only: no feasibility verdict.
 * The freeze document's `RecoveryCandidate` (with feasible/violations) is `ValidatedCandidate` here.
 */
export interface RecoveryCandidate {
  id: string;
  alternatives: Alternative[];
  impactStates: Record<string, ImpactState>;
  recoveryChanges: Record<string, RecoveryChange>;
  extraCost: number;
  finalArrivalAt: string;
}

// ---------------------------------------------------------------- Stage 3: Validation

export interface ConstraintViolation {
  kind: ViolationKind;
  itemId: string;
  message: string;
}

/** One checked rule with its outcome; violations are the failed evaluations. */
export interface ConstraintEvaluation extends ConstraintViolation {
  passed: boolean;
}

/** Wire shape of the freeze document's `RecoveryCandidate`. */
export interface ValidatedCandidate extends RecoveryCandidate {
  feasible: boolean;
  violations: ConstraintViolation[];
}

// ---------------------------------------------------------------- Stage 4: Recommendation

export interface RecoveryRecommendation {
  selectedCandidateId: string;
  decisionSource: "AI" | "DETERMINISTIC_FALLBACK";
  reason: string;
  tradeoffs?: string[];
}

/** What an AI provider returns; `decisionSource` is stamped by the application, never by the provider. */
export type RecommendationDraft = Omit<RecoveryRecommendation, "decisionSource">;

// ---------------------------------------------------------------- Stage 5: RecoveryPlan

export interface RepairedItem {
  itemId: string;
  kind: ItineraryItemKind;
  label: string;
  impactState: ImpactState;
  recoveryChange: RecoveryChange;
  /** Baseline, never mutated. */
  original: ItemTiming;
  /** `null` when the item no longer exists in the repaired itinerary. */
  repaired: ItemTiming | null;
  replacedByAlternativeId?: string;
}

export interface RecoveryPlan {
  selectedCandidateId: string;
  items: RepairedItem[];
  extraCost: number;
  originalFinalArrivalAt: string;
  repairedFinalArrivalAt: string;
  arrivalDeltaMinutes: number;
  /** Independent re-evaluation of every rule against the repaired itinerary. */
  constraintResults: ConstraintEvaluation[];
}

/** Proposed to the traveller; Round 1 never executes anything. */
export interface TravellerAction {
  id: string;
  kind: "BOOK_REPLACEMENT" | "NOTIFY_ACCOMMODATION" | "REVIEW_CANCELLED_BOOKING";
  itemId: string;
  description: string;
  automated: false;
}

// ---------------------------------------------------------------- Run result

export interface RecoveryRunRequest {
  tripId: string;
  tripVersion: number;
  disruption: Disruption;
}

interface RecoveryRunBase {
  runId: string;
  tripVersion: number;
  impact: ImpactAnalysis;
  /** Every generated candidate with its verdict, feasible or not. */
  candidates: ValidatedCandidate[];
}

export interface RecoveredRun extends RecoveryRunBase {
  status: "RECOVERED";
  recommendation: RecoveryRecommendation;
  recoveryPlan: RecoveryPlan;
  actions: TravellerAction[];
}

/** An application result, not an error: HTTP 200. */
export interface NoFeasibleRun extends RecoveryRunBase {
  status: "NO_FEASIBLE_RECOVERY";
  recommendation: null;
  recoveryPlan: null;
  actions: [];
}

export type RecoveryRunResult = RecoveredRun | NoFeasibleRun;
