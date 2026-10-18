# Configurable journey API contract

Sutra exposes a fixed catalogue of simulated journeys and supported disruption profiles. It does not provide live schedules, availability, routing, or booking.

## Catalogue

`GET /api/v1/trips` returns journeys grouped with only their selectable profiles. `GET /api/v1/trips/:tripId` remains available for the canonical full `Trip` model.

```json
{
  "journeys": [{
    "tripId": "trip-golden-rail-delay-01",
    "tripVersion": 1,
    "label": "Mangaluru Central to Mysuru Junction",
    "origin": "Mangaluru Central",
    "destination": "Mysuru Junction",
    "journeyDate": "2026-11-10",
    "currency": "INR",
    "defaultConstraints": { "latestArrivalAt": "2026-11-10T19:00:00", "maxExtraBudget": 500, "noOvernight": true },
    "items": [{ "id": "RAIL-A", "kind": "transport", "label": "Rail A", "origin": "Mangaluru Central", "destination": "Hassan Junction", "departureAt": "2026-11-10T09:00:00", "arrivalAt": "2026-11-10T13:00:00" }],
    "supportedDisruptions": [{ "id": "golden-rail-delay-01", "label": "Rail A delay", "bookingId": "RAIL-A", "bookingLabel": "Rail A", "kind": "delay", "delayRange": { "minimumMinutes": 30, "maximumMinutes": 180, "stepMinutes": 30 } }]
  }]
}
```

`id` in a supported disruption profile is the existing `disruption.scenarioId`. Technical-error and no-feasible demonstration fixtures are deliberately not catalogue options. No-feasible recovery is a calculated result, not a disruption type.

## Recovery runs

Submit `POST /api/v1/recovery-runs` with the selected `tripId`, `tripVersion`, and a profile-matching disruption:

```json
{
  "tripId": "trip-golden-rail-delay-01",
  "tripVersion": 1,
  "disruption": { "source": "SIMULATED", "scenarioId": "golden-rail-delay-01", "bookingId": "RAIL-A", "kind": "delay", "delayMinutes": 150 },
  "constraintOverrides": { "maxExtraBudget": 500, "noOvernight": true }
}
```

Configurable delay profiles accept only integer values from 30 through 180 minutes in 30-minute increments. Cancellation profiles must omit `delayMinutes`. The service verifies trip/version, profile ownership, booking, kind, and delay range before calculating impact and validating fixture-owned alternatives. Invalid profile combinations are rejected with `DOMAIN_REJECTED`; malformed requests use `INVALID_REQUEST`.

Successful HTTP responses have `RECOVERED` or `NO_FEASIBLE_RECOVERY`. `RECOVERED` includes a recommendation, recovery plan, traveller actions, candidates, effective constraints, and backend-authored `decisionAudit`. A recommendation may have source `AI` only after independent validation; otherwise it has `DETERMINISTIC_FALLBACK`. `NO_FEASIBLE_RECOVERY` has no recommendation or recovery plan and includes candidate violations/audit reasons. A HTTP 500 `TECHNICAL_ERROR` is separate from infeasibility and is retryable.

The second fixture is the simulated Mangaluru Central → Hassan Junction → Bengaluru City journey. Its connection feasibility is recalculated for the selected delay; it contains only transport dependencies. `WINDOW` downstream dependencies in the golden hotel fixture are currently retained but not independently evaluated by feasibility validation.
