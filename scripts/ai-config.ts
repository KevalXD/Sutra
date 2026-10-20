import { loadEnvConfig } from "@next/env";
import { configuredGeminiModel, hasConfiguredGeminiModel } from "@/lib/recovery/gemini-config";
import { selectRecommendationProvider } from "@/lib/recovery/provider-selection";

loadEnvConfig(process.cwd());

const aiRequired = process.env.SUTRA_AI_REQUIRED?.trim().toLowerCase() === "true";
const selection = selectRecommendationProvider();

console.log(JSON.stringify({
  provider: selection.provider ?? "none",
  model: selection.model ?? (aiRequired && !hasConfiguredGeminiModel() ? null : configuredGeminiModel()),
  aiRequired,
  geminiApiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
  openAiApiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
  diagnostic: selection.diagnostic ?? null,
}));
