# Sutra System Architecture - Round 1

## 1. Architecture objective

Provide a small, reliable, testable recovery system that can later evolve into a multi-modal platform without coupling the core domain to transport providers, AI vendors, or the React frontend.

## 2. Target architecture

```text
                         ┌───────────────────────┐
                         │      SUTRA UI         │
                         │     Next.js/React     │
                         └───────────┬───────────┘
                                     │
                              Versioned API
                                     │
                         ┌───────────▼───────────┐
                         │   Thin API / BFF      │
                         └───────────┬───────────┘
                                     │
                         ┌───────────▼───────────┐
                         │ Recovery Orchestrator  │
                         └───────────┬───────────┘
                                     │
            ┌────────────────────────┼─────────────────────────┐
            │                        │                         │
            ▼                        ▼                         ▼
      Trip Repository         Incident Provider       Transport Adapter
            │                        │                         │
            └────────────────────────┼─────────────────────────┘
                                     ▼
                              Impact Analyzer
                                     ▼
                             Candidate Generator
                                     ▼
                           Hard Constraint Validator
                                     │
                                feasible set
                                     ▼
                              AI Decision Layer
                                     ▼
                              AI Post-validator
                                     │
                         ┌───────────┴───────────┐
                         │                       │
                    accepted                 rejected
                         │                       │
                         │              deterministic fallback
                         │                       │
                         └───────────┬───────────┘
                                     ▼
                              Recovery Plan Builder
                                     ▼
                               Action Generator
                                     ▼
                              Structured Run Result
                                     ▼
                                   UI
```

## 3. Deployment decision

Round 1 should use a modular monolith.

The preferred shape is:

```text
Next.js application
├── frontend
├── route handlers
├── application layer
├── domain layer
└── adapters/infrastructure
```

Do not introduce microservices without a demonstrated need.

## 4. Layer responsibilities

### Presentation

Renders the recovery workflow. It does not determine truth.

### API

Validates HTTP input, authenticates later, serializes output, and maps errors.

### Application

Owns the Recovery Run orchestration sequence.

### Domain

Owns itinerary semantics, dependencies, impact, feasibility, ranking policy, and recovery-plan construction.

### Infrastructure/adapters

Owns fixtures, source integrations, AI provider access, and later persistence.

## 5. Main API

The preferred public contract is recovery-run oriented:

```text
GET  /api/v1/trips/:tripId
POST /api/v1/recovery-runs
GET  /api/v1/recovery-runs/:runId
```

Optional future progress endpoint:

```text
GET /api/v1/recovery-runs/:runId/events
```

The current repository's `/api/trip`, `/api/disruption`, `/api/alternatives`, and `/api/recovery` handlers can remain as transitional internals while the new contract is introduced.

## 6. Recovery request

Conceptually:

```text
POST /api/v1/recovery-runs

{
  "tripId": "trip-demo-001",
  "tripVersion": 1,
  "disruption": {
    "bookingId": "R1",
    "kind": "delay",
    "delayMin": 90,
    "source": "SIMULATED"
  }
}
```

The exact IDs and fixture values are implementation data.

## 7. Recovery processing flow

```text
1. Validate request.
2. Load trip snapshot.
3. Resolve/validate disruption.
4. Apply temporary disrupted state.
5. Run impact analysis.
6. Ask transport adapter for alternatives.
7. Construct recovery candidates.
8. Validate hard constraints.
9. If zero candidates are feasible, return NO_FEASIBLE_RECOVERY.
10. Give feasible candidates to AI.
11. Validate AI recommendation.
12. Use deterministic fallback if needed.
13. Build repaired itinerary.
14. Create action list.
15. Return complete RecoveryRunResult.
```

## 8. HTTP semantics

Recommended meanings:

```text
200  recovery completed
200  no feasible recovery
400  invalid request
404  trip/booking not found
409  stale trip version / incompatible state
422  domain input rejected
500/502/503  technical failure
```

`NO_FEASIBLE_RECOVERY` is an application result, not an HTTP error.

## 9. AI boundary

The AI adapter is server-side.

Input:

- relevant trip facts;
- traveller soft preferences;
- affected subgraph summary;
- feasible candidate summaries;
- system policy.

Output:

- recommended candidate ID;
- concise reason;
- trade-off summary.

The post-validator checks the output before acceptance.

## 10. Deterministic fallback

If AI is unavailable or returns invalid output, use deterministic ranking over feasible candidates:

```text
fewest changes
→ lower extra cost
→ earlier arrival
→ stable candidate ID tie-breaker
```

This fallback must never select an infeasible candidate.

## 11. Transport adapters

```text
TransportAdapter
├── RailAdapter       ← Round 1
├── AirAdapter        ← future
└── BusAdapter        ← future
```

Transport-specific code must not leak into the domain layer.

## 12. Incident adapters

```text
IncidentSource
├── SimulationSource  ← Round 1
├── GTFS-RT source    ← future
├── Provider source   ← future
└── User report       ← future
```

All sources normalize into the Sutra disruption model.

## 13. Schedule vs availability

Keep distinct concepts:

```text
TransportService
    = a scheduled/known service

RecoveryOffer
    = a candidate represented by Sutra for recovery

BookableInventory
    = provider-confirmed transaction availability
```

Round 1 stops at `RecoveryOffer`.

## 14. State ownership

Backend/domain owns:

- original itinerary;
- disruption truth;
- impact truth;
- candidate validity;
- final recommendation;
- repaired itinerary.

Frontend owns:

- presentation state;
- scroll/focus state;
- animation;
- local interaction state;
- visual scenario selection in demo mode.

## 15. Security boundary

The browser must never receive:

- AI provider credentials;
- transport provider credentials;
- private prompts;
- raw server secrets.

Provider integrations remain server-side.

## 16. Why not microservices?

Round 1 does not need distributed deployment. The problem is one coherent recovery workflow with small data volume.

The architecture must be modular, not distributed for appearance.

## 17. Architecture acceptance gate

The architecture is ready when:

- the recovery core can execute without React;
- the transport source can be swapped for a fake adapter in tests;
- the AI provider can be replaced without domain changes;
- simulation can be replaced by another incident source;
- frontend rendering depends only on normalized contracts;
- final feasibility remains deterministic.
