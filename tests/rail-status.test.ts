import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getRailRadarLiveStatus } from "@/lib/integrations/railradar";
import { RailStatusError } from "@/lib/integrations/rail-status";
import { GET } from "@/app/api/v1/rail-status/route";
import { LiveRailStatusContent } from "@/components/sutra/live-rail-status";

const originalKey = process.env.RAILRADAR_API_KEY;
const validPayload = {
  success: true,
  data: {
    trainNumber: "12919", trainName: "Malwa SF Express", status: "running", delayMinutes: 12,
    lastUpdatedAt: "2026-06-22T07:14:00+05:30", currentLocation: { stationCode: "UJN" },
    nextHalt: { stationName: "Maksi", stationCode: "MKSM" }, isLive: true,
  },
};

function mockResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

test.after(() => {
  if (originalKey === undefined) delete process.env.RAILRADAR_API_KEY;
  else process.env.RAILRADAR_API_KEY = originalKey;
});

test("RailRadar adapter validates and normalizes only the public live-status fields", async () => {
  process.env.RAILRADAR_API_KEY = "test-key";
  let request: RequestInit | undefined;
  const status = await getRailRadarLiveStatus("12919", async (_url, init) => { request = init; return mockResponse({ ...validPayload, internalSecret: "never return" }); });
  assert.deepEqual(status, { trainNumber: "12919", trainName: "Malwa SF Express", status: "running", delayMinutes: 12, lastUpdatedAt: "2026-06-22T07:14:00+05:30", currentStationCode: "UJN", nextStationName: "Maksi", nextStationCode: "MKSM", isLive: true, providerSource: "RailRadar" });
  assert.equal((request?.headers as Record<string, string>).Authorization, "Bearer test-key");
  assert.deepEqual(request?.next, { revalidate: 120 });
});

test("RailRadar adapter rejects invalid numbers, missing config, and malformed provider payloads", async () => {
  process.env.RAILRADAR_API_KEY = "test-key";
  await assert.rejects(() => getRailRadarLiveStatus("1291", async () => mockResponse(validPayload)), (error: unknown) => error instanceof RailStatusError && error.code === "INVALID_TRAIN_NUMBER");
  delete process.env.RAILRADAR_API_KEY;
  await assert.rejects(() => getRailRadarLiveStatus("12919", async () => mockResponse(validPayload)), (error: unknown) => error instanceof RailStatusError && error.code === "RAIL_STATUS_NOT_CONFIGURED");
  process.env.RAILRADAR_API_KEY = "test-key";
  await assert.rejects(() => getRailRadarLiveStatus("12919", async () => mockResponse({ success: true, data: { ...validPayload.data, isLive: "yes" } })), (error: unknown) => error instanceof RailStatusError && error.code === "RAIL_STATUS_INVALID_RESPONSE");
});

test("RailRadar adapter turns provider 401, 429, 503 and timeouts into safe errors", async () => {
  process.env.RAILRADAR_API_KEY = "test-key";
  for (const [providerStatus, expected] of [[401, "RAIL_STATUS_UNAUTHORIZED"], [429, "RAIL_STATUS_RATE_LIMITED"], [503, "RAIL_STATUS_UNAVAILABLE"]] as const) {
    await assert.rejects(() => getRailRadarLiveStatus("12919", async () => mockResponse({}, providerStatus)), (error: unknown) => error instanceof RailStatusError && error.code === expected);
  }
  await assert.rejects(() => getRailRadarLiveStatus("12919", async () => { throw new DOMException("timed out", "AbortError"); }), (error: unknown) => error instanceof RailStatusError && error.code === "RAIL_STATUS_UNAVAILABLE");
});

test("rail-status API validates input and returns normalized status without browser caching", async () => {
  process.env.RAILRADAR_API_KEY = "test-key";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => mockResponse(validPayload)) as typeof fetch;
  try {
    const invalid = await GET(new Request("http://sutra.local/api/v1/rail-status?trainNumber=abc"));
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error.code, "INVALID_TRAIN_NUMBER");
    const response = await GET(new Request("http://sutra.local/api/v1/rail-status?trainNumber=12919"));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store, max-age=0");
    const body = await response.json();
    assert.equal(body.trainName, "Malwa SF Express");
    assert.equal("data" in body, false);
  } finally { globalThis.fetch = originalFetch; }
});

test("live status UI has loading, successful and unavailable states without availability or booking claims", async () => {
  const loading = renderToStaticMarkup(createElement(LiveRailStatusContent, { state: "loading" }));
  assert.match(loading, /Checking RailRadar/);
  const successful = renderToStaticMarkup(createElement(LiveRailStatusContent, { state: "success", status: { trainNumber: "12919", trainName: "Malwa SF Express", status: "running", delayMinutes: 12, lastUpdatedAt: "2026-06-22T07:14:00+05:30", currentStationCode: "UJN", nextStationName: "Maksi", nextStationCode: "MKSM", isLive: true, providerSource: "RailRadar" } }));
  assert.match(successful, /Live status reported by RailRadar/);
  assert.match(successful, /12 minutes/);
  const unavailable = renderToStaticMarkup(createElement(LiveRailStatusContent, { state: "error", error: "Live status is unavailable." }));
  assert.match(unavailable, /unavailable/);
  const component = await readFile(new URL("../components/sutra/live-rail-status.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(component, /useEffect|setInterval|setTimeout\(/);
  assert.match(component, /no ticket availability or booking is confirmed/);
});
