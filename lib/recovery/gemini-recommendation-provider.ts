import { ApiError, GoogleGenAI } from "@google/genai";
import type { ImpactAnalysis, Trip, ValidatedRecoveryCandidate } from "@/lib/domain/types";
import { AI_RECOMMENDATION_BUDGET_MS, RecommendationProviderError } from "./core";
import { configuredGeminiModel } from "./gemini-config";
import { recommendationContext, recommendationJsonSchema, type RecommendationDraft } from "./recommendation";

type GeminiResponse = { text?: string };
export interface GeminiClient { models: { generateContent(input: unknown): Promise<GeminiResponse> } }
export interface GeminiRecommendationProviderOptions { apiKey: string; model: string; timeoutMs?: number; fetchFn?: typeof fetch; client?: GeminiClient }

type SafeGeminiErrorName = "ApiError" | "APIConnectionError" | "ConnectionError" | "RequestTimeoutError" | "TypeError" | "Unknown";

/**
 * The installed @google/genai 2.28.0 SDK documents ApiError.status. Its
 * connection errors expose no HTTP status, so retain only a whitelisted class
 * name. Do not propagate raw messages: SDK API messages can include response
 * bodies and connection causes can include host details.
 */
function classifyGeminiError(error: unknown): RecommendationProviderError {
  if (error instanceof ApiError) {
    const status = error.status;
    const category = status === 401 || status === 403 ? "PROVIDER_AUTHENTICATION_ERROR"
      : status === 404 ? "PROVIDER_MODEL_UNAVAILABLE"
        : status === 429 ? "PROVIDER_QUOTA_ERROR"
          : "PROVIDER_API_ERROR";
    return new RecommendationProviderError(category, "Gemini API request failed.", status, "ApiError");
  }
  const name = error instanceof Error ? error.name : "Unknown";
  const safeName: SafeGeminiErrorName = name === "APIConnectionError" || name === "ConnectionError" || name === "RequestTimeoutError" || name === "TypeError" ? name : "Unknown";
  if (safeName === "RequestTimeoutError") return new RecommendationProviderError("PROVIDER_TIMEOUT", "Gemini request timed out.", undefined, safeName);
  if (safeName === "APIConnectionError" || safeName === "ConnectionError" || safeName === "TypeError") return new RecommendationProviderError("PROVIDER_NETWORK_ERROR", "Gemini connection failed.", undefined, safeName);
  return new RecommendationProviderError("PROVIDER_API_ERROR", "Gemini request failed.", undefined, safeName);
}

/** Leave a small margin for the recovery layer to fall back after the SDK aborts. */
export const GEMINI_REQUEST_TIMEOUT_MS = AI_RECOMMENDATION_BUDGET_MS - 500;
const GEMINI_MAX_RETRY_DELAY_MS = 250;
const GEMINI_RETRY_BASE_DELAY_MS = 100;
const GEMINI_ATTEMPT_TIMEOUT_MS = Math.floor((GEMINI_REQUEST_TIMEOUT_MS - GEMINI_MAX_RETRY_DELAY_MS) / 2);
const GEMINI_MAX_ATTEMPTS = 2;

function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new RecommendationProviderError("PROVIDER_TIMEOUT", "Gemini retry was cancelled by the recovery deadline."));
  }
  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, delayMs);
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(new RecommendationProviderError("PROVIDER_TIMEOUT", "Gemini retry was cancelled by the recovery deadline."));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}

/** Server-only Gemini adapter. The model sees only the already-feasible candidate set. */
export class GeminiRecommendationProvider {
  private readonly client: GeminiClient;
  constructor(private readonly options: GeminiRecommendationProviderOptions) {
    this.client = options.client ?? new GoogleGenAI({
      apiKey: options.apiKey,
      httpOptions: {
        timeout: Math.min(options.timeoutMs ?? GEMINI_ATTEMPT_TIMEOUT_MS, GEMINI_ATTEMPT_TIMEOUT_MS),
        retryOptions: { attempts: 1 },
        ...(options.fetchFn ? { fetch: options.fetchFn } : {}),
      },
    });
  }
  async recommend(input: { trip: Trip; impact: ImpactAnalysis; feasibleCandidates: ValidatedRecoveryCandidate[]; activePriority?: import("@/lib/domain/types").RecoveryPriority; signal?: AbortSignal }): Promise<RecommendationDraft> {
    const request = {
      model: this.options.model,
      contents: `Choose only from the supplied feasible recovery candidates. If activePriority is supplied, select its deterministic best candidate. Return structured facts exactly as supplied. Do not claim booking, purchase, availability, or feasibility.\n${JSON.stringify(recommendationContext(input.trip, input.impact, input.feasibleCandidates, input.activePriority))}`,
      config: {
        thinkingConfig: { thinkingLevel: "LOW" },
        responseMimeType: "application/json",
        responseJsonSchema: recommendationJsonSchema,
        ...(input.signal ? { abortSignal: input.signal } : {}),
      },
    };
    let response: GeminiResponse | undefined;
    for (let attempt = 0; attempt < GEMINI_MAX_ATTEMPTS; attempt += 1) {
      try {
        response = await this.client.models.generateContent(request);
        break;
      } catch (error) {
        if (attempt === 0 && error instanceof ApiError && error.status === 503 && !input.signal?.aborted) {
          const exponentialDelay = Math.min(GEMINI_RETRY_BASE_DELAY_MS * 2 ** attempt, GEMINI_MAX_RETRY_DELAY_MS);
          const jitteredDelay = Math.floor(Math.random() * (exponentialDelay + 1));
          await waitForRetry(jitteredDelay, input.signal);
          continue;
        }
        throw classifyGeminiError(error);
      }
    }
    if (!response) throw new RecommendationProviderError("PROVIDER_API_ERROR", "Gemini request completed without a response.");
    if (!response.text) throw new RecommendationProviderError("PROVIDER_RESPONSE_PARSE_ERROR", "Gemini returned no structured output.");
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(response.text) as Record<string, unknown>; }
    catch { throw new RecommendationProviderError("PROVIDER_RESPONSE_PARSE_ERROR", "Gemini returned malformed structured output."); }
    return { selectedCandidateId: parsed.selectedCandidateId as string, preference: parsed.preference as RecommendationDraft["preference"], ...(typeof parsed.comparedCandidateId === "string" ? { comparedCandidateId: parsed.comparedCandidateId } : {}), facts: parsed.facts as RecommendationDraft["facts"] };
  }
}

export const configuredGeminiRecommendationProvider = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  return apiKey ? new GeminiRecommendationProvider({ apiKey, model: configuredGeminiModel() }) : undefined;
};
