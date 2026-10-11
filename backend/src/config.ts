import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  DATABASE_SSL: z.enum(["true", "false"]).default("true").transform(v => v === "true"),
  RAIL_PROVIDER_BASE_URL: z.string().url(),
  RAIL_PROVIDER_API_KEY: z.string().min(1),
  RAIL_PROVIDER_TRIP_PATH: z.string().min(1),
  RAIL_PROVIDER_DISRUPTIONS_PATH: z.string().min(1),
  RAIL_PROVIDER_CANDIDATES_PATH: z.string().min(1),
  RAIL_PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  AI_PROVIDER: z.enum(["openai", "none"]).default("none"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  AI_REQUIRED: z.enum(["true", "false"]).default("false").transform(v => v === "true"),
  FRONTEND_ORIGIN: z.string().url(),
  LOG_LEVEL: z.string().default("info"),
});

export const config = schema.parse(process.env);
if (config.AI_PROVIDER === "openai" && config.AI_REQUIRED && !config.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is required when AI_PROVIDER=openai and AI_REQUIRED=true");
}
