# Sutra backend

The backend owns the recovery domain and exposes the API consumed by the frontend. The default configuration is a reproducible synthetic fixture: it requires no database, railway provider, or AI credentials and never presents fixture results as live schedules or ticket inventory.

## Offline demo

```powershell
Copy-Item .env.example .env
npm install
npm run db:migrate # optional; not needed for DATA_MODE=fixture
npm run dev
```

The fixture trip is `trip-golden-rail-delay-01`. With `AI_PROVIDER=none`, deterministic ranking selects RC-B. An OpenAI key is optional; when configured and the model selects the earlier feasible option, RC-A is selected. AI failures always fall back to deterministic ranking.

## Configuration modes

- `DATA_MODE=fixture`, `STORAGE_MODE=memory`: offline hackathon mode.
- `DATA_MODE=live`: requires `RAIL_PROVIDER_BASE_URL` and `RAIL_PROVIDER_API_KEY`; provider payload mapping remains isolated in `src/rail-provider.ts`.
- `STORAGE_MODE=postgres`: reserved for durable deployment and requires `DATABASE_URL`. The current HTTP runtime uses memory storage by default, so run history is lost on restart.
- Real signup/login requires `STORAGE_MODE=postgres`; run `npm run db:migrate` to create `users`, hashed-password, session, and optional run-ownership tables. Sessions are opaque hashed tokens in `HttpOnly`, `SameSite=Lax` cookies and are never placed in browser storage.
- `AI_PROVIDER=openai`: optional ranking enhancement; `OPENAI_API_KEY` and `OPENAI_MODEL` may be supplied.

## API

- `GET /health`
- `GET /v1/trips/:tripId`
- `GET /v1/trips/:tripId/disruptions`
- `POST /v1/recovery-runs`
- `GET /v1/recovery-runs/:runId`
- `GET /v1/recovery-runs/:runId/events` (SSE lifecycle events)
- `POST /v1/auth/signup`, `POST /v1/auth/login`, `GET /v1/auth/me`, `POST /v1/auth/logout`
- `GET /v1/me/recovery-runs` (authenticated)

Recovery status is one of `RECOVERED`, `NO_FEASIBLE_RECOVERY`, or `TECHNICAL_ERROR`. Synthetic candidates and constraints are independently validated by the backend.

The current domain model does not yet persist user-owned trips. The authenticated dashboard therefore confirms the account and links to the public synthetic recovery workspace without fabricating private journeys or history. Trip ownership must be added before exposing private live itineraries.
