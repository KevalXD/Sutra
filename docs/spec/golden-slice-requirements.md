# Sutra Golden Slice Requirements

**Status:** FROZEN  
**Scope:** DevHack 2026 Round 1  
**Golden scenario:** `golden-rail-delay-01`

## 1. Purpose

This document defines the exact observable behavior required for the first end-to-end Sutra recovery flow.

The golden slice must demonstrate that Sutra can take an existing rail itinerary, apply a simulated disruption, determine its downstream impact, evaluate recovery candidates against hard traveller constraints, select a valid recovery, and produce a repaired itinerary with traveller actions.

The implementation must satisfy this contract without depending on live external transport providers.

---

## 2. Golden Slice

The canonical flow is:

```text
Existing rail trip
    ↓
Simulated rail delay
    ↓
Impact analysis
    ↓
Recovery candidate generation
    ↓
Hard-constraint validation
    ↓
Feasible candidate set
    ↓
AI ranking/explanation
    ↓
Independent post-validation
    ↓
Recovery plan
    ↓
Repaired itinerary
    ↓
Traveller actions
```

The golden scenario is a synthetic multi-leg rail journey containing:

```text
Origin
  ↓
Rail leg A
  ↓
Interchange
  ↓
Rail leg B
  ↓
Destination
  ↓
Hotel
```

The first rail leg receives a simulated **120-minute delay**.

The delay causes the original downstream connection to fail.

The scenario contains multiple recovery candidates, including:

- at least two feasible recovery candidates;
- candidates rejected because of hard constraints;
- enough variation to demonstrate meaningful recovery ranking.

The exact fixture values, timestamps, candidate IDs, and expected candidate ranking belong to the canonical `golden-rail-delay-01` fixture and must not be independently invented by UI or service implementations.

---

## 3. Inputs

The recovery system receives:

### Trip

A canonical `Trip` containing:

- trip ID;
- trip version;
- currency;
- itinerary items;
- dependencies;
- traveller constraints.

### Itinerary

The golden itinerary contains:

- the first rail booking;
- the second connecting rail booking;
- the downstream hotel booking.

Round 1 transport mode is `rail`.

### Disruption

The golden disruption is:

```json
{
  "source": "SIMULATED",
  "scenarioId": "golden-rail-delay-01",
  "bookingId": "RAIL-A",
  "kind": "delay",
  "delayMinutes": 120
}
```

### Hard constraints

The golden scenario includes:

- latest acceptable destination arrival;
- maximum additional recovery budget;
- no overnight travel.

These are authoritative constraints.

A recovery candidate violating any hard constraint is infeasible.

### Soft preferences

Soft preferences may be supplied for candidate ranking.

Examples include:

- lower cost;
- earlier arrival;
- fewer changes;
- preserving more of the original itinerary.

Soft preferences must never convert an infeasible candidate into a feasible one.

---

## 4. What Constitutes a Rail Disruption

Round 1 supports two disruption kinds:

```text
delay
cancellation
```

The golden slice uses:

```text
delay
```

A delay changes the affected transport timing.

The system must not infer cancellation from delay.

A disruption is applied to the referenced transport booking/leg and then propagated through the itinerary dependency graph.

---

## 5. Impact Analysis

Impact analysis answers:

> What consequences does this disruption cause to the existing itinerary?

It does not decide which recovery should be selected.

For the golden delay scenario, the system must:

1. identify `RAIL-A` as the directly disrupted booking;
2. recalculate its affected timing;
3. evaluate the connection to `RAIL-B`;
4. identify `RAIL-B` as affected because the original connection is missed;
5. propagate downstream consequences to `HOTEL-1`;
6. identify which traveller constraints are threatened or violated;
7. preserve the distinction between impact and recovery change.

The expected semantic distinction is:

```text
RAIL-A
  impactState = DISRUPTED

RAIL-B
  impactState = AFFECTED

HOTEL-1
  impactState = AFFECTED
```

An affected hotel is not automatically cancelled.

An affected booking is not automatically changed.

---

## 6. Impact Output

Impact analysis must expose enough information for the recovery layer and UI to explain what happened.

At minimum it must contain:

```text
disrupted item IDs
affected item IDs
impact reasons
```

Example:

```json
{
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
}
```

The exact wording may vary, but the factual meaning must remain correct.

---

## 7. Recovery Candidate

A recovery candidate is a complete proposed repair, not merely a replacement train.

A candidate may contain one or more alternatives plus the resulting itinerary state.

Each candidate must contain enough information to determine:

- which alternatives are proposed;
- which itinerary items change;
- impact states;
- recovery changes;
- feasibility;
- constraint violations;
- additional cost;
- final arrival time.

Canonical structure:

```ts
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
```

An alternative represents a possible replacement transport option.

An alternative is not itself proof of a feasible recovery.

---

## 8. Constraint Validation

Hard constraint validation is deterministic.

The following constraints are authoritative for Round 1:

```text
ARRIVAL_DEADLINE
MAX_EXTRA_BUDGET
NO_OVERNIGHT
```

A candidate is feasible only when:

```text
all mandatory dependencies remain valid
AND
all hard constraints pass
AND
the resulting itinerary is internally consistent
```

At minimum, the validator must reject candidates that:

```text
arrive after the permitted deadline;
exceed the maximum additional budget;
require overnight travel when overnight travel is prohibited;
break required connections;
contain invalid itinerary timing.
```

Constraint validation must occur before AI ranking.

The AI must never determine hard feasibility.

---

## 9. Candidate Classification

Every generated candidate must receive a deterministic feasibility result.

A feasible candidate has:

```text
feasible = true
violations = []
```

An infeasible candidate has:

```text
feasible = false
violations.length > 0
```

The system must retain the reasons why rejected candidates failed.

This is required both for debugging and for judge-visible explanation.

---

## 10. AI Boundary

AI receives only candidates that deterministic logic has already marked feasible.

AI may:

- rank feasible candidates;
- interpret soft preferences;
- explain trade-offs;
- provide a concise recommendation reason.

AI may not:

- determine hard feasibility;
- override a failed constraint;
- invent a candidate;
- invent price or availability;
- modify booking state;
- claim an action was executed.

The AI output must be independently validated.

The selected candidate ID must:

1. exist;
2. belong to the supplied candidate set;
3. already be feasible;
4. remain valid after post-validation.

If AI is unavailable or produces invalid output, deterministic fallback ranking must be used when a feasible candidate exists.

---

## 11. Recovery Plan

A recovery plan is the final validated repaired state.

It must contain:

- selected recovery candidate;
- repaired itinerary;
- original-to-repaired changes;
- additional cost;
- arrival impact;
- hard constraint results;
- recommendation reason;
- traveller actions;
- relevant provenance/evidence.

The original itinerary must remain available as the baseline.

The system must never overwrite the original itinerary with the repaired state.

The conceptual state transition is:

```text
ORIGINAL
   ↓
DISRUPTED
   ↓
RECOVERY PROPOSED
   ↓
REPAIRED
```

---

## 12. Recovery Status

The system exposes three public recovery outcomes:

```text
RECOVERED
NO_FEASIBLE_RECOVERY
TECHNICAL_ERROR
```

### `RECOVERED`

Used when a valid recovery plan has been produced and all mandatory constraints pass.

### `NO_FEASIBLE_RECOVERY`

Used only when the defined recovery search space has been evaluated and no candidate satisfies all mandatory constraints.

### `TECHNICAL_ERROR`

Used when the recovery computation cannot be completed because of an application, infrastructure, provider, or AI failure.

A technical failure must never be converted into `NO_FEASIBLE_RECOVERY`.

---

## 13. Traveller Actions

Round 1 actions are proposals only.

Examples:

```text
Take replacement train
Review changed itinerary
Confirm proposed recovery
Contact provider if required
```

The system must not claim that a booking was purchased, cancelled, refunded, or externally modified.

No real transaction occurs in the golden slice.

---

## 14. Golden Slice Acceptance Criteria

### AC-01 – Deterministic input

Given the `golden-rail-delay-01` fixture, the recovery run can be started without external provider access.

### AC-02 – Disruption identification

The system identifies `RAIL-A` as the disrupted rail booking and applies the configured 120-minute delay.

### AC-03 – Correct impact propagation

The system identifies the expected downstream affected bookings, including the failed connection and affected hotel relationship.

### AC-04 – State semantics

The system distinguishes:

```text
DISRUPTED
AFFECTED
UNCHANGED
```

and does not incorrectly mark an affected downstream booking as cancelled.

### AC-05 – Candidate generation

The system produces multiple recovery candidates for the disrupted journey.

### AC-06 – Deterministic feasibility

Every candidate is evaluated against the mandatory constraints before AI ranking.

### AC-07 – Invalid candidates rejected

Candidates violating the arrival deadline, recovery budget, overnight restriction, or required connection are marked infeasible and cannot be selected.

### AC-08 – Feasible candidates available

The golden scenario contains at least two candidates that satisfy all mandatory constraints.

### AC-09 – AI operates only on feasible candidates

The AI receives only the feasible candidate set.

It cannot select a candidate that deterministic validation marked infeasible.

### AC-10 – AI post-validation

The selected candidate is independently validated before becoming the final recommendation.

Invalid AI output is rejected.

### AC-11 – Deterministic fallback

If AI is unavailable or invalid, the system can select a valid feasible candidate using deterministic fallback logic.

### AC-12 – Repaired itinerary

The system produces a repaired itinerary that is internally consistent and satisfies every mandatory constraint.

### AC-13 – Original itinerary preserved

The original itinerary remains available for comparison with the repaired itinerary.

### AC-14 – Recovery explanation

The final result explains:

```text
what went wrong;
what was affected;
which alternatives were considered;
why rejected options failed;
which recovery was selected;
what changed;
what the traveller must do next.
```

### AC-15 – Deterministic judging path

The complete golden slice can be demonstrated offline using Sutra-owned deterministic data.

No live provider dependency may be required.

---

## 15. Observable Golden Demo

A judge watching the golden demo must be able to see this sequence:

```text
1. Existing rail journey is loaded.

2. Traveller constraints are visible.

3. A 120-minute delay affects Rail A.

4. Sutra identifies the failed Rail A → Rail B connection.

5. Downstream impact is shown.

6. Multiple recovery candidates are evaluated.

7. Candidates violating hard constraints are rejected.

8. Feasible candidates remain.

9. AI ranks/explains the feasible options.

10. The recommendation is post-validated.

11. A repaired itinerary is produced.

12. Cost and arrival changes are shown.

13. Constraint status is shown as satisfied.

14. Traveller actions are presented.

15. The original and repaired states remain distinguishable.
```

This is the minimum behavior that must be demonstrable for the golden slice to be considered complete.

---

## 16. Explicitly Out of Scope

The golden slice does not implement:

- flights;
- buses;
- water transport;
- multimodal optimization;
- live disruption feeds;
- live seat availability;
- ticket purchase;
- cancellation transactions;
- refunds;
- payments;
- automatic external actions;
- consumer accounts;
- production database infrastructure;
- graph databases;
- microservices;
- general travel planning.

These are not acceptance criteria for the first implementation slice.

---

## 17. Source of Truth

Implementation authority is:

1. DevHack rulebook for competition requirements.
2. `docs/planning/` for Sutra product and engineering decisions.
3. `docs/planning/12_FINAL_FREEZE.md` for frozen Round 1 implementation decisions.
4. This document for the golden-slice behavioral contract.
5. The `golden-rail-delay-01` fixture for exact scenario data and expected values.

`docs/spec/04_DATA_CONTRACT.md` is transitional and must not override the frozen Round 1 domain model.

---

## 18. Contract Boundary

This document defines **what the system must do**.

It does not prescribe:

- class names;
- function names;
- internal module structure;
- framework-specific implementation;
- database design;
- AI provider;
- UI component implementation.

Implementation choices remain with the development team as long as observable behavior satisfies this contract.