# Sutra - Implementation Work Breakdown

## Purpose

This is the execution-level plan for converting the frozen Sutra planning decisions into a working DevHack 2026 Round 1 MVP.

This document is intentionally implementation-oriented. It does not redefine the product contract, domain semantics, architecture, or hackathon scope. Those are established by the other planning documents.

---

## 1. Delivery principle

Build one complete vertical slice first:

```text
Rail delay
  -> impact analysis
  -> recovery candidates
  -> hard-constraint validation
  -> deterministic recovery
  -> frontend result
```

Only after that slice is stable should the team add cancellation, AI ranking/explanation, failure scenarios, and polish.

---

## 2. Priority classes

### P0 - Must build

Work required for a credible PS 4.1 Round 1 MVP.

### P1 - Should build

Meaningful improvements after the P0 golden path works.

### P2 - Time permitting

Useful differentiators or future-facing capabilities that must not threaten the P0 path.

### OUT - Do not build for Round 1

Explicitly outside the current scope.

---

## 3. Work breakdown

| ID | Priority | Epic | Task | Owner | Dependency | Acceptance test | Milestone |
|---|---|---|---|---|---|---|---|
| W01 | P0 | Contract | Freeze canonical Rail-delay scenario and expected result | Likhith + Mayank | Product contract | Scenario has fixed inputs, expected affected set, feasible/infeasible candidates, expected final result | M1 |
| W02 | P0 | Contract | Freeze API request/response shapes | Nithesh + Mayank | W01 | Frontend can type against the agreed contract without backend-specific assumptions | M1 |
| W03 | P0 | Domain | Replace flight-centric demo assumptions with rail-first domain fixtures | Mayank | W01 | Golden trip contains rail disruption, downstream dependency, hotel, and constraints | M2 |
| W04 | P0 | Domain | Implement transport mode abstraction with rail implementation | Mayank | W03 | Recovery core receives normalized transport data and does not import rail UI/provider code | M2 |
| W05 | P0 | Domain | Implement itinerary dependencies and impact propagation | Mayank | W03 | Expected affected bookings exactly match ground truth for golden scenario | M2 |
| W06 | P0 | Domain | Implement hard-constraint validator | Mayank | W03 | Budget, deadline, overnight, and connection violations are deterministic and testable | M2 |
| W07 | P0 | Domain | Implement alternative candidate generation from deterministic rail catalogue | Mayank | W04 | At least 3 candidates are produced for golden scenario | M2 |
| W08 | P0 | Domain | Implement deterministic recovery selection/fallback policy | Mayank | W06 + W07 | Valid candidate selected by fixed policy when AI is unavailable | M2 |
| W09 | P0 | API | Implement thin recovery-run API boundary | Nithesh | W02 + W08 | One request can execute the full recovery pipeline and return a structured result | M2 |
| W10 | P0 | Frontend | Adapt trip UI to rail-first normalized data | Keval | W02 + W03 | Trip view renders correct transport, bookings, and constraints | M2 |
| W11 | P0 | Frontend | Adapt disruption visualization to rail delay | Keval | W02 + W05 | Disrupted rail leg shows correct before/after timing and affected downstream state | M2 |
| W12 | P0 | Integration | Wire frontend start action to recovery API | Nithesh + Keval | W09 + W10 | Browser action creates a real recovery request and receives a valid result | M2 |
| W13 | P0 | UX | Change workflow from manually advancing technical stages to agent-driven progression | Nithesh + Keval | W09 | After starting recovery, stages advance from actual application state rather than user clicking each internal stage | M2 |
| W14 | P0 | E2E | Complete golden-path browser test | Nithesh + Likhith | W12 + W13 | Rail delay scenario reaches RECOVERED with correct final result | M2 |
| W15 | P0 | Recovery UI | Display repaired itinerary, changes, cost, constraints, and actions | Keval | W09 + W14 | Final screen exposes every required PS 4.1 result component | M2 |
| W16 | P0 | Failure | Implement explicit NO_FEASIBLE_RECOVERY state | Mayank + Keval | W06 + W09 | All-invalid candidate scenario returns infeasibility, not technical error | M3 |
| W17 | P0 | Failure | Implement explicit TECHNICAL_ERROR path and retry | Nithesh + Keval | W09 | Simulated service failure produces error state and retry restores normal flow | M3 |
| W18 | P0 | Cancellation | Add deterministic rail cancellation scenario | Mayank + Keval | W08 + W15 | Cancellation scenario produces valid replacement recovery or correct infeasibility | M3 |
| W19 | P0 | AI | Define AI decision context and structured output contract | Mayank + Nithesh | W08 + W09 | AI receives verified facts/candidate set and returns structured candidate ID + explanation | M4 |
| W20 | P0 | AI | Add AI ranking/explanation adapter | Mayank | W19 | At least one valid candidate can be recommended with grounded explanation | M4 |
| W21 | P0 | AI | Add AI post-validation | Mayank | W20 + W06 | Invalid/nonexistent AI recommendation is rejected | M4 |
| W22 | P0 | AI | Add deterministic fallback when AI fails | Mayank + Nithesh | W08 + W21 | AI timeout/malformed output still produces a safe result when deterministic recovery exists | M4 |
| W23 | P0 | QA | Adversarial constraint tests | Likhith + Mayank | W06 | Budget, deadline, overnight, and connection edge cases pass | M5 |
| W24 | P0 | QA | Data-integrity tests | Mayank + Nithesh | W03-W09 | Invalid IDs, impossible times, malformed candidates, and stale/incompatible requests fail safely | M5 |
| W25 | P0 | QA | Full requirements traceability pass | Likhith | W14-W24 | Every mandatory PS 4.1 requirement maps to code, test, and visible evidence | M5 |
| W26 | P0 | QA | Regression suite for four Round 1 scenarios | Nithesh + Likhith | W18 + W21 + W23 | Delay, cancellation, infeasible, and technical-error scenarios remain green | M5 |
| W27 | P0 | UX | Final judge-facing result hierarchy | Keval | W15 | Status, repaired itinerary, constraints, changes, explanation, alternatives are visually ordered | M6 |
| W28 | P0 | Integration | Production build/deployment validation | Nithesh | W26 + W27 | Clean production build and deployed demo pass smoke test | M6 |
| W29 | P0 | Demo | Freeze golden demo path and backup path | Likhith + Nithesh | W28 | Demo can be completed reliably without manual code/data changes | M6 |
| W30 | P0 | Submission | Build Round 1 evidence set: GitHub, screenshots, demo recording, PPT inputs | Likhith | W25 + W29 | All required submission elements are available and consistent | M7 |
| W31 | P1 | Data | Add schedule-derived realism from a reviewed public dataset snapshot | Mayank | P0 data path stable | External-derived fixture has provenance and does not alter the guaranteed demo path | M6 |
| W32 | P1 | UX | Show source/provenance labels where helpful | Keval | W31 | User can distinguish simulated vs externally sourced facts | M6 |
| W33 | P1 | Preferences | Add natural-language soft preference input | Mayank + Nithesh | W20 + deterministic preference model | Preference changes ranking without overriding hard constraints | M6 |
| W34 | P1 | Recovery | Improve candidate comparison and trade-off explanation | Keval + Mayank | W21 + W27 | Feasible/infeasible trade-offs are clear in one comparison surface | M6 |
| W35 | P2 | Incident | Add destination incident scenario | Mayank + Keval | P0 stable | Secondary scenario works without changing core rail recovery semantics | Post-MVP |
| W36 | P2 | Live data | Prototype optional live incident adapter behind feature flag | Mayank | W31 | Live source can be enabled without changing domain interfaces; demo remains fixture-backed | Post-MVP |
| W37 | P2 | Streaming | Replace fixed progress timers with real recovery-stage events | Nithesh + Keval | W09 + W28 | Displayed analysis stages correspond to application events | Post-MVP |
| W38 | OUT | Transport | Implement air support | — | — | Not planned for Round 1 | — |
| W39 | OUT | Transport | Implement bus support | — | — | Not planned for Round 1 | — |
| W40 | OUT | Platform | Implement booking/payment/refund transactions | — | — | Not planned for Round 1 | — |
| W41 | OUT | Platform | Build consumer accounts/database platform | — | — | Not planned for Round 1 | — |
| W42 | OUT | Architecture | Introduce microservices/event bus/Kubernetes | — | — | Not planned for Round 1 | — |

---

## 4. Milestones

### M1 - Contract Freeze

Target outcome:

```text
Product contract
  -> domain contract
  -> API contract
```

Must be complete before heavy parallel implementation.

Primary owners: Mayank, Nithesh, Likhith.

Keval reviews frontend data requirements.

### M2 - Golden Vertical Slice

Target outcome:

```text
Rail delay
  -> impact
  -> candidates
  -> hard constraints
  -> deterministic recovery
  -> browser result
```

This is the most important milestone in the entire plan.

Nothing P1/P2 should interrupt it.

### M3 - Reliability Core

Add:

```text
cancellation
no feasible recovery
technical failure
retry
```

At the end of M3, Sutra should already be a credible non-AI or AI-optional PS 4.1 prototype.

### M4 - AI Layer

Add:

```text
verified feasible candidates
  -> AI ranking/explanation
  -> post-validation
  -> fallback
```

AI must remain downstream of hard constraint validation.

### M5 - QA Gate

Run:

```text
requirements traceability
adversarial cases
data integrity
AI failure tests
four-scenario regression
```

No new feature should enter the critical path after M5 without explicit approval.

### M6 - Demo-Ready Product

Finish:

```text
UX polish
responsive/accessibility checks
build/deployment
judge-visible evidence
demo freeze
```

### M7 - Submission Package

Complete:

```text
PPT
GitHub MVP
Demo video
Final rehearsal
Submission buffer
```

DevHack Round 1 submission closes on 20 October 2026.

---

## 5. Dependency rules

### Rule 1
The golden vertical slice blocks all optional feature work.

### Rule 2
The deterministic recovery core blocks AI integration.

### Rule 3
The API contract blocks frontend/backend integration work.

### Rule 4
The final demo is blocked by acceptance-test failures.

### Rule 5
Optional live data must never replace the deterministic judging path.

### Rule 6
A feature that introduces new data/provider dependencies must include its own fallback and provenance strategy.

---

## 6. Team parallelization

### Likhith

Primary stream:

```text
requirements
acceptance tests
demo scenarios
submission narrative
QA coordination
```

Early focus:

- W01
- W23-W26 planning and verification
- W29-W30

### Mayank

Primary stream:

```text
domain
recovery
simulator
constraints
AI
transport adapters
```

Early focus:

- W01
- W03-W08
- W18-W22

### Nithesh

Primary stream:

```text
API
integration
frontend/backend wiring
E2E
build/deployment
```

Early focus:

- W02
- W09
- W12-W14
- W17
- W22
- W26
- W28

### Keval

Primary stream:

```text
frontend
UX
visualization
accessibility
animation
```

Early focus:

- W10-W11
- W13
- W15
- W16-W18
- W27

---

## 7. Integration checkpoints

### Checkpoint A

Mayank + Nithesh:

```text
Domain data
  ↔
API contract
```

### Checkpoint B

Nithesh + Keval:

```text
API result
  ↔
UI state
```

### Checkpoint C

All four:

```text
Requirement
  ↔
Implementation
  ↔
Test
  ↔
Visible evidence
```

These checkpoints should happen at milestone boundaries, not only at the end.

---

## 8. Practical execution order

The team should execute in this order even when tasks are parallelized:

```text
1. Freeze golden scenario + contract
2. Build deterministic domain core
3. Build API boundary
4. Adapt rail frontend
5. Complete golden end-to-end flow
6. Add cancellation/infeasibility/error
7. Add AI + post-validation + fallback
8. Run adversarial and regression QA
9. Polish judge-facing UX
10. Freeze demo
11. Produce submission material
12. Keep final-day buffer
```

---

## 9. Scope-change gate

Any newly proposed feature must answer all six questions before work starts:

```text
1. Which requirement does it satisfy?
2. Does it improve judging value?
3. How much implementation time does it require?
4. Which existing task or milestone does it displace?
5. Who owns it?
6. What is its acceptance test?
```

If those questions cannot be answered, the feature does not enter the critical path.

---

## 10. Final execution gate

The implementation plan is considered successfully executed only when:

```text
P0 tasks pass
+ golden path passes
+ cancellation passes
+ infeasibility passes
+ technical-error path passes
+ AI boundary tests pass
+ regression tests pass
+ deployed demo passes
+ submission evidence is complete
```

At that point, the team stops adding features and moves into final submission rehearsal.
