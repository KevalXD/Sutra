# Sutra Domain Model and Recovery Semantics

## 1. Domain objective

The domain model describes the traveller's existing trip and the information required to repair it after disruption.

The model must be transport-agnostic while Round 1 implementations are rail-first.

## 2. Core entities

### Traveller

Represents the person whose trip and constraints are being recovered.

### Trip

The complete journey being protected. A trip contains itinerary items, constraints, dependency relationships, and a version/snapshot identifier.

### Itinerary Item

A meaningful booking or commitment within the trip.

Examples:

- transport booking;
- accommodation booking;
- activity/appointment commitment.

### Transport Booking

A booked transport service. It has a transport mode and one or more transport legs.

Round 1 uses `rail`.

Future modes can include `air` and `bus`.

### Transport Leg

A physical movement segment with origin, destination, departure, and arrival.

A booking and a leg are not assumed to be the same thing.

### Accommodation Booking

A stay commitment with a location and check-in/check-out requirements.

### Constraint

A traveller requirement used to decide whether a recovery candidate is acceptable.

### Dependency

A relationship indicating that one itinerary item imposes a condition on another.

Initial dependency types:

- `TEMPORAL` - A must finish before B starts.
- `CONNECTION` - A's arrival must leave enough time for B.
- `LOCATION` - A must end where B requires.
- `WINDOW` - A must occur within a time window.

### Disruption

A change affecting a transport booking or leg.

Round 1 types:

- delay;
- cancellation.

### Impact

The deterministic result of applying a disruption to the itinerary and propagating its consequences through dependencies.

### Alternative

A possible replacement transport service or recovery building block.

### Recovery Candidate

A complete proposed repair composed of one or more alternatives and corresponding itinerary changes.

### Recovery Plan

The selected, independently validated repaired itinerary plus explanation and traveller actions.

### Action

A traveller-facing operation that is proposed but not automatically executed in Round 1.

## 3. Booking state semantics

Use distinct meanings:

- `CONFIRMED` - existing accepted booking.
- `DISRUPTED` - directly affected by the incident.
- `AFFECTED` - downstream consequence of the incident.
- `CHANGED` - intentionally modified by a recovery plan.
- `CANCELLED` - explicitly cancelled.
- `UNCHANGED` - carried forward without modification.

A booking can be affected without being changed.

A booking can be changed without being cancelled.

## 4. Hard vs soft constraints

### Hard constraints

Must always pass.

Round 1:

- arrival deadline;
- maximum additional budget;
- no overnight travel.

### Soft preferences

Used only for ranking among feasible candidates.

Examples:

- prefer lower cost;
- prefer earlier arrival;
- prefer fewer changes;
- prefer preserving more original bookings;
- prefer same operator.

## 5. Impact semantics

Impact asks:

> What consequences does this disruption cause in the existing itinerary?

It does not ask:

> What recovery should we choose?

Those are separate phases.

## 6. Impact propagation

```text
1. Identify disrupted booking/leg.
2. Apply the disruption to a temporary itinerary state.
3. Recalculate affected time/location facts.
4. Traverse downstream dependencies.
5. Mark bookings whose validity or timing changes.
6. Evaluate which constraints become threatened/violated.
7. Continue until the downstream state stabilizes.
```

No LLM is required for this step.

## 7. Affected semantics

A booking is affected when the disruption changes a fact relevant to that booking or its dependency conditions.

Example:

```text
Train delayed
  → hotel arrival becomes later
  → hotel may be AFFECTED
  → hotel may remain valid and therefore UNCHANGED
```

Do not report the hotel as cancelled unless the data explicitly says so.

## 8. Candidate semantics

An alternative is not automatically a full recovery.

Example:

```text
Alternative A = one replacement train

Recovery Candidate 1 =
  replacement train A
  + keep hotel
```

Recovery candidates are what the validator and ranking layer compare.

## 9. Candidate feasibility

A recovery candidate is feasible only if:

```text
all mandatory dependencies remain valid
AND
all hard constraints pass
AND
all required itinerary elements remain internally consistent
```

AI never determines this truth.

## 10. Recovery optimization semantics

Among feasible candidates, prefer the candidate that best preserves the traveller's trip.

Recommended priority order:

```text
1. Satisfy all hard constraints.
2. Preserve unaffected/valid commitments.
3. Minimize number of changed items.
4. Minimize additional cost.
5. Minimize arrival delay.
6. Minimize recovery complexity/risk.
```

The implementation technology may vary. The semantics should not.

## 11. Original vs repaired state

Always retain both:

```text
ORIGINAL ITINERARY
        ↓
DISRUPTED STATE
        ↓
PROPOSED RECOVERY
        ↓
REPAIRED ITINERARY
```

Never destroy the baseline.

## 12. Recovery plan contents

A final plan contains:

- selected candidate;
- repaired itinerary;
- changed/replaced/new/unchanged items;
- cost delta;
- arrival delta;
- hard constraint results;
- concise recommendation reason;
- traveller actions;
- provenance/evidence where relevant.

## 13. Failure semantics

The domain/application layer must distinguish:

```text
RECOVERED
NO_FEASIBLE_RECOVERY
ANALYSIS_INCOMPLETE
TECHNICAL_ERROR
```

`ANALYSIS_INCOMPLETE` may remain internal in Round 1.

A technical failure must never become an infeasibility answer.

## 14. Round 1 domain decision

The model is intentionally richer than the Round 1 UI but smaller than a production travel platform.

That is deliberate: the domain must support credible itinerary reasoning without creating unnecessary provider, payment, account, or booking complexity.
