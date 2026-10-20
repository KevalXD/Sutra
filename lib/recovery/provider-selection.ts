import type { RecommendationProvider } from "./core";
import { configuredGeminiRecommendationProvider } from "./gemini-recommendation-provider";
import { configuredOpenAiRecommendationProvider } from "./openai-recommendation-provider";

export type AiProviderMode = "auto" | "gemini" | "openai";
export interface ProviderSelection { recommender?: RecommendationProvider; provider?: Exclude<AiProviderMode, "auto">; model?: string; diagnostic?: string; aiRequired?: boolean }
export interface ProviderFactories { gemini: () => RecommendationProvider | undefined; openai: () => RecommendationProvider | undefined }
export type ProviderEnvironment = Record<string, string | undefined>;

const defaults: ProviderFactories = { gemini: configuredGeminiRecommendationProvider, openai: configuredOpenAiRecommendationProvider };
/** Selects one provider; required mode only accepts Gemini and never uses fallback. */
export function selectRecommendationProvider(environment: ProviderEnvironment = process.env, factories: ProviderFactories = defaults): ProviderSelection {
  const aiRequired = environment.SUTRA_AI_REQUIRED?.trim().toLowerCase() === "true";
  const requested = environment.SUTRA_AI_PROVIDER;
  const mode: AiProviderMode | undefined = requested === undefined || requested === "auto" ? "auto" : requested === "gemini" || requested === "openai" ? requested : undefined;
  if (aiRequired) {
    if (mode === "openai") return { aiRequired, diagnostic: "SUTRA_AI_REQUIRED requires Gemini, but SUTRA_AI_PROVIDER selects OpenAI." };
    if (!mode) return { aiRequired, diagnostic: "Unsupported SUTRA_AI_PROVIDER. AI-required mode needs Gemini." };
    if (!environment.GEMINI_API_KEY) return { aiRequired, diagnostic: "AI-required mode needs GEMINI_API_KEY." };
    let recommender: RecommendationProvider | undefined;
    try {
      recommender = factories.gemini();
    } catch {
      return { aiRequired, diagnostic: "AI-required mode could not initialize Gemini." };
    }
    return recommender
      ? { aiRequired, recommender, provider: "gemini", model: environment.SUTRA_GEMINI_MODEL || "gemini-3.8-flash" }
      : { aiRequired, diagnostic: "AI-required mode could not initialize Gemini." };
  }
  if (!mode) return { diagnostic: "Unsupported SUTRA_AI_PROVIDER. Use auto, gemini, or openai; deterministic fallback remains active." };
  if (mode === "gemini") { const recommender = environment.GEMINI_API_KEY ? factories.gemini() : undefined; return recommender ? { recommender, provider: "gemini", model: environment.SUTRA_GEMINI_MODEL || "gemini-3.8-flash" } : { diagnostic: "Gemini was selected but GEMINI_API_KEY is missing or Gemini could not be initialized; deterministic fallback remains active." }; }
  if (mode === "openai") return environment.OPENAI_API_KEY ? { recommender: factories.openai(), provider: "openai", model: environment.SUTRA_OPENAI_MODEL || "gpt-4o-mini" } : { diagnostic: "OpenAI was selected but OPENAI_API_KEY is missing; deterministic fallback remains active." };
  if (environment.GEMINI_API_KEY) { const recommender = factories.gemini(); return recommender ? { recommender, provider: "gemini", model: environment.SUTRA_GEMINI_MODEL || "gemini-3.8-flash" } : { diagnostic: "Gemini credentials are configured but Gemini could not be initialized; deterministic fallback remains active." }; }
  if (environment.OPENAI_API_KEY) return { recommender: factories.openai(), provider: "openai", model: environment.SUTRA_OPENAI_MODEL || "gpt-4o-mini" };
  return { diagnostic: "No AI provider credentials are available; deterministic fallback remains active." };
}
