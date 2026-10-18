import { GoogleGenAI } from "@google/genai";
import type { ImpactAnalysis, Trip, ValidatedRecoveryCandidate } from "@/lib/domain/types";
import { AI_RECOMMENDATION_BUDGET_MS, RecommendationProviderError } from "./core";
import { recommendationContext, recommendationJsonSchema, type RecommendationDraft } from "./recommendation";

type GeminiResponse = { text?: string };
export interface GeminiClient { models: { generateContent(input: unknown): Promise<GeminiResponse> } }
export interface GeminiRecommendationProviderOptions { apiKey: string; model: string; timeoutMs?: number; fetchFn?: typeof fetch; client?: GeminiClient }

/** Leave a small margin for the recovery layer to fall back after the SDK aborts. */
export const GEMINI_REQUEST_TIMEOUT_MS = AI_RECOMMENDATION_BUDGET_MS - 500;

/** Server-only Gemini adapter. The model sees only the already-feasible candidate set. */
export class GeminiRecommendationProvider {
  private readonly client: GeminiClient;
  constructor(private readonly options: GeminiRecommendationProviderOptions) {
    this.client = options.client ?? new GoogleGenAI({
      apiKey: options.apiKey,
      httpOptions: {
        timeout: options.timeoutMs ?? GEMINI_REQUEST_TIMEOUT_MS,
        // The SDK defaults to five attempts and retries 5xx responses. Recovery has one
        // total budget instead, so a 503 must reach deterministic fallback immediately.
        retryOptions: { attempts: 1 },
        ...(options.fetchFn ? { fetch: options.fetchFn } : {}),
      },
    });
  }
  async recommend(input: { trip: Trip; impact: ImpactAnalysis; feasibleCandidates: ValidatedRecoveryCandidate[]; activePriority?: import("@/lib/domain/types").RecoveryPriority }): Promise<RecommendationDraft> {
    let response: GeminiResponse;
    try {
      response = await this.client.models.generateContent({ model: this.options.model, contents: `Choose only from the supplied feasible recovery candidates. If activePriority is supplied, select its deterministic best candidate. Return structured facts exactly as supplied. Do not claim booking, purchase, availability, or feasibility.\n${JSON.stringify(recommendationContext(input.trip, input.impact, input.feasibleCandidates, input.activePriority))}`, config: { responseMimeType: "application/json", responseJsonSchema: recommendationJsonSchema } });
    } catch (error) {
      const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : undefined;
      throw new RecommendationProviderError("PROVIDER_API_ERROR", "Gemini request failed.", status);
    }
    if (!response.text) throw new RecommendationProviderError("PROVIDER_RESPONSE_PARSE_ERROR", "Gemini returned no structured output.");
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(response.text) as Record<string, unknown>; }
    catch { throw new RecommendationProviderError("PROVIDER_RESPONSE_PARSE_ERROR", "Gemini returned malformed structured output."); }
    return { selectedCandidateId: parsed.selectedCandidateId as string, preference: parsed.preference as RecommendationDraft["preference"], ...(typeof parsed.comparedCandidateId === "string" ? { comparedCandidateId: parsed.comparedCandidateId } : {}), facts: parsed.facts as RecommendationDraft["facts"] };
  }
}

export const configuredGeminiRecommendationProvider = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  return apiKey ? new GeminiRecommendationProvider({ apiKey, model: process.env.SUTRA_GEMINI_MODEL || "gemini-3.8-flash" }) : undefined;
};
