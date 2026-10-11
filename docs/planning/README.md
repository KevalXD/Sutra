# Sutra Planning

The Sutra DevHack 2026 Round 1 product and engineering plan has completed its final red-team review and is now **FROZEN**. Implementation, integration, QA, demo rehearsal, and submission work proceed from this baseline.

## Source of truth hierarchy

1. DevHack 2026 rulebook - authoritative for competition requirements.
2. `docs/planning/` - authoritative for Sutra Round 1 product and engineering decisions.
3. `docs/planning/12_FINAL_FREEZE.md` - final implementation contract for the frozen domain, API, AI boundary, terminology, and golden scenario.
4. Existing `docs/spec/` material - current prototype implementation baseline, subject to the frozen planning decisions.

## Round 1 product statement

> **Sutra is an AI travel-disruption recovery agent with a rail-first MVP. It takes an existing traveller itinerary, determines downstream consequences of a transport disruption, evaluates feasible recovery options against explicit traveller constraints, and produces an actionable recovery plan.**

Rail is the first implemented transport mode for Round 1. The domain model and architecture remain transport-mode agnostic so future modes can be added later without rewriting the recovery engine.

## Planning status

| Area | Status |
|---|---|
| Hackathon alignment | FROZEN |
| Transport mode | FROZEN: rail-first |
| Product contract | FROZEN |
| Domain model | FROZEN |
| Recovery semantics | FROZEN |
| API boundary | FROZEN |
| AI boundary | FROZEN |
| Golden scenario | FROZEN |
| System architecture | FROZEN |
| Data/source strategy | FROZEN |
| UX/state machine | FROZEN |
| Requirements/acceptance | FROZEN |
| Team ownership | FROZEN |
| Implementation breakdown | FROZEN baseline |
| Red-team review | COMPLETE |
| Plan | **FROZEN** |

## Documents

- `00_MASTER_PLAN.md` - overview of the full plan and development sequence.
- `01_DECISIONS.md` - key decisions and final freeze decisions.
- `02_PRODUCT_CONTRACT.md` - user, problem, workflow, outcome, and Round 1 boundaries.
- `03_DOMAIN_AND_RECOVERY.md` - domain entities and deterministic recovery semantics.
- `04_SYSTEM_ARCHITECTURE.md` - target architecture and API/data flow.
- `05_DATA_SOURCE_STRATEGY.md` - simulator, datasets, provenance, and future source adapters.
- `06_UX_STATE_MACHINE.md` - user-visible workflow and application state model.
- `07_REQUIREMENTS_AND_ACCEPTANCE.md` - traceability, acceptance criteria, and test plan.
- `08_IMPLEMENTATION_WORK_BREAKDOWN.md` - execution map with owners, dependencies, acceptance tests, and milestones.
- `09_TEAM_EXECUTION_PLAN.md` - team roles, ownership, milestones, and implementation order.
- `10_ROUND1_DEMO_AND_SUBMISSION.md` - judge-facing demo story and submission plan.
- `11_CURRENT_REPO_GAP_ANALYSIS.md` - current implementation gaps.
- `12_FINAL_FREEZE.md` - **final frozen implementation contract**.

## Post-freeze change control

Do not reopen product planning during normal implementation.

A new product decision is allowed only when it fixes a blocker or failed acceptance test. It must have an owner, acceptance test, and explicit team agreement.

Feature ideas that do not meet that threshold go to post-MVP.
