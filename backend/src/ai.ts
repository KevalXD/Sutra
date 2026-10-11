import { config } from "./config.js";
import type { Candidate, DecisionSource } from "./types.js";

export async function rankCandidates(candidates: Candidate[], preferences: unknown): Promise<{ candidateId: string; reason: string; source: DecisionSource }> {
  if (!candidates.length) throw new Error("Cannot rank an empty candidate set");
  if (config.AI_PROVIDER !== "openai" || !config.OPENAI_API_KEY) {
    return { candidateId: [...candidates].sort((a, b) => a.extraCost - b.extraCost || a.finalArrivalAt.localeCompare(b.finalArrivalAt))[0].id, reason: "Selected by deterministic fallback over provider-verified feasible candidates.", source: "DETERMINISTIC_FALLBACK" };
  }
  const prompt = { candidates: candidates.map(c => ({ id: c.id, extraCost: c.extraCost, finalArrivalAt: c.finalArrivalAt, payload: c.payload })), preferences };
  const res = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { authorization: `Bearer ${config.OPENAI_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ model: config.OPENAI_MODEL, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: "Select one candidate ID only from the supplied feasible candidates. Return JSON {candidateId,reason}. Do not invent facts." }, { role: "user", content: JSON.stringify(prompt) }] }) });
  if (!res.ok) throw new Error(`AI provider returned HTTP ${res.status}`);
  const body = await res.json() as { choices?: { message?: { content?: string } }[] };
  const value = JSON.parse(body.choices?.[0]?.message?.content ?? "{}");
  const selected = candidates.find(c => c.id === value.candidateId);
  if (!selected) throw new Error("AI selected a candidate outside the verified feasible set");
  return { candidateId: selected.id, reason: String(value.reason ?? "AI selected a verified feasible candidate."), source: "AI" };
}
