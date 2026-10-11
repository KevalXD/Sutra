# Sutra live backend

This service is the live boundary for Sutra. It does not contain demo trips, mock candidates, browser local storage, or an in-memory persistence fallback. A request fails closed when PostgreSQL or the configured rail provider is unavailable.

## Required setup

1. Copy `.env.example` to `.env` and provide `DATABASE_URL`, `RAIL_PROVIDER_BASE_URL`, and `RAIL_PROVIDER_API_KEY`.
2. Add the provider's external trip identifier to the `trips.external_trip_id` column.
3. Run `npm install`, `npm run db:migrate`, then `npm run dev`.

The frontend must set `NEXT_PUBLIC_API_BASE` to this service. The legacy Next.js `/api/*` routes are transitional and must not be enabled for a live deployment; set `ENABLE_DEMO_ROUTES=false`.

`OPENAI_API_KEY` is required when `AI_REQUIRED=true`. When it is false, the service labels deterministic selection as `DETERMINISTIC_FALLBACK`; it never labels fallback output as AI.

## API

- `GET /health` checks database connectivity and reports provider configuration state.
- `GET /v1/trips/:tripId` loads a persisted trip and refreshes it from the live rail adapter.
- `POST /v1/recovery-runs` accepts `{ tripId, tripVersion }`, polls the provider, validates constraints, optionally ranks feasible candidates with AI, persists the run, and returns the recovery result.
- `GET /v1/recovery-runs/:runId/events` streams persisted recovery-stage events using Server-Sent Events.

The provider-specific payload mapping is isolated in `src/rail-provider.ts`; the provider schema must be confirmed before production use.
