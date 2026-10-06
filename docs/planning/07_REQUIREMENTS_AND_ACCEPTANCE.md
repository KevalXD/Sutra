# Sutra Requirements Traceability and Acceptance Testing

## 1. Purpose

Every important product claim must map to:

```text
requirement
→ implementation behavior
→ UI evidence
→ test
→ demo evidence
```

## 2. Hackathon requirement matrix

| ID | DevHack PS 4.1 requirement | Sutra implementation | Acceptance condition | Judge-visible evidence |
|---|---|---|---|---|
| H-01 | Detect or simulate disruption | Deterministic rail incident simulator | Supported rail incident changes trip state | Disrupted rail leg visibly changes |
| H-02 | Identify affected bookings | Dependency-based impact analyzer | Expected affected set equals actual affected set | Downstream affected items shown |
| H-03 | Evaluate alternatives | Rail alternative generator | Multiple recovery candidates evaluated | Candidate comparison |
| H-04 | Use traveller constraints | Deterministic hard-constraint validator | Any hard-violating candidate is infeasible | Pass/fail constraint indicators |
| H-05 | AI-driven recovery | AI ranking/explanation over feasible set | AI recommendation references a valid candidate | Recommendation + concise reason |
| H-06 | Recovery itinerary | Recovery plan builder | Final plan is internally consistent and feasible | Repaired journey |
| H-07 | Proposed traveller actions | Action generator | Required actions shown where applicable | Action checklist |
| H-08 | One problem statement | PS 4.1 throughout product and submission | No unrelated primary problem claim | Consistent PPT/GitHub/demo story |

The external rulebook requires the Round 1 PPT to include the problem statement, solution summary, technical approach, impact, business impact, market potential/scalability, GitHub MVP, and demo video. The rulebook also states that the MVP demo video carries extra weight.

## 3. Product acceptance matrix

| ID | Requirement | Pass condition |
|---|---|---|
| P-01 | Existing itinerary | Trip is visible before disruption |
| P-02 | Explicit constraints | Core hard constraints are shown before recovery |
| P-03 | Direct disruption | Correct booking receives disrupted state |
| P-04 | Immediate impact | Direct effect matches scenario ground truth |
| P-05 | Downstream propagation | All expected downstream effects are found |
| P-06 | Affected vs cancelled | Downstream affected booking is not falsely labelled cancelled |
| P-07 | Candidate recovery | Each candidate is structurally valid |
| P-08 | Hard feasibility | Invalid candidates cannot be selected |
| P-09 | Grounded AI | Recommendation is based on verified candidate facts |
| P-10 | Post-validation | Invalid AI output is rejected |
| P-11 | Preservation | Unaffected/valid bookings remain unchanged where possible |
| P-12 | Recovery result | Final result contains repaired itinerary and status |
| P-13 | Infeasibility | No valid candidate produces no-feasible state |
| P-14 | Technical failure | Provider/system failure produces technical-error state |
| P-15 | Actions | Traveller actions are shown as proposals, not fake executions |

## 4. Golden-path E2E test

### Test ID

`E2E-R1-RAIL-DELAY-RECOVERY`

### Given

- a valid deterministic multi-leg rail itinerary;
- explicit traveller hard constraints;
- a known simulated rail delay;
- a recovery candidate set with at least one feasible candidate.

### When

Traveller starts recovery.

### Then

1. The disruption is identified.
2. The correct booking is marked disrupted.
3. Immediate and downstream impacts are calculated.
4. Affected bookings match ground truth.
5. Multiple alternatives are evaluated.
6. Hard constraints are checked.
7. Invalid candidates are rejected.
8. AI recommends a valid candidate or deterministic fallback does.
9. Recommendation is independently validated.
10. A repaired itinerary is produced.
11. All hard constraints pass.
12. Changes/cost are accurate.
13. Traveller actions are present.
14. Final state is `RECOVERY_READY`.

## 5. Cancellation test

`E2E-R2-RAIL-CANCELLATION-RECOVERY`

Expected complete flow:

```text
cancelled rail service
→ downstream impact
→ replacement candidates
→ constraint validation
→ repaired itinerary or correct infeasibility
```

## 6. No-feasible test

`E2E-R3-NO-FEASIBLE-RECOVERY`

Design the scenario so that alternatives fail for different reasons, such as:

- deadline;
- budget;
- overnight restriction.

Expected:

```text
selectedCandidate = none
status = NO_FEASIBLE_RECOVERY
```

## 7. Technical-error test

`E2E-R4-TECHNICAL-FAILURE`

Inject a transport/service/API failure.

Expected:

```text
status = TECHNICAL_ERROR
```

No feasibility conclusion is allowed from the failure alone.

## 8. Preservation test

`E2E-R5-MINIMAL-CHANGE`

Create two feasible candidates:

- candidate A changes only the disrupted rail booking;
- candidate B changes the rail booking and an otherwise valid downstream booking.

Expected:

Candidate A ranks higher because it preserves more of the original trip.

## 9. Constraint adversarial tests

At minimum:

```text
Budget over limit      → infeasible
Arrival after deadline → infeasible
Overnight when banned  → infeasible
Invalid connection     → infeasible
```

## 10. AI adversarial tests

```text
AI selects unknown candidate     → reject
AI selects infeasible candidate  → reject
AI invents cost in explanation   → reject/regenerate
AI returns malformed structure   → reject
AI times out                     → deterministic fallback
No feasible candidates            → AI not asked to invent recovery
```

## 11. Data-integrity tests

Reject:

- unknown booking references;
- invalid timing;
- invalid cost;
- inconsistent status transitions;
- incomplete required fields.

## 12. Mutation tests

Take the same deterministic scenario and change one important value at a time:

- budget;
- arrival deadline;
- delay duration;
- candidate arrival;
- candidate cost.

The output should change logically instead of replaying a canned result.

## 13. Determinism test

Run every deterministic scenario repeatedly.

Expected:

```text
same input
→ same deterministic feasibility result
→ same fallback result
```

AI text may vary, but the final system must never produce a hard-constraint violation.

## 14. UX acceptance

A reviewer can identify the trip, disruption, impact, recovery, and final action without source-code knowledge.

Keyboard operation and reduced-motion behavior remain functional.

## 15. Definition of done

Round 1 is not done until:

```text
PS 4.1 requirements pass
+ golden path passes
+ cancellation passes
+ no-feasible passes
+ technical-error passes
+ AI adversarial cases pass
+ deterministic tests pass
+ UI evidence exists for each mandatory requirement
+ build/type/lint pass
+ accessibility baseline passes
```
