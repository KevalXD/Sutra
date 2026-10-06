# Sutra UX and State-Machine Mapping - Round 1

## 1. UX goal

Make the system feel like one calm, controlled recovery agent.

The user should understand the journey without needing to understand the internal implementation.

## 2. User-visible stages

```text
TRIP READY
   ↓
DISRUPTION
   ↓
IMPACT
   ↓
RECOVERING
   ↓
RECOVERED
```

Terminal alternatives:

```text
NO RECOVERY
ERROR
```

## 3. Internal application states

The implementation may distinguish:

```text
TRIP_LOADING
TRIP_READY
RECOVERY_REQUESTED
DISRUPTION_RESOLVING
IMPACT_ANALYSING
CANDIDATES_LOADING
CONSTRAINT_CHECK
AI_RANKING
RECOVERY_VALIDATION
RECOVERY_BUILDING
RECOVERY_READY
NO_FEASIBLE_RECOVERY
TECHNICAL_ERROR
```

The user does not need to see every internal state.

## 4. State machine

```text
LOAD
  ↓
TRIP_READY
  ↓
USER STARTS RECOVERY
  ↓
RECOVERY_REQUESTED
  ↓
DISRUPTION_RESOLVING
  ↓
IMPACT_ANALYSING
  ↓
CANDIDATES_LOADING
  ↓
CONSTRAINT_CHECK
  │
  ├── no feasible candidates → NO_FEASIBLE_RECOVERY
  │
  └── feasible candidates
          ↓
       AI_RANKING
          ↓
       RECOVERY_VALIDATION
          │
          ├── accepted → RECOVERY_BUILDING → RECOVERY_READY
          └── rejected → deterministic fallback → RECOVERY_BUILDING
```

Any active state may produce `TECHNICAL_ERROR` when the system cannot safely continue.

## 5. Trip Ready UX

User should see:

- route/journey;
- transport mode;
- key bookings;
- hard constraints;
- one dominant recovery action.

The current frontend's TripOverview is reusable here.

## 6. Disruption UX

The disruption should be visibly attached to the affected transport leg.

Show:

- booking/service;
- disruption type;
- old timing;
- new timing for delays;
- direct effect.

The journey visualization should look interrupted, not replaced by an unrelated alert card.

## 7. Impact UX

Show the causal chain:

```text
Disrupted booking
  ↓
Immediate effect
  ↓
Downstream booking
  ↓
Constraint impact
```

Do not show private reasoning, hidden prompts, or chain-of-thought.

The impact stage explains observable facts and dependencies.

## 8. Recovering UX

Show concise operational progress, for example:

```text
Checking affected bookings
Tracing downstream connections
Evaluating recovery candidates
Validating traveller constraints
Selecting recovery
```

Progress must eventually correspond to real system state/events rather than arbitrary fake activity.

## 9. Recovery result UX

Priority order:

```text
1. recovery status
2. repaired itinerary
3. constraint status
4. changes/cost
5. explanation
6. alternatives
```

The repaired trip is the visual hero.

## 10. Candidate comparison

Show at least:

- recommended candidate;
- other feasible candidates;
- rejected candidates with real hard-constraint failures;
- arrival time;
- additional cost;
- changed bookings.

The comparison should make the decision problem visible in seconds.

## 11. No-feasible UX

Communicate:

- analysis completed;
- no candidate satisfies all mandatory constraints;
- actual reasons candidates failed;
- affected bookings where useful;
- restart/review options.

Do not use success styling.

## 12. Technical-error UX

Communicate:

- analysis could not complete;
- the problem is technical;
- retry is available where appropriate.

Do not claim that the trip is impossible merely because a service failed.

## 13. Demo mode

Demo mode can expose:

- delay;
- cancellation;
- no feasible recovery;
- technical error.

These controls are a testing/judging feature, not the central user experience.

## 14. Final interaction model

Target:

```text
User
  → Load trip
  → Recover this journey
  → Sutra progresses automatically
  → User reviews the proposed recovery
```

Avoid making the user click through each internal stage.

## 15. Current frontend mapping

The current GitHub frontend contains reusable areas for:

- hero/trip context;
- journey band;
- disruption display;
- impact trace;
- recovery analysis;
- candidate comparison;
- repaired journey transition;
- no-feasible state;
- technical-error state.

These should be adapted to the rail-first product contract rather than replaced wholesale.

## 16. Accessibility requirements

Retain the existing baseline:

- keyboard accessibility;
- visible focus;
- reduced-motion behavior;
- adequate contrast;
- semantic headings/landmarks;
- meaningful labels.

Stage activation should move focus to the new content when necessary.

## 17. UX acceptance gate

A first-time reviewer should be able to answer:

```text
What was my trip?
What broke?
What did it affect?
What is Sutra doing?
What options exist?
Why was one chosen?
What is my repaired trip?
What do I need to do?
```

without reading source code.
