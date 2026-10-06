# Sutra Current Repository Gap Analysis

## 1. Repository baseline

The current GitHub repository already contains a substantial frontend prototype with:

- Next.js App Router;
- React/TypeScript;
- `components/sutra/` visual and workflow components;
- API route handlers;
- typed frontend data contracts;
- deterministic mock scenarios;
- a recovery flow hook;
- QA scripts and accessibility checks.

This is valuable existing work and should be adapted rather than discarded.

## 2. What the current prototype already demonstrates

The current implementation has reusable support for:

```text
trip overview
→ disruption display
→ impact chain
→ recovery analysis
→ result
```

It also contains separate handling for:

```text
no feasible recovery
technical error
```

and has already performed responsive, keyboard, reduced-motion, and accessibility checks according to the implementation notes in the repository.

## 3. Current domain mismatch

The current data contract and demo fixtures are still materially flight-oriented.

Examples include:

- `BookingKind` currently includes `flight`, `train`, `hotel`;
- demo fixtures use flight bookings and flight disruption scenarios;
- the README describes flight delay/cancellation scenarios.

This is now inconsistent with the frozen Round 1 decision of a rail-first MVP.

Do not fix this by simply replacing the word `flight` with `train` everywhere.

The data model should first be reconciled with the finalized domain semantics.

## 4. Current orchestration mismatch

The current frontend flow calls multiple endpoints in sequence:

```text
trip
→ disruption
→ alternatives
→ recovery
```

The target architecture is recovery-run oriented:

```text
user starts recovery
→ one authoritative Recovery Run
→ backend/application orchestrates internal stages
→ frontend renders resulting state
```

Existing endpoints can remain temporarily while the new boundary is introduced.

## 5. Current deterministic engine mismatch

The existing `lib/engine.ts` selects among mock candidates with a simple ordering rule.

The target recovery semantics need a clearer separation between:

- impact analysis;
- candidate generation;
- hard-constraint validation;
- ranking policy;
- AI ranking;
- post-validation;
- recovery-plan construction.

The current engine is therefore a starting point, not the final domain engine.

## 6. Current mock-data mismatch

The current `lib/mock.ts` mixes trip fixtures, disruptions, impact analysis, candidate definitions, and recovery behavior.

Target direction:

```text
fixtures
   ↓
adapters
   ↓
domain/application logic
```

Raw scenario data should not carry business-logic decisions that belong in the recovery core.

## 7. Current UX strengths to preserve

Preserve/adapt where compatible:

- connected journey visualization;
- disruption interrupting the journey in place;
- affected-booking highlighting;
- impact chain;
- recovery comparison;
- repaired-journey transition;
- explicit no-feasible state;
- explicit technical-error state;
- accessibility/reduced-motion patterns.

## 8. Current UX behavior to change

Current prototype uses explicit buttons to advance stages.

Target product behavior:

```text
User starts recovery once
→ system progresses through internal stages automatically
```

Demo controls may remain available separately.

## 9. Current API direction to change

Target:

```text
GET  /api/v1/trips/:tripId
POST /api/v1/recovery-runs
GET  /api/v1/recovery-runs/:runId
```

Optional:

```text
GET /api/v1/recovery-runs/:runId/events
```

The existing route handlers can be refactored behind this contract rather than discarded immediately.

## 10. Current scenario migration

Replace/retarget current fixtures toward:

```text
rail delay
rail cancellation
rail no-feasible recovery
technical failure
```

A destination incident remains a later enhancement unless the team explicitly promotes it.

## 11. Current QA migration

Keep the existing QA foundation.

Extend it with:

- rail-domain ground truth;
- hard constraint adversarial tests;
- preservation tests;
- AI output validation tests;
- fallback tests;
- data-integrity tests;
- mutation tests.

## 12. Migration rule

Do not rewrite the current UI before the target domain/API contract is stable.

Preferred order:

```text
domain contract
→ API contract
→ deterministic recovery core
→ integration
→ frontend migration
→ visual polish
```

## 13. Repository acceptance gate

We can call the migration complete when:

- no core Round 1 claim remains flight-centric;
- rail is the actual primary demo domain;
- frontend consumes the normalized recovery result;
- recovery correctness is not implemented inside React;
- old mock behavior is replaced by the new deterministic domain behavior;
- existing accessibility/responsive strengths remain intact.
