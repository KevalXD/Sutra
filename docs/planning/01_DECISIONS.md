# Sutra Decision Log

## Decision status conventions

- **FROZEN** - do not change without explicit team agreement.
- **BASELINE** - strong planning decision; may be refined during implementation if evidence requires it.
- **DEFERRED** - intentionally not decided because it is outside Round 1 scope.

## D-001: Hackathon problem statement

**Status:** FROZEN

Sutra targets DevHack 2026 **PS 4.1 - AI Agent for Travel Disruption Recovery**.

Reason: the rulebook explicitly asks for disruption detection/simulation, affected-booking identification, constrained alternative search, and recovery itinerary generation.

## D-002: Round 1 transport mode

**Status:** FROZEN

Round 1 uses **rail as the primary implemented transport mode**.

Reason:

- directly aligned with the train examples in PS 4.1;
- supports meaningful disruption and downstream connection reasoning;
- easy to model deterministically;
- strong local relevance for a Karnataka travel demo;
- manageable within the hackathon time budget;
- supports extension to air and bus later.

Air and bus remain future modes. Water is excluded from Round 1.

## D-003: Product identity

**Status:** FROZEN

Sutra is an itinerary-recovery agent, not a general travel planner or booking marketplace.

## D-004: Agent interaction model

**Status:** FROZEN

The user starts one recovery operation. System stages progress automatically after recovery starts.

Reason: this better represents an agent and avoids turning internal processing stages into manual user tasks.

## D-005: Deterministic core

**Status:** FROZEN

Hard facts and feasibility remain deterministic.

Reason: travel recovery contains arithmetic and consistency rules that should not depend on LLM variability.

## D-006: AI role

**Status:** FROZEN

AI ranks/explains only feasible candidates and may interpret soft preferences. AI does not determine hard feasibility.

## D-007: AI post-validation

**Status:** FROZEN

Every AI recommendation is validated before becoming the final recovery recommendation.

If AI output is invalid or unavailable, the system uses a deterministic fallback when possible.

## D-008: Round 1 data source

**Status:** FROZEN

The guaranteed judging path uses deterministic Sutra-owned fixtures and simulated disruptions.

Public GTFS/GTFS-Realtime data may enrich the project but may not be a single point of failure for the demo.

## D-009: Availability semantics

**Status:** FROZEN

A schedule entry is not the same as booking availability.

Round 1 candidate data may represent an **offered simulated recovery option**, but the UI must not claim provider-confirmed seat inventory or transaction success unless a real provider integration proves it.

## D-010: No real transactions in Round 1

**Status:** FROZEN

The MVP proposes traveller actions. It does not purchase tickets, cancel bookings, issue refunds, or send external communications.

## D-011: Original itinerary preservation

**Status:** FROZEN

The original itinerary remains available as the baseline. Recovery produces a separate repaired state.

## D-012: Affected vs cancelled

**Status:** FROZEN

Affected, disrupted, changed, cancelled, and unchanged are distinct states. A downstream booking becoming affected does not imply it was cancelled.

## D-013: No-feasible-recovery semantics

**Status:** FROZEN

`NO_FEASIBLE_RECOVERY` means the defined recovery search space was evaluated and no candidate satisfies all mandatory constraints.

Timeouts, provider failures, malformed data, and other technical problems must not be converted into this state.

## D-014: Round 1 deployment shape

**Status:** BASELINE

Use a modular Next.js application with thin API handlers and a separate conceptual domain/application layer. Do not split into microservices unless implementation evidence makes it necessary.

## D-015: Database

**Status:** DEFERRED

No database is required for the core Round 1 MVP. Deterministic fixtures and in-memory run state are sufficient.

## D-016: Graph storage

**Status:** DEFERRED

Use an in-memory itinerary dependency graph. Do not introduce a graph database for Round 1.

## D-017: Live progress events

**Status:** BASELINE

The target architecture supports real recovery-stage events, but the initial implementation may render deterministic progress locally if the backend is synchronous. The final UI must not claim a real backend event occurred when it did not.

## D-018: External schedule data

**Status:** BASELINE

GTFS can be used as a reference or snapshot input. GTFS-Realtime can be a future disruption source. Neither is required for the guaranteed Round 1 judging flow.

## D-019: Scope-change rule

Any new feature must answer all four questions before implementation:

1. Which product requirement does it satisfy?
2. Which hackathon judging criterion does it improve?
3. What does it cost in time/complexity?
4. What existing must-have work might it displace?

If the feature cannot win that trade-off, it waits.
