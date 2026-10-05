// Client for Sutra's /api/* boundary. Set NEXT_PUBLIC_API_BASE to point at a real backend later.
import type { ApiError, DisruptionAnalysis, Itinerary, RecoveryCandidate, RecoveryResult, ScenarioId } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";
export class SutraApiError extends Error { constructor(public error: ApiError) { super(error.message) } }

async function call<T>(path: string, fallback: ApiError, init?: RequestInit): Promise<T> {
  let res: Response;
  try { res = await fetch(`${BASE}${path}`, init); } catch { throw new SutraApiError(fallback); }
  if (!res.ok) { const b = await res.json().catch(() => null); throw new SutraApiError(b?.error ?? fallback); }
  return res.json();
}
const post = (scenario: ScenarioId) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenario }) });

export const getTrip = (s: ScenarioId, attempt: number) =>
  call<Itinerary>(`/api/trip?scenario=${s}&attempt=${attempt}`, { code: "ITINERARY_LOAD_FAILED", message: "We couldn't load this journey." });
export const postDisruption = (s: ScenarioId) =>
  call<DisruptionAnalysis>("/api/disruption", { code: "INVALID_DISRUPTION", message: "Disruption could not be analysed." }, post(s));
export const getAlternatives = async (s: ScenarioId) =>
  (await call<{ alternatives: RecoveryCandidate[] }>(`/api/alternatives?scenario=${s}`, { code: "ALTERNATIVES_LOAD_FAILED", message: "Alternatives could not be loaded." })).alternatives;
export const postRecovery = (s: ScenarioId) =>
  call<{ result: RecoveryResult; selectedId?: string }>("/api/recovery", { code: "RECOVERY_SERVICE_UNAVAILABLE", message: "Recovery could not be calculated." }, post(s));
