# Sutra Product Contract - Round 1

## 1. Product statement

> **Sutra is an AI travel-disruption recovery agent with a rail-first MVP. It takes an existing traveller itinerary, determines downstream consequences of a transport disruption, evaluates feasible recovery options against explicit traveller constraints, and produces an actionable recovery plan.**

## 2. Target user

A traveller with an existing multi-step itinerary whose transport disruption threatens one or more downstream commitments.

## 3. Trigger

A confirmed or simulated disruption affecting an existing transport booking.

Round 1 supports:

- rail delay;
- rail cancellation.

## 4. User input

The minimum recovery context is:

- existing trip;
- transport bookings and timings;
- downstream commitments relevant to recovery;
- explicit traveller hard constraints;
- disruption information.

## 5. Canonical itinerary shape

```text
Origin
  -> Rail leg A
  -> Interchange / connection
  -> Rail leg B
  -> Destination
  -> Hotel
```

The hotel exists mainly to demonstrate downstream impact. A destination activity can be added later but is not mandatory for the golden path.

## 6. Core traveller constraints

Round 1 hard constraints:

- latest acceptable arrival;
- maximum additional recovery budget;
- no overnight travel.

Soft preferences may exist but must never silently become hard constraints.

## 7. Core user journey

```text
TRIP READY
   ↓
USER STARTS RECOVERY
   ↓
DISRUPTION IDENTIFIED
   ↓
IMPACT TRACED
   ↓
RECOVERY ANALYZED
   ↓
RECOVERY RESULT
   ↓
USER REVIEWS / ACCEPTS PROPOSED PLAN
```

After recovery starts, the system advances the analysis stages automatically.

## 8. What Sutra does

Sutra:

1. loads the existing itinerary;
2. resolves the disruption;
3. determines direct and downstream effects;
4. identifies affected bookings and threatened constraints;
5. generates alternative recovery candidates;
6. validates hard constraints deterministically;
7. uses AI to rank/explain valid candidates;
8. independently validates the AI decision;
9. constructs a repaired itinerary;
10. produces traveller-facing actions.

## 9. What Sutra returns

A recovery plan containing:

- recovery status;
- repaired itinerary;
- original-to-repaired changes;
- additional cost;
- arrival impact;
- constraint results;
- recommendation and explanation;
- traveller actions;
- relevant provenance.

## 10. Success definition

A recovery is successful only when:

```text
all mandatory constraints pass
AND
all required itinerary dependencies remain valid
AND
the resulting itinerary is internally consistent
```

## 11. No-feasible-recovery definition

The system returns `NO_FEASIBLE_RECOVERY` when the defined recovery search space has been evaluated and no candidate satisfies all mandatory constraints.

The UI must show why candidates failed.

## 12. Technical failure definition

Technical failure means the system could not complete the recovery computation because of an application, infrastructure, provider, or AI failure.

Technical failure must remain distinct from infeasibility.

## 13. Agent vs assistant distinction

A normal recommendation system might return a list of replacement trains.

Sutra should instead perform the entire controlled loop:

```text
understand trip
→ understand disruption
→ trace impact
→ search options
→ enforce constraints
→ rank feasible recovery
→ explain choice
→ build repaired itinerary
```

This is the core agent behavior to demonstrate.

## 14. Round 1 non-goals

Sutra does not claim:

- universal transport support;
- real booking transactions;
- guaranteed live availability;
- automatic refunds;
- automatic cancellation;
- general holiday planning;
- end-to-end production travel management.

## 15. Product acceptance gate

The product contract is considered implemented only when a new team member can watch the golden-path demo and answer:

- what trip is being recovered;
- what went wrong;
- what was affected;
- what alternatives were evaluated;
- why some options failed;
- which recovery was selected;
- what changed;
- whether constraints remain satisfied;
- what the traveller needs to do next.
