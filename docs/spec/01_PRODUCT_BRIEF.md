# Sutra - Product Brief

## 1. Product Identity

**Product:** Sutra  
**Context:** An AI Agent for Travel Disruption Recovery

Sutra is a travel recovery agent designed to respond when a disruption breaks the relationships between bookings in a traveller's itinerary.

The product is not a generic travel planner. Its purpose is to detect disruption, understand its downstream impact, evaluate recovery options against traveller constraints, and present a feasible repaired itinerary when one exists.

### Core narrative

```text
TRIP
  ↓
DISRUPTION
  ↓
IMPACT
  ↓
RECOVERY
  ↓
EXPLANATION
```

The interface should make this sequence visually obvious.

---

## 2. Problem

Travel disruptions such as flight delays and cancellations can affect more than the disrupted booking itself.

A delay may cause:
- a missed onward flight or train;
- a hotel check-in problem;
- failure to meet a required arrival deadline;
- an overnight constraint violation;
- an increase beyond the traveller's allowed recovery budget.

A useful recovery agent therefore needs to reason across the itinerary rather than simply show an alternative for the disrupted booking.

---

## 3. Product Goal

Sutra should demonstrate that an AI agent can:

1. Load a traveller's itinerary and constraints.
2. Detect a disruption.
3. Identify affected and downstream bookings.
4. Evaluate recovery candidates.
5. Validate candidates against explicit traveller constraints.
6. Produce a repaired itinerary when a feasible recovery exists.
7. Clearly explain what changed and why.
8. Explicitly report when no feasible recovery exists.
9. Distinguish a genuine infeasibility result from a technical failure.

The frontend is a demonstration interface for this workflow. It must not imply capabilities that are not represented by the supplied data or backend contract.

---

## 4. Target Demo

The MVP is a focused single-workflow demonstration rather than a complete consumer travel platform.

The primary route is:

```text
/
```

Demo scenarios are selected through query parameters:

```text
/?scenario=delay
/?scenario=cancellation
```

The default experience may use the deterministic simulator when no live backend is available.

There are no separate frontend pages for disruption, analysis, alternatives, and recovery. These are stages of one continuous recovery workflow.

---

## 5. Workflow States

The frontend should model the recovery process using these states:

```text
IDLE
  ↓
TRIP_LOADED
  ↓
DISRUPTION_DETECTED
  ↓
IMPACT_ANALYSIS
  ↓
RECOVERY_ANALYSIS
  ↓
RECOVERY_READY
```

Two terminal/error conditions are first-class:

```text
NO_FEASIBLE_RECOVERY
TECHNICAL_ERROR
```

### State meanings

**IDLE**
- No recovery run has started.
- The user can begin the demo/recovery flow.

**TRIP_LOADED**
- The itinerary and traveller constraints are available.

**DISRUPTION_DETECTED**
- A disruption has been identified and associated with a booking.

**IMPACT_ANALYSIS**
- Sutra is determining which downstream bookings and constraints are affected.

**RECOVERY_ANALYSIS**
- Sutra is evaluating candidate recovery options and validating constraints.

**RECOVERY_READY**
- A feasible recovery has been produced.

**NO_FEASIBLE_RECOVERY**
- The system completed its analysis but could not produce an itinerary satisfying the required constraints.

**TECHNICAL_ERROR**
- The recovery process could not complete because of a system/API/runtime failure.
- This must not be presented as "no recovery available."

---

## 6. Recovery Result Priority

When recovery succeeds, present information in this order:

1. Recovery status
2. Repaired itinerary
3. Constraint status
4. Changes and additional cost
5. Explanation
6. Alternatives

The interface should make the repaired journey easier to understand than the underlying agent mechanics.

---

## 7. Impact Model

The central impact relationship is:

```text
Disrupted Booking
      ↓
Immediate Effect
      ↓
Downstream Booking
      ↓
Constraint Impact
```

Example:

```text
Flight delayed
      ↓
Arrival moves later
      ↓
Train connection becomes unreachable
      ↓
"Must arrive by" constraint is violated
```

This relationship should be reflected visually in the interface.

---

## 8. Agent Activity

Sutra may display concise operational activity while analysis is running, for example:

```text
Checking affected bookings...
Tracing downstream connections...
Evaluating recovery candidates...
Validating traveller constraints...
Recovery found.
```

These are interface status messages, not hidden chain-of-thought.

Do not expose private model reasoning, internal deliberation, hidden prompts, or fabricated reasoning traces.

---

## 9. No-Feasible-Recovery Experience

When no feasible recovery exists, the interface must clearly communicate:

- that analysis completed;
- that no candidate satisfied the required constraints;
- which constraints could not be satisfied;
- any relevant affected bookings;
- that the result is not a technical error.

Do not show a success state with an invalid itinerary.

---

## 10. Technical Error Experience

Technical errors should communicate:

- the recovery request could not be completed;
- the problem is technical rather than a travel feasibility result;
- the user can retry where appropriate.

Do not convert HTTP/API/runtime failures into `NO_FEASIBLE_RECOVERY`.

---

## 11. Product Personality

The visual and verbal personality is:

**Luxury Travel × Intelligent Operations × Cinematic Restraint**

Sutra should feel:
- calm;
- precise;
- intelligent;
- operational;
- premium;
- trustworthy;
- controlled.

Avoid:
- generic AI SaaS styling;
- excessive glassmorphism;
- giant rounded cards everywhere;
- neon cyberpunk;
- purple/cyan "AI" gradients;
- decorative particles everywhere;
- unnecessary 3D;
- fake terminal-log aesthetics;
- dense generic dashboards.

---

## 12. MVP Scope

### In scope

- One primary workflow.
- Delay and cancellation demo scenarios.
- Trip overview.
- Disruption display.
- Impact analysis.
- Recovery analysis.
- Feasible recovery result.
- No-feasible-recovery result.
- Technical-error state.
- Responsive desktop-first interface.
- Deterministic simulator.
- API abstraction for future backend integration.
- Accessible motion and reduced-motion handling.

### Out of scope

- User accounts.
- Authentication.
- Profile/settings pages.
- Payment.
- Booking purchases.
- Real-world booking issuance.
- Direct frontend calls to third-party travel APIs.
- A consumer-grade itinerary management platform.
- Guaranteed live airline/rail/hotel data.

---

## 13. Demo Data Philosophy

The deterministic simulator is the guaranteed demonstration path.

Optional live enrichment may be introduced later, but the core demo must not depend on paid or trial-only APIs or on an external provider being available during judging.

The UI must consume the Sutra API/data abstraction rather than coupling components directly to third-party providers.

---

## 14. Success Criteria

A successful frontend implementation should allow a reviewer to understand, without reading source code:

1. What trip is being recovered.
2. What went wrong.
3. What downstream impact occurred.
4. What Sutra evaluated.
5. Whether recovery is feasible.
6. What the repaired itinerary is.
7. What changed.
8. Whether traveller constraints remain satisfied.
9. Why the result was produced at a useful, user-facing level.

The product should feel like one coherent recovery system rather than a collection of unrelated UI components.
