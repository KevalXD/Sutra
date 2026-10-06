# Sutra Data and Source Strategy - Round 1

## 1. Goal

Provide realistic, reproducible, provenance-aware travel data without making the MVP dependent on unstable external services.

## 2. Source hierarchy

```text
Tier 0  Sutra deterministic fixtures
        ↓ authoritative for Round 1 demo

Tier 1  Public static transport data
        ↓ reference / snapshot input

Tier 2  Public real-time feeds
        ↓ optional live enrichment

Tier 3  Commercial/provider APIs
        ↓ future

Tier 4  User-reported / other sources
        ↓ future
```

## 3. Tier 0: deterministic Sutra fixtures

The guaranteed demo dataset contains:

- station/location records required by the scenarios;
- rail services;
- transport timings;
- hotel data required by the scenarios;
- traveller constraints;
- disruption scenarios;
- alternative recovery offers;
- expected ground-truth outcomes.

Fixtures are intentionally designed, not randomly generated.

## 4. Scenario ground truth

Every scenario should have an expected outcome.

Conceptually:

```text
scenario
  → expected disrupted booking
  → expected affected items
  → expected feasible candidates
  → expected selected candidate or infeasibility
```

This makes the same dataset serve both demo and testing.

## 5. Recommended Round 1 scenario set

Start with roughly 8–12 deterministic scenarios, including:

- delay with one feasible recovery;
- delay with multiple feasible recoveries;
- delay with no feasible recovery;
- cancellation with feasible replacement;
- cancellation with no feasible replacement;
- downstream booking affected but still valid;
- budget blocks an otherwise attractive option;
- arrival deadline blocks the cheapest option;
- overnight restriction blocks an option;
- technical source/service failure.

The first scenario is the golden path. The others are robustness evidence.

## 6. Source provenance

Every external or generated data snapshot should be traceable with:

- source type;
- provider/feed name;
- retrieval timestamp where applicable;
- dataset/feed version where available;
- license/provenance information;
- transformations applied.

For simulated events, record:

```text
source = SIMULATED
scenarioId = <fixture id>
```

## 7. GTFS role

GTFS Schedule is useful for representing real transit schedule structure such as stops, routes, trips, and stop times.

It can be used to make fixtures more realistic or to create snapshots.

It is not treated as automatic proof of ticket inventory, provider-confirmed bookability, or successful rebooking.

## 8. GTFS-Realtime role

GTFS-Realtime is a future live-source adapter for trip updates, cancellations, and service alerts.

Round 1 does not depend on it.

If used later, the feed is normalized into the same canonical disruption model used by the simulator.

## 9. Indian rail data caution

Any unofficial/community Indian rail dataset must retain its actual provenance and must not be described as an official railway data source unless that is demonstrably true.

Public transport datasets are sources for reference/enrichment, not a blanket guarantee of provider authority.

## 10. Geography

Round 1 stores required station/location coordinates locally with the fixtures.

Runtime geocoding is not part of the core recovery path.

Future map/geocoding services may enrich presentation but must not become required for recovery correctness.

## 11. Cost data

Round 1 recovery costs are deterministic fixture values.

AI never estimates or invents prices.

## 12. Availability data

Round 1 uses simulated recovery offers.

The UI must not claim:

- real seat availability;
- booking confirmation;
- transaction completion.

Those require an actual transactional provider integration.

## 13. Snapshot strategy

When external sources are introduced, normalize and freeze them into versioned snapshots before feeding them to the deterministic recovery engine.

Conceptually:

```text
source
  → fetch
  → validate
  → normalize
  → snapshot
  → Sutra canonical data
```

## 14. Data failure policy

A malformed or unavailable source must result in an explicit adapter/application failure.

Do not substitute invented data silently.

Where possible, fall back to a deterministic snapshot or fixture.

## 15. AI context policy

The AI receives only the verified data relevant to a decision:

```text
trip summary
+ traveller preferences
+ affected items
+ feasible candidates
+ verified trade-offs
```

Do not send entire raw feeds or unrelated source payloads to the model.

## 16. Data integrity rules

Reject or quarantine data when:

- arrival precedes departure;
- cost is invalid;
- references point to unknown bookings/services;
- mandatory fields are missing;
- contradictory status transitions occur.

## 17. Data acceptance gate

The strategy is complete when:

- the golden-path scenario is fully deterministic;
- every candidate has enough information for feasibility checks;
- scenario ground truth exists;
- simulation/live provenance is distinguishable;
- source failure cannot silently create false facts;
- public data is never presented as stronger evidence than it actually is.
