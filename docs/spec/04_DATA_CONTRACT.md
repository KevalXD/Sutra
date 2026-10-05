# Sutra - Data Contract

## 1. Purpose

This document defines the frontend-facing conceptual data model for Sutra.

The frontend should communicate through a Sutra API abstraction and should not directly depend on third-party travel providers.

The deterministic simulator is the guaranteed demo data source.

Backend-specific implementation details may evolve without requiring the UI contract to change.

---

## 2. Core Types

```ts
type BookingKind = "flight" | "train" | "hotel";

interface Booking {
  id: string;
  kind: BookingKind;
  origin: string;
  dest: string;
  start: string;
  end: string;
  cost: number;
  refundRate?: number;
}

interface TravelGoal {
  label: string;
  city: string;
  arriveBy: string;
  stayUntil?: string;
}

interface Constraints {
  home: string;
  maxExtraBudget: number;
  noOvernight?: boolean;
  mustBeAt?: TravelGoal[];
}

type DisruptionKind = "delay" | "cancel";

interface Disruption {
  bookingId: string;
  kind: DisruptionKind;
  delayMin?: number;
}

interface Itinerary {
  id: string;
  bookings: Booking[];
  constraints: Constraints;
}

type ConstraintViolationKind =
  | "route"
  | "connection"
  | "hotel"
  | "overnight"
  | "deadline"
  | "budget";

interface ConstraintViolation {
  kind: ConstraintViolationKind;
  bookingId: string;
  message: string;
}

interface RecoveryResult {
  feasible: boolean;
  itinerary: Booking[];
  changes: number;
  extraCost: number;
  violations: ConstraintViolation[];
  explanation: string;
  affectedBookingIds: string[];
}
```

---

## 3. Recovery Semantics

A feasible recovery is represented by:

```ts
feasible === true
violations.length === 0
```

A no-feasible-recovery result is represented by:

```ts
feasible === false
violations.length > 0
```

A technical failure is not a `RecoveryResult`.

Technical failures must be represented by the API/error layer and mapped to the frontend `TECHNICAL_ERROR` state.

---

## 4. Booking

A booking represents one travel/hospitality item.

Supported kinds:

```text
flight
train
hotel
```

Fields:

| Field | Meaning |
|---|---|
| `id` | Stable booking identifier |
| `kind` | Booking type |
| `origin` | Origin/location |
| `dest` | Destination/location |
| `start` | Start/departure/check-in time |
| `end` | End/arrival/check-out time |
| `cost` | Cost associated with booking |
| `refundRate` | Optional refund rate |

The frontend should not assume all bookings have identical display semantics. For example, hotel data should not be presented exactly like a flight.

---

## 5. Travel Goal

A travel goal represents a destination requirement.

Fields:

| Field | Meaning |
|---|---|
| `label` | Human-readable goal |
| `city` | Required city |
| `arriveBy` | Arrival deadline |
| `stayUntil` | Optional end requirement |

---

## 6. Traveller Constraints

Constraints include:

```text
home
maxExtraBudget
noOvernight
mustBeAt
```

The frontend should treat these as explicit requirements rather than inferred preferences.

Do not invent additional constraints in the UI if they are not supplied by the data model.

---

## 7. Disruption

A disruption identifies the affected booking and the type of disruption.

```ts
interface Disruption {
  bookingId: string;
  kind: "delay" | "cancel";
  delayMin?: number;
}
```

`delayMin` is relevant for delay scenarios.

The frontend should not display a delay duration when the disruption is a cancellation unless a separate backend field explicitly provides such information.

---

## 8. Constraint Violations

Supported categories:

```text
route
connection
hotel
overnight
deadline
budget
```

Each violation contains:
- type;
- associated booking;
- user-facing message.

The frontend may group violations by type but must preserve their factual meaning.

---

## 9. API Abstraction

The conceptual API surface is:

```text
GET  /api/trip
POST /api/disruption
GET/POST /api/alternatives
POST /api/recovery
```

The exact HTTP method for `/api/alternatives`, production backend base URL, authentication, and final response-envelope format remain backend integration details.

The frontend should isolate these details in a small API/client layer.

Do not scatter `fetch()` calls across visual components.

---

## 10. Frontend Workflow Mapping

Recommended conceptual calls:

### Load trip

```text
GET /api/trip
```

Produces itinerary and constraints.

### Apply/read disruption

```text
POST /api/disruption
```

Associates the disruption with the relevant booking.

### Evaluate alternatives

```text
GET/POST /api/alternatives
```

Provides candidate recovery options when the backend supports this stage explicitly.

### Produce recovery

```text
POST /api/recovery
```

Returns the recovery result or a technical failure.

---

## 11. Deterministic Simulator

The simulator should be deterministic.

Given the same:
- scenario;
- itinerary;
- disruption;
- constraints;

it should produce the same demonstration result.

This is important for:
- judging;
- repeatable demos;
- frontend development;
- debugging.

The simulator should not require an internet connection.

---

## 12. Demo Scenario Inputs

Supported query parameter:

```text
scenario
```

Expected values:

```text
delay
cancellation
```

The frontend may select deterministic scenario fixtures based on this value.

The scenario must not change the API/data contract itself.

---

## 13. State Model

Recommended frontend state:

```ts
type RecoveryFlowState =
  | "IDLE"
  | "TRIP_LOADED"
  | "DISRUPTION_DETECTED"
  | "IMPACT_ANALYSIS"
  | "RECOVERY_ANALYSIS"
  | "RECOVERY_READY"
  | "NO_FEASIBLE_RECOVERY"
  | "TECHNICAL_ERROR";
```

A reducer or equivalent state machine is preferable when the workflow becomes complex enough that independent booleans could create invalid combinations.

Avoid states such as:

```text
isLoading
isError
isRecovered
isNoRecovery
...
```

when their combinations can represent contradictory UI states.

---

## 14. API Error Handling

Technical failures should include enough information for debugging without exposing sensitive implementation details to the user.

Recommended frontend error shape:

```ts
interface ApiError {
  code?: string;
  message: string;
  status?: number;
}
```

The UI should show a concise user-facing message and keep technical diagnostics out of the primary visual experience unless useful for developer/demo mode.

---

## 15. Currency and Time

Currency formatting should be centralized.

Do not hard-code currency symbols throughout components.

Time formatting should also be centralized so that:
- locale;
- timezone;
- display precision;

can be changed without editing every component.

The backend contract should remain the source of truth for timestamps.

---

## 16. Data Ownership

The backend owns:
- final recovery computation;
- authoritative itinerary data;
- constraint evaluation;
- candidate generation;
- final feasibility.

The frontend owns:
- presentation;
- interaction;
- workflow visualization;
- animation;
- local demo orchestration;
- API-client integration.

The frontend must not silently override a backend feasibility decision.

---

## 17. No Third-Party API Coupling

The frontend should not directly call:
- airline APIs;
- hotel APIs;
- rail APIs;
- map providers;
- flight data providers;

as part of the core recovery workflow.

If external enrichment is introduced later, it should be hidden behind the backend/Sutra API abstraction.

---

## 18. Contract Evolution

Backend integration may change:
- endpoint base URL;
- authentication;
- response envelope;
- exact alternatives method;
- error codes.

These changes should be isolated to the API/data layer.

The visual components should consume normalized frontend data rather than backend-specific payload shapes.
