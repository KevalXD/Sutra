import type { ImpactAnalysis, Trip, ValidatedRecoveryCandidate } from "@/lib/domain/types";
import { recommendationContext, recommendationJsonSchema, type RecommendationDraft } from "./recommendation";

type FetchLike = typeof fetch;
export interface OpenAiRecommendationProviderOptions { apiKey: string; model: string; timeoutMs?: number; fetchFn?: FetchLike }

const outputText = (value: unknown): string | undefined => {
  const response = value as { output_text?: unknown; output?: { content?: { type?: string; text?: unknown }[] }[] };
  if (typeof response.output_text === "string") return response.output_text;
  return response.output?.flatMap((item) => item.content ?? []).find((content) => content.type === "output_text" && typeof content.text === "string")?.text as string | undefined;
};

/** Server-only adapter for the existing provider port. It sends no infeasible candidates or credentials to clients. */
export class OpenAiRecommendationProvider {
  private readonly fetchFn: FetchLike;
  constructor(private readonly options: OpenAiRecommendationProviderOptions) { this.fetchFn = options.fetchFn ?? fetch; }
  async recommend(input: { trip: Trip; impact: ImpactAnalysis; feasibleCandidates: ValidatedRecoveryCandidate[]; activePriority?: import("@/lib/domain/types").RecoveryPriority }): Promise<RecommendationDraft> {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 8_000);
    try {
      const response = await this.fetchFn("https://api.openai.com/v1/responses", {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.options.apiKey}` },
        body: JSON.stringify({ model: this.options.model, input: [{ role: "system", content: "Choose only from the supplied feasible recovery candidates. If activePriority is supplied, select its deterministic best candidate. Return structured facts exactly as supplied. Do not claim booking, purchase, availability, or feasibility." }, { role: "user", content: JSON.stringify(recommendationContext(input.trip, input.impact, input.feasibleCandidates, input.activePriority)) }], text: { format: { type: "json_schema", name: "recovery_recommendation", strict: true, schema: recommendationJsonSchema } } }),
      });
      if (!response.ok) throw new Error(`OpenAI request failed with HTTP ${response.status}.`);
      const text = outputText(await response.json());
      if (!text) throw new Error("OpenAI returned no structured output.");
      const parsed = JSON.parse(text) as Record<string, unknown>;
      return { selectedCandidateId: parsed.selectedCandidateId as string, preference: parsed.preference as RecommendationDraft["preference"], ...(typeof parsed.comparedCandidateId === "string" ? { comparedCandidateId: parsed.comparedCandidateId } : {}), facts: parsed.facts as RecommendationDraft["facts"] };
    } finally { clearTimeout(timeout); }
  }
}

export const configuredOpenAiRecommendationProvider = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey ? new OpenAiRecommendationProvider({ apiKey, model: process.env.SUTRA_OPENAI_MODEL || "gpt-4o-mini" }) : undefined;
};
