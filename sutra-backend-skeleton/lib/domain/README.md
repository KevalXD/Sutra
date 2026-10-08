# Sutra domain core

Pure TypeScript. No React, no Next.js, no HTTP. Contract source: `docs/planning/12_FINAL_FREEZE.md`.

```
Disruption ─▶ ImpactAnalysis ─▶ RecoveryCandidate[] ─▶ ValidatedCandidate[] ─▶ RecoveryRecommendation ─▶ RecoveryPlan + actions
            impact.ts          candidates.ts           validation.ts           ranking.ts (+AI in M4)     plan.ts
```

| Layer | Path | Role |
|---|---|---|
| Domain | `lib/domain/*` | types, stages, validation, ranking policy, ports (interfaces) |
| Application | `lib/application/run-recovery.ts` | sequences the stages for one Recovery Run |
| Adapters | `lib/adapters/*` | simulated rail catalogue, in-memory trip repo (swappable) |
| API | `lib/api/http.ts`, `app/api/v1/*` | HTTP mapping only |

Endpoints: `GET /api/v1/trips/:tripId`, `POST /api/v1/recovery-runs`. Runs are stateless in Round 1, so
`GET /recovery-runs/:runId` is not implemented. Legacy `/api/trip|disruption|alternatives|recovery` are untouched.

Rules enforced in code: only `validation.ts` decides feasibility; AI receives feasible candidates only and its answer is
post-validated; technical failures never become `NO_FEASIBLE_RECOVERY`; the baseline `Trip` is never mutated.

## Deltas from the freeze document (need sign-off from Nithesh/Likhith)
1. `ConstraintKind.LATEST_ARRIVAL` renamed to `ARRIVAL_DEADLINE` (freeze wording; fixture updated).
2. `Alternative.departureAt` is required (freeze says so; the fixture lacked it). Golden departures were added so the
   connection and overnight checks are real: RC-A 15:30, RC-B 16:00, RC-C 17:00, RC-D 21:00, RC-E 15:30. Arrivals/costs unchanged.
3. `ViolationKind` adds `"WINDOW"`.
4. Freeze `RecoveryCandidate` (with `feasible`/`violations`) is `ValidatedCandidate`; `RecoveryCandidate` is the unvalidated proposal.
5. Golden trip id is `trip-golden-rail-delay-01`; the freeze example uses `trip-demo-rail-001`.

## Open questions
- A disruption that breaks no dependency has no defined outcome in the freeze; it currently returns 422 `DOMAIN_REJECTED`.
- `LOCATION` dependencies are not evaluated; they raise a technical failure rather than silently passing.

## Not built yet (by design)
Cancellation/infeasible/error scenarios in the simulator (M3), AI adapter and "explanation must not contradict facts" check (M4).

Tests: `npm test`.
