/** The single Gemini model default used whenever optional AI is enabled. */
export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

export type GeminiConfigurationEnvironment = Record<string, string | undefined>;

/** Optional AI may use the default; AI-required mode must use an explicit value. */
export function configuredGeminiModel(environment: GeminiConfigurationEnvironment = process.env): string {
  return environment.SUTRA_GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export function hasConfiguredGeminiModel(environment: GeminiConfigurationEnvironment = process.env): boolean {
  return Boolean(environment.SUTRA_GEMINI_MODEL?.trim());
}
