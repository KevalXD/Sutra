import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATA_MODE: z.enum(["fixture", "live"]).default("fixture"),
  STORAGE_MODE: z.enum(["memory", "postgres"]).default("memory"),
  DATABASE_URL: z.string().optional(),
  DATABASE_SSL: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  RAIL_PROVIDER_BASE_URL: z.string().url().optional(),
  RAIL_PROVIDER_API_KEY: z.string().optional(),
  RAIL_PROVIDER_TRIP_PATH: z.string().default("/trips/{externalTripId}"),
  RAIL_PROVIDER_DISRUPTIONS_PATH: z
    .string()
    .default("/trips/{externalTripId}/disruptions"),
  RAIL_PROVIDER_CANDIDATES_PATH: z
    .string()
    .default("/trips/{externalTripId}/candidates"),
  RAIL_PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  AI_PROVIDER: z.enum(["openai", "none"]).default("none"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  FRONTEND_ORIGIN: z.string().default("http://localhost:3000"),
  FIXTURE_TRIP_ID: z.string().default("trip-golden-rail-delay-01"),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(24 * 7),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
});

export const config = schema.parse(process.env);
if (
  config.DATA_MODE === "live" &&
  (!config.RAIL_PROVIDER_BASE_URL || !config.RAIL_PROVIDER_API_KEY)
)
  throw new Error("Live mode requires rail provider credentials");
if (config.STORAGE_MODE === "postgres" && !config.DATABASE_URL)
  throw new Error("Postgres storage requires DATABASE_URL");
