# Sutra Team Execution Plan

## 1. Team

| Member | Primary role | Core ownership |
|---|---|---|
| Likhith | Product, QA, documentation, submission | requirements, traceability, acceptance, PPT, demo video, final product QA |
| Nithesh | Full-stack integration | API contract, frontend/backend integration, end-to-end flow, deployment |
| Mayank | Backend/recovery intelligence | domain model, recovery engine, simulator, constraints, AI adapter |
| Keval | Frontend/prototype adaptation | existing UI migration, workflow UX, journey visualization, accessibility/animation |

## 2. Ownership principles

### Likhith

Own the question:

> Are we still building what we promised the hackathon?

Responsibilities:

- product decisions;
- requirements traceability;
- acceptance scenarios;
- scope control;
- PPT;
- demo script/video;
- final product QA;
- submission readiness.

### Mayank

Own the question:

> Is the recovery result technically correct?

Responsibilities:

- domain model;
- dependency graph;
- impact analysis;
- candidate generation;
- hard-constraint validation;
- recovery ranking policy;
- AI provider abstraction;
- post-validation;
- deterministic simulator.

### Nithesh

Own the question:

> Does the entire system work from browser request to final result?

Responsibilities:

- API design with Mayank;
- API implementation;
- frontend API client;
- contract validation;
- integration;
- environment/deployment;
- E2E debugging.

### Keval

Own the question:

> Can the user and judge understand the recovery process immediately?

Responsibilities:

- reuse/adapt current Sutra frontend;
- rail-first data presentation;
- workflow state rendering;
- impact visualization;
- candidate comparison;
- repaired-journey presentation;
- responsive/accessibility/animation polish.

## 3. Shared contract rule

The API/data contract is a shared handshake between Mayank, Nithesh, and Keval, with Likhith validating that it supports the product requirements.

Do not allow independent backend/frontend contract invention.

## 4. Workstreams

```text
PRODUCT / QA
Likhith

BACKEND / RECOVERY
Mayank

FRONTEND / UX
Keval

INTEGRATION / FULL STACK
Nithesh
```

The workstreams remain synchronized through vertical-slice milestones.

## 5. Milestone 1 - Contract freeze

Goal:

```text
product
→ domain
→ API
```

Owners:

- Mayank + Nithesh: technical contract;
- Keval: frontend data needs;
- Likhith: product/requirements approval.

Exit condition:

Core entities, recovery request, recovery result, errors, and state semantics are agreed.

## 6. Milestone 2 - Deterministic vertical slice

Build only:

```text
rail delay
→ impact
→ candidates
→ hard constraints
→ deterministic recovery
→ UI result
```

No advanced AI or live APIs yet.

This is the first major integration checkpoint.

## 7. Milestone 3 - Cancellation + failure states

Add:

- cancellation;
- no feasible recovery;
- technical failure;
- deterministic retry behavior.

## 8. Milestone 4 - AI layer

Add:

```text
feasible candidates
→ AI ranking/explanation
→ post-validation
→ deterministic fallback
```

Do not put AI into the system before the deterministic core works.

## 9. Milestone 5 - Adversarial QA

Team intentionally tries to break:

- budget rules;
- arrival deadlines;
- overnight restrictions;
- connection logic;
- preservation;
- AI output;
- source failures;
- technical errors.

## 10. Milestone 6 - UX integration/polish

Keval integrates the final domain states into the existing prototype.

Nithesh ensures the UI is driven by real application results.

Likhith verifies every mandatory requirement is visibly demonstrable.

## 11. Milestone 7 - Demo freeze

Freeze the core scenarios.

Stop adding features unless a blocker is discovered.

The final demo should prioritize reliability and clarity over feature count.

## 12. Suggested schedule relative to submission

DevHack Round 1 submission closes **20 October 2026**.

Suggested internal sequence:

```text
T-14 to T-12
contract + domain freeze

T-12 to T-9
deterministic vertical slice

T-9 to T-7
cancellation + failure states

T-7 to T-5
AI layer + post-validation

T-5 to T-3
E2E/adversarial testing

T-3 to T-2
UX polish + demo freeze

T-2 to T-1
PPT + demo video + rehearsal

T-1
submission buffer
```

## 13. Definition of team done

A task is not finished because code exists.

It is finished when:

```text
implementation
+ review
+ integration
+ acceptance test
+ product check
```

## 14. Change-management rule

New features require explicit agreement on:

- requirement satisfied;
- value to judging;
- estimated effort;
- displaced work;
- owner;
- acceptance test.

## 15. Final sign-off

Recommended final sign-off:

```text
Mayank  → recovery correctness
Nithesh → integration correctness
Keval   → frontend/UX correctness
Likhith → product, QA, submission correctness
```

All four must be green before Round 1 submission is declared ready.
