# Sutra Round 1 Final Freeze

**Status: FROZEN**

This document closes the final red-team review for DevHack 2026 Round 1 and is the implementation contract for the team.

After this freeze, the team should not do more product planning. Work moves to implementation, integration, QA, demo rehearsal, and submission.

## 1. Frozen product scope

Sutra is an **AI travel-disruption recovery agent with a rail-first Round 1 MVP**.

The guaranteed Round 1 flow is:

```text
Existing rail trip
  -> simulated rail disruption
  -> deterministic impact analysis
  -> deterministic alternative generation
  -> hard-constraint validation
  -> AI ranking/explanation of feasible candidates
  -> post-validation
  -> repaired itinerary
  -> traveller action list
```

### P0 scope

- rail delay;
- rail cancellation;
- affected-booking/dependency analysis;
- alternative recovery offers;
- hard constraints;
- AI ranking/explanation over feasible candidates;
- AI post-validation;
- deterministic fallback;
- repaired itinerary;
- traveller actions;
- no-feasible-recovery;
- technical-error;
- deterministic offline demo.

### Explicitly out of Round 1

- flight implementation;
- bus implementation;
- water transport;
- multimodal optimization;
- live provider dependency;
- booking/payment/refund transactions;
- automatic external actions;
- consumer accounts;
- production database;
- graph database;
- microservices;
- general trip planning.

Destination incidents remain optional post-MVP work and are not part of the golden path.

## 2. Canonical terminology

These terms are frozen:

- **TransportMode:** `rail` for Round 1.
- **ItineraryItemKind:** `transport`, `accommodation`, `activity`.
- **DisruptionKind:** `delay`, `cancellation`.
- **ImpactState:** `UNCHANGED`, `AFFECTED`, `DISRUPTED`.
- **RecoveryChange:** `UNCHANGED`, `CHANGED`, `REPLACED`, `CANCELLED`.
- **RecoveryStatus:** `RECOVERED`, `NO_FEASIBLE_RECOVERY`, `TECHNICAL_ERROR`.

Impact state and recovery change are separate.

Example:

```text
Hotel
  impactState = AFFECTED
  recoveryChange = UNCHANGED
```

This means the delay changes the expected arrival relationship, but the hotel booking itself remains valid and does not need to be changed.

## 3. Canonical domain model

The target domain separates itinerary items from transport details.

```ts
type TransportMode = "rail";

type ItineraryItemKind =
  | "transport"
  | "accommodation"
  | "activity";

type ImpactState =
  | "UNCHANGED"
  | "AFFECTED"
  | "DISRUPTED";

type RecoveryChange =
  | "UNCHANGED"
  | "CHANGED"
  | "REPLACED"
  | "CANCELLED";

type DisruptionKind =
  | "delay"
  | "cancellation";

type ConstraintKind =
  | "ARRIVAL_DEADLINE"
  | "MAX_EXTRA_BUDGET"
  | "NO_OVERNIGHT";

interface Trip {
  id: string;
  version: number;
  currency: string;
  items: ItineraryItem[];
  dependencies: Dependency[];
  constraints: ConstraintSet;
}

interface ItineraryItemBase {
  id: string;
  kind: ItineraryItemKind;
  label: string;
}

interface TransportBooking extends ItineraryItemBase {
  kind: "transport";
  mode: TransportMode;
  legs: TransportLeg[];
}

interface TransportLeg {
  id: string;
  bookingId: string;
  origin: string;
  destination: string;
  departureAt: string;
  arrivalAt: string;
}

interface AccommodationBooking extends ItineraryItemBase {
  kind: "accommodation";
  location: string;
  checkInAt: string;
  checkOutAt: string;
}

interface ActivityCommitment extends ItineraryItemBase {
  kind: "activity";
  location: string;
  startsAt: string;
  endsAt: string;
}

interface ConstraintSet {
  latestArrivalAt?: string;
  maxExtraBudget?: number;
  noOvernight: boolean;
  softPreferences?: SoftPreference[];
}

type SoftPreference =
  | "LOWER_COST"
  | "EARLIER_ARRIVAL"
  | "FEWER_CHANGES"
  | "PRESERVE_ITINERARY";

interface Dependency {
  id: string;
  fromItemId: string;
  toItemId: string;
  kind: "TEMPORAL" | "CONNECTION" | "LOCATION" | "WINDOW";
  minimumBufferMinutes?: number;
}

interface Disruption {
  source: "SIMULATED";
  scenarioId: string;
  bookingId: string;
  kind: DisruptionKind;
  delayMinutes?: number;
}

interface Alternative {
  id: string;
  replacementForBookingId: string;
  departureAt: string;
  arrivalAt: string;
  extraCost: number;
  source: "SIMULATED_OFFER";
}

interface RecoveryCandidate {
  id: string;
  alternatives: Alternative[];
  impactStates: Record<string, ImpactState>;
  recoveryChanges: Record<string, RecoveryChange>;
  feasible: boolean;
  violations: ConstraintViolation[];
  extraCost: number;
  finalArrivalAt: string;
}

interface ConstraintViolation {
  kind: ConstraintKind | "CONNECTION";
  itemId: string;
  message: string;
}

interface RecoveryRecommendation {
  selectedCandidateId: string;
  decisionSource: "AI" | "DETERMINISTIC_FALLBACK";
  reason: string;
  tradeoffs?: string[];
}
```

### Domain authority

The backend/domain owns:

- time arithmetic;
- dependency evaluation;
- affected-state calculation;
- candidate feasibility;
- budget checks;
- arrival deadline checks;
- overnight checks;
- final recovery validity.

The frontend never becomes the authority for any of these.

## 4. Canonical API contract

### Load trip

```http
GET /api/v1/trips/:tripId
```

Returns the canonical `Trip`.

### Start recovery

```http
POST /api/v1/recovery-runs
Content-Type: application/json
```

Request:

```json
{
  "tripId": "trip-demo-rail-001",
  "tripVersion": 1,
  "disruption": {
    "source": "SIMULATED",
    "scenarioId": "golden-rail-delay-01",
    "bookingId": "RAIL-A",
    "kind": "delay",
    "delayMinutes": 120
  }
}
```

### Recovery result

```json
{
  "runId": "run-demo-001",
  "status": "RECOVERED",
  "tripVersion": 1,
  "impact": {
    "disruptedItemIds": ["RAIL-A"],
    "affectedItemIds": ["RAIL-B", "HOTEL-1"],
    "reasons": [
      {
        "itemId": "RAIL-B",
        "reason": "Connection is missed after the delay."
      },
      {
        "itemId": "HOTEL-1",
        "reason": "Expected arrival shifts later."
      }
    ]
  },
  "candidates": [],
  "recommendation": {
    "selectedCandidateId": "RC-A",
    "decisionSource": "AI",
    "reason": "Earlier arrival is preferred while all hard constraints remain satisfied."
  },
  "recoveryPlan": {},
  "actions": []
}
```

The implementation may add fields, but it must preserve the semantic contract above.

### HTTP semantics

- `200`: recovery completed or no feasible recovery;
- `400`: invalid request;
- `404`: trip or booking not found;
- `409`: stale/incompatible trip version;
- `422`: domain input rejected;
- `500+`: technical failure.

`NO_FEASIBLE_RECOVERY` is not an HTTP error.

## 5. Canonical AI contract

AI is downstream of deterministic feasibility filtering.

### AI input

Only verified facts are supplied:

```text
trip summary
+ traveller soft preferences
+ impact summary
+ feasible candidate set
+ verified candidate trade-offs
```

The AI is never asked to discover whether a hard constraint is satisfied.

### AI output

The AI must return:

```json
{
  "selectedCandidateId": "RC-A",
  "reason": "Earlier arrival is preferred while the candidate remains within budget and deadline.",
  "tradeoffs": [
    "Costs more than the cheaper feasible option.",
    "Arrives earlier."
  ]
}
```

### Post-validation

Before accepting the result:

1. candidate ID must exist;
2. candidate ID must belong to the supplied candidate set;
3. candidate must already be feasible;
4. explanation must not contradict verified facts;
5. hard constraints must be rechecked independently.

Invalid AI output is rejected.

### Fallback

When AI is unavailable, times out, or returns invalid output:

```text
feasible candidates
  -> deterministic ranking
  -> decisionSource = DETERMINISTIC_FALLBACK
```

The fallback must never select an infeasible candidate.

The UI must not label fallback output as AI output.

## 6. Canonical golden scenario

**Scenario ID:** `golden-rail-delay-01`

This fixture is synthetic and exists only for the deterministic DevHack demo. It is not a claim about real railway schedules or ticket inventory.

### Original itinerary

| Item | Timing |
|---|---|
| RAIL-A: Mangaluru Central -> Hassan Junction | 09:00 -> 13:00 |
| RAIL-B: Hassan Junction -> Mysuru Junction | 13:30 -> 15:30 |
| HOTEL-1: Mysuru | check-in 17:00, check-out next day 10:00 |

Traveller constraints:

- latest arrival: **19:00**;
- maximum additional budget: **₹500**;
- no overnight travel;
- soft preference: **EARLIER_ARRIVAL**.

### Disruption

```text
RAIL-A delayed by 120 minutes
13:00 -> 15:00
```

This causes the original 13:30 connection to be missed.

### Expected impact

```text
RAIL-A   -> DISRUPTED
RAIL-B   -> AFFECTED
HOTEL-1  -> AFFECTED
```

The hotel remains valid because its check-in window is still reachable.

### Recovery offers

| Candidate | Arrival | Extra cost | Expected result |
|---|---:|---:|---|
| RC-A | 17:45 | ₹450 | FEASIBLE |
| RC-B | 18:30 | ₹350 | FEASIBLE |
| RC-C | 19:30 | ₹250 | REJECT: arrival deadline |
| RC-D | 23:30 | ₹150 | REJECT: arrival deadline + overnight |
| RC-E | 17:45 | ₹700 | REJECT: budget |

The AI receives only RC-A and RC-B after deterministic validation.

Expected AI decision for the golden demo:

```text
selectedCandidateId = RC-A
decisionSource = AI
reason = earlier arrival matches the traveller's soft preference while all hard constraints remain satisfied
```

Expected deterministic fallback:

```text
selectedCandidateId = RC-B
decisionSource = DETERMINISTIC_FALLBACK
```

This difference makes the AI contribution visible without allowing AI to affect feasibility.

## 7. Failure scenarios

### Cancellation

```text
rail service cancelled
-> downstream impact
-> replacement candidates
-> hard constraints
-> recovery or NO_FEASIBLE_RECOVERY
```

### No feasible recovery

All available candidates fail at least one hard constraint.

Expected:

```text
status = NO_FEASIBLE_RECOVERY
selectedCandidateId = null
```

### Technical error

A simulated adapter/application failure interrupts the calculation.

Expected:

```text
status = TECHNICAL_ERROR
```

The system must never convert this to `NO_FEASIBLE_RECOVERY`.

## 8. Final implementation gates

The plan is considered frozen, but implementation is not complete until these pass:

### Product

- PS 4.1 claims remain consistent across code, README, PPT, and demo.
- Rail is the real Round 1 demo domain.
- No unsupported capability is presented as implemented.

### Domain

- impact and recovery change semantics are separate;
- hard constraints are deterministic;
- original itinerary is preserved;
- technical error and infeasibility remain distinct.

### AI

- AI sees only verified feasible candidates;
- invalid AI output is rejected;
- deterministic fallback works;
- fallback is not misrepresented as AI.

### Integration

- frontend starts one Recovery Run;
- frontend consumes normalized recovery results;
- recovery correctness is not implemented in React.

### QA

- golden delay;
- cancellation;
- no feasible recovery;
- technical error;
- constraint adversarial cases;
- AI adversarial cases;
- deterministic repeatability.

### Submission

- required PPT template used unchanged in structure;
- GitHub MVP link works;
- demo video demonstrates the actual MVP;
- submission claims match the frozen product.

## 9. Change-control rule after freeze

No new product feature enters Round 1 unless it:

1. fixes a blocker or failed acceptance test;
2. has an explicit owner;
3. has an acceptance test;
4. does not weaken a frozen architecture or trust boundary.

All other ideas go to post-MVP.

## 10. Sign-off

Recommended sign-off:

- **Mayank:** recovery correctness;
- **Nithesh:** API and integration correctness;
- **Keval:** UX and frontend correctness;
- **Likhith:** product, QA, and submission correctness.

After these four sign-offs, implementation proceeds without reopening product planning.
