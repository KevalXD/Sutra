# Sutra Planning

This directory contains the planning baseline for Sutra's DevHack 2026 Round 1 implementation.

The purpose of these documents is to freeze product, domain, architecture, data, UX, testing, team ownership, and demo decisions before implementation begins.

## Source of truth hierarchy

1. `Hackathon_devhack_2026.pdf` - external competition rules and PS 4.1 requirements.
2. The decisions in this directory - the team's agreed interpretation and implementation scope for Round 1.
3. The existing repository and its current `docs/spec/` material - implementation baseline and reusable work, subject to the decisions above.

The hackathon rulebook is authoritative for eligibility and submission requirements. The planning documents are authoritative for Sutra's implementation choices unless the team explicitly records a new decision.

## Round 1 product statement

> **Sutra is an AI travel-disruption recovery agent with a rail-first MVP. It takes an existing traveller itinerary, determines downstream consequences of a transport disruption, evaluates feasible recovery options against explicit traveller constraints, and produces an actionable recovery plan.**

Rail is the first implemented transport mode for Round 1. The domain model and architecture remain transport-mode agnostic so air and bus can be added later without rewriting the recovery engine.

## Current planning status

| Area | Status |
|---|---|
| Hackathon alignment | Frozen |
| Transport mode | Frozen: rail-first |
| Product contract | Frozen |
| Domain model | Frozen baseline |
| Recovery semantics | Frozen baseline |
| AI boundary | Frozen baseline |
| System architecture | Frozen baseline |
| Data/source strategy | Frozen baseline |
| UX/state machine | Frozen baseline |
| Requirements/acceptance | Frozen baseline |
| Team ownership | Frozen baseline |
| Detailed implementation | Drafted: execution-ready baseline |
| Final red-team review | Pending before implementation freeze |

## Documents

- `00_MASTER_PLAN.md` - single overview of the full plan and development sequence.
- `01_DECISIONS.md` - key decisions and rationale, including transport mode.
- `02_PRODUCT_CONTRACT.md` - exact user, problem, workflow, outcome, and Round 1 boundaries.
- `03_DOMAIN_AND_RECOVERY.md` - domain entities and deterministic recovery semantics.
- `04_SYSTEM_ARCHITECTURE.md` - target architecture and API/data flow.
- `05_DATA_SOURCE_STRATEGY.md` - simulator, datasets, provenance, and future source adapters.
- `06_UX_STATE_MACHINE.md` - user-visible workflow and application state model.
- `07_REQUIREMENTS_AND_ACCEPTANCE.md` - traceability, acceptance criteria, and test plan.
- `08_IMPLEMENTATION_WORK_BREAKDOWN.md` - epic/task-level execution map with owners, dependencies, acceptance tests, and milestones.
- `09_TEAM_EXECUTION_PLAN.md` - team roles, ownership, milestones, and implementation order.
- `10_ROUND1_DEMO_AND_SUBMISSION.md` - judge-facing demo story and submission plan.
- `11_CURRENT_REPO_GAP_ANALYSIS.md` - what the current GitHub prototype already provides and what must change.

## Change control

Do not silently change the product scope or recovery semantics during implementation. Material changes should be added to `01_DECISIONS.md` with a reason, impact, and explicit approval from the team.

Minor implementation choices may be made without a new decision record when they do not change product behavior, architecture boundaries, or hackathon claims.
