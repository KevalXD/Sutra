# Sutra Master Plan - DevHack 2026 Round 1

## 1. Objective

Build a technically credible, judge-demonstrable MVP for DevHack 2026 PS 4.1, **AI Agent for Travel Disruption Recovery**.

The rulebook asks teams to build a solution that can detect or simulate travel disruptions, identify affected bookings, evaluate alternative recovery options under traveller constraints, and produce a recovery itinerary. It also states that Round 1 includes a PPT, a GitHub MVP, and a demo video, with the MVP demo video carrying extra weight.

This plan exists to make every one of those claims traceable to implementation and test evidence.

## 2. Product vision

Sutra is not a generic travel planner and not a booking marketplace.

Its core job is:

```text
Existing trip
    -> disruption occurs
    -> determine what is affected
    -> find feasible alternatives
    -> enforce hard constraints
    -> use AI to rank/explain valid recovery choices
    -> construct a repaired itinerary
    -> present traveller actions
```

Round 1 proves this with rail as the primary transport mode.

## 3. Round 1 golden path

The canonical demonstration is a multi-leg rail journey with downstream accommodation and explicit traveller constraints.

Conceptually:

```text
Origin
  |
  | Rail leg A
  v
Interchange
  |
  | Rail leg B
  v
Destination
  |
  v
Hotel
```

The traveller has at least these hard constraints:

- latest acceptable destination arrival;
- maximum additional recovery budget;
- no overnight travel.

A simulated delay on Rail A causes the original connection to fail. Sutra traces the consequences, evaluates several alternatives, rejects candidates that violate hard constraints, selects or ranks a valid recovery, and produces the repaired itinerary.

The exact fixture values and labels are part of implementation data, not real-world claims.

## 4. Product boundaries

### Must exist for Round 1

- Existing itinerary loaded before recovery.
- Rail delay simulation.
- Rail cancellation simulation.
- Affected-booking analysis.
- Alternative rail candidate generation.
- Hard constraint validation.
- AI ranking/explanation over feasible candidates.
- Independent post-validation of AI output.
- Repaired itinerary.
- Changes, cost, and constraint status.
- Traveller action list.
- No-feasible-recovery state.
- Technical-error state.
- Deterministic demo path.

### Strongly desirable after the golden path works

- Better candidate comparison.
- Natural-language preference input.
- More realistic schedule-derived fixtures.
- Destination incident as a secondary scenario.
- Evidence/provenance display.

### Explicitly deferred

- Flight support in Round 1.
- Bus support in Round 1.
- Water transport.
- Multi-modal optimization.
- Ticket purchase.
- Automatic cancellation/refund.
- Payment.
- Production booking integration.
- Universal live disruption monitoring.
- General trip planning.
- Multi-agent orchestration.
- Database-backed consumer account system.

## 5. Architecture principle

Use a modular monolith for Round 1.

```text
Browser
  -> Next.js UI
  -> thin API boundary
  -> Recovery Orchestrator
  -> domain/recovery services
  -> adapters for simulation, transport data, and AI
```

The recovery domain must not depend on React or provider-specific APIs.

## 6. Recovery pipeline

```text
Request validation
    -> trip loading
    -> disruption resolution
    -> impact analysis
    -> candidate generation
    -> hard constraint validation
    -> AI ranking/explanation
    -> AI output validation
    -> deterministic fallback if needed
    -> recovery plan construction
    -> traveller actions
    -> final result
```

## 7. AI policy

AI is advisory. Deterministic domain logic is authoritative.

AI may:

- interpret soft traveller preferences;
- rank already-feasible recovery candidates;
- explain trade-offs using verified facts;
- normalize unstructured disruption text later.

AI may not:

- invent services, prices, availability, or bookings;
- decide hard feasibility;
- override a hard constraint;
- perform booking state transitions;
- claim an action was executed when it was only proposed.

## 8. Data policy

Round 1 uses deterministic Sutra-owned fixtures as the guaranteed data source.

Public data such as GTFS/GTFS-Realtime may be used for reference, enrichment, or snapshot generation, but the judging path must not depend on a live external service.

All external facts must retain provenance when used.

## 9. UX principle

The user should feel that one recovery agent is doing the work, not that the user is manually operating a workflow engine.

Target interaction:

```text
Load trip
  -> Recover this journey
  -> Sutra automatically progresses through disruption, impact, and recovery analysis
  -> user reviews the proposed recovery
```

The existing continuous single-route visual experience should be preserved where it remains compatible with the new product contract.

## 10. Definition of success

Round 1 is ready only when:

```text
rulebook requirements pass
+ golden path passes
+ failure paths pass
+ hard constraints are never violated
+ AI cannot bypass validation
+ result is reproducible
+ judge-visible evidence exists
+ demo works without live provider dependency
+ PPT, GitHub MVP, and demo video are ready
```

## 11. Execution sequence

### Phase A - Freeze

Complete product, domain, architecture, data, UX, requirements, and ownership decisions.

### Phase B - Vertical slice

Build one rail-delay recovery flow end to end before expanding scope.

### Phase C - Reliability

Add cancellation, infeasibility, error handling, adversarial cases, and deterministic regression tests.

### Phase D - AI

Add model-backed ranking/explanation behind the deterministic feasibility boundary.

### Phase E - Polish

Adapt the existing visual prototype, add judge-visible provenance and comparison clarity, and finish accessibility/performance checks.

### Phase F - Submission

Freeze the demo, produce PPT and demo video, and rehearse a failure-safe demonstration.

## 12. Final architecture review gate

Before coding is considered complete, the team must verify:

- frontend is not authoritative for feasibility;
- transport-specific behavior is behind adapters;
- simulation is behind adapters;
- AI is server-side and post-validated;
- original itinerary is preserved;
- technical error cannot become infeasibility;
- no unsupported capability is presented as implemented.
