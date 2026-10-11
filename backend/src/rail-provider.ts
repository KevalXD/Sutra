import { config } from "./config.js";
import type { LiveDisruption, LiveTrip } from "./types.js";
import type { Candidate } from "./types.js";

async function getJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.RAIL_PROVIDER_TIMEOUT_MS);
  try {
    const res = await fetch(new URL(path, config.RAIL_PROVIDER_BASE_URL), { headers: { authorization: `Bearer ${config.RAIL_PROVIDER_API_KEY}`, accept: "application/json" }, signal: controller.signal });
    if (!res.ok) throw new Error(`Rail provider returned HTTP ${res.status}`);
    return await res.json() as T;
  } finally { clearTimeout(timeout); }
}

export async function fetchLiveTrip(externalTripId: string): Promise<LiveTrip> {
  const path = config.RAIL_PROVIDER_TRIP_PATH.replace("{externalTripId}", encodeURIComponent(externalTripId));
  return getJson<LiveTrip>(path);
}

export async function fetchLiveDisruptions(externalTripId: string): Promise<LiveDisruption[]> {
  const path = config.RAIL_PROVIDER_DISRUPTIONS_PATH.replace("{externalTripId}", encodeURIComponent(externalTripId));
  return getJson<LiveDisruption[]>(path);
}

export async function fetchLiveCandidates(externalTripId: string, disruption: LiveDisruption): Promise<Candidate[]> {
  const path = config.RAIL_PROVIDER_CANDIDATES_PATH.replace("{externalTripId}", encodeURIComponent(externalTripId));
  const response = await getJson<{ candidates: Candidate[] }>(path);
  void disruption;
  return response.candidates.map(candidate => ({ ...candidate, feasible: false }));
}
