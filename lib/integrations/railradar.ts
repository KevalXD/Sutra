import { isTrainNumber, LiveRailStatus, RailStatusError } from "./rail-status";

const LIVE_STATUS_URL = "https://api.railradar.in/v1/trains";
const TIMEOUT_MS = 8_000;

type FetchLike = typeof fetch;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function requiredText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 200 ? value.trim() : undefined;
}

function optionalText(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  return requiredText(value);
}

function validTimestamp(value: unknown): string | undefined {
  const text = requiredText(value);
  return text && !Number.isNaN(Date.parse(text)) ? text : undefined;
}

function parseLiveStatus(payload: unknown, requestedTrainNumber: string): LiveRailStatus {
  const envelope = asRecord(payload);
  const data = asRecord(envelope?.data);
  if (envelope?.success !== true || !data) throw new RailStatusError("RAIL_STATUS_INVALID_RESPONSE", "Live status could not be verified.", 502);

  const trainNumber = requiredText(data.trainNumber);
  const trainName = requiredText(data.trainName);
  const status = requiredText(data.status);
  const lastUpdatedAt = validTimestamp(data.lastUpdatedAt);
  const delayMinutes = data.delayMinutes === null || data.delayMinutes === undefined ? null : data.delayMinutes;
  const currentLocation = asRecord(data.currentLocation);
  const nextHalt = asRecord(data.nextHalt);
  const currentStationCode = optionalText(currentLocation?.stationCode);
  const nextStationName = optionalText(nextHalt?.stationName);
  const nextStationCode = optionalText(nextHalt?.stationCode);

  if (
    trainNumber !== requestedTrainNumber || !trainName || !status || !lastUpdatedAt || typeof data.isLive !== "boolean" ||
    (delayMinutes !== null && (typeof delayMinutes !== "number" || !Number.isInteger(delayMinutes))) ||
    currentStationCode === undefined || nextStationName === undefined || nextStationCode === undefined
  ) throw new RailStatusError("RAIL_STATUS_INVALID_RESPONSE", "Live status could not be verified.", 502);

  return { trainNumber, trainName, status, delayMinutes: delayMinutes as number | null, lastUpdatedAt, currentStationCode, nextStationName, nextStationCode, isLive: data.isLive, providerSource: "RailRadar" };
}

function publicProviderError(status: number): RailStatusError {
  if (status === 401) return new RailStatusError("RAIL_STATUS_UNAUTHORIZED", "Live status is unavailable because the provider could not authorize this request.", 503);
  if (status === 404) return new RailStatusError("RAIL_STATUS_NOT_FOUND", "No live status was found for this train.", 404);
  if (status === 429) return new RailStatusError("RAIL_STATUS_RATE_LIMITED", "Live status is temporarily unavailable because the provider quota has been reached.", 429);
  return new RailStatusError("RAIL_STATUS_UNAVAILABLE", "Live status is temporarily unavailable. Please try again later.", 503);
}

/** Server-only RailRadar adapter. It returns a deliberately small, validated public shape. */
export async function getRailRadarLiveStatus(trainNumber: string, fetchImpl: FetchLike = fetch): Promise<LiveRailStatus> {
  if (!isTrainNumber(trainNumber)) throw new RailStatusError("INVALID_TRAIN_NUMBER", "Enter a five-digit train number.", 400);
  const apiKey = process.env.RAILRADAR_API_KEY?.trim();
  if (!apiKey) throw new RailStatusError("RAIL_STATUS_NOT_CONFIGURED", "Live status is not configured on this server.", 503);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let response: Response;
    try {
      response = await fetchImpl(`${LIVE_STATUS_URL}/${encodeURIComponent(trainNumber)}/live`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        signal: controller.signal,
        next: { revalidate: 120 },
      });
    } catch {
      throw new RailStatusError("RAIL_STATUS_UNAVAILABLE", "Live status is temporarily unavailable. Please try again later.", 503);
    }
    if (!response.ok) throw publicProviderError(response.status);
    let payload: unknown;
    try { payload = await response.json(); }
    catch { throw new RailStatusError("RAIL_STATUS_INVALID_RESPONSE", "Live status could not be verified.", 502); }
    return parseLiveStatus(payload, trainNumber);
  } finally {
    clearTimeout(timeout);
  }
}
