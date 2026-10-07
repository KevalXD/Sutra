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

export type DependencyKind =
  | "TEMPORAL"
  | "CONNECTION"
  | "LOCATION"
  | "WINDOW";

export type ConstraintKind =
  | "LATEST_ARRIVAL"
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
  departureAt?: string;
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

export interface Dependency {
  id: string;
  fromItemId: string;
  toItemId: string;
  kind: DependencyKind;
  minimumBufferMinutes?: number;
}

export interface Disruption {
  source: "SIMULATED";
  scenarioId: string;
  bookingId: string;
  kind: DisruptionKind;
  delayMinutes?: number;
}

export interface Alternative {
  id: string;
  replacementForBookingId: string;
  departureAt?: string;
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
  kind: ConstraintKind | "CONNECTION";
  itemId: string;
  message: string;
}

export interface RecoveryRecommendation {
  selectedCandidateId: string;
  decisionSource: "AI" | "DETERMINISTIC_FALLBACK";
  reason: string;
  tradeoffs?: string[];
}
