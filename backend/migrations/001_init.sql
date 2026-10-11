CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_trip_id TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL DEFAULT 1,
  currency TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recovery_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id),
  trip_version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('RUNNING','RECOVERED','NO_FEASIBLE_RECOVERY','TECHNICAL_ERROR')),
  request JSONB NOT NULL,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS recovery_events (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES recovery_runs(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recovery_events_run_id_id_idx ON recovery_events(run_id, id);
