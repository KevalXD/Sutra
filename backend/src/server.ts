import http from "node:http";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { dbHealth, pool, closeDb } from "./db.js";
import { fetchLiveCandidates, fetchLiveDisruptions, fetchLiveTrip } from "./rail-provider.js";
import { runRecovery } from "./recovery.js";
import type { LiveTrip } from "./types.js";

function json(res: http.ServerResponse, status: number, body: unknown) { res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": config.FRONTEND_ORIGIN }); res.end(JSON.stringify(body)); }
async function body(req: http.IncomingMessage) { let raw = ""; for await (const chunk of req) raw += chunk; return JSON.parse(raw || "{}"); }
async function persistedTrip(id: string): Promise<{ trip: LiveTrip; dbId: string; externalId: string }> { const q = await pool.query("SELECT id, external_trip_id, version, currency, payload FROM trips WHERE id = $1", [id]); if (!q.rowCount) throw Object.assign(new Error("Trip not found"), { status: 404 }); const r = q.rows[0]; const live = await fetchLiveTrip(r.external_trip_id); return { trip: { ...live, id: id, externalTripId: r.external_trip_id, version: r.version, currency: r.currency }, dbId: r.id, externalId: r.external_trip_id }; }
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": config.FRONTEND_ORIGIN, "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type" }); return res.end(); }
    if (req.method === "GET" && url.pathname === "/health") { await dbHealth(); return json(res, 200, { status: "ok", database: "connected", railProvider: "configured", aiProvider: config.AI_PROVIDER }); }
    const tripMatch = url.pathname.match(/^\/v1\/trips\/([^/]+)$/);
    if (req.method === "GET" && tripMatch) { const result = await persistedTrip(tripMatch[1]); return json(res, 200, result.trip); }
    const disruptionsMatch = url.pathname.match(/^\/v1\/trips\/([^/]+)\/disruptions$/);
    if (req.method === "GET" && disruptionsMatch) { const result = await persistedTrip(disruptionsMatch[1]); const disruptions = await fetchLiveDisruptions(result.externalId); const disruption = disruptions[0]; if (!disruption) return json(res, 200, { disruption: null, affectedBookingIds: [], impact: [] }); return json(res, 200, { disruption: { bookingId: disruption.bookingId, kind: disruption.kind === "cancellation" ? "cancel" : "delay", delayMin: disruption.delayMinutes }, affectedBookingIds: disruption.affectedItemIds ?? [], impact: disruption.reasons ?? [] }); }
    if (req.method === "POST" && url.pathname === "/v1/recovery-runs") {
      const input = await body(req); if (!input.tripId || input.tripVersion === undefined) return json(res, 400, { error: "tripId and tripVersion are required" });
      const runId = randomUUID(); const { trip, dbId, externalId } = await persistedTrip(input.tripId); if (trip.version !== input.tripVersion) return json(res, 409, { error: "stale trip version" });
      await pool.query("INSERT INTO recovery_runs(id, trip_id, trip_version, status, request) VALUES($1,$2,$3,$4,$5)", [runId, dbId, trip.version, "RUNNING", input]);
      const events = async (stage: string, payload: unknown) => pool.query("INSERT INTO recovery_events(run_id, stage, payload) VALUES($1,$2,$3)", [runId, stage, payload]);
      await events("TRIP_REFRESHED", { externalTripId: externalId }); const disruptions = await fetchLiveDisruptions(externalId); const disruption = disruptions[0]; if (!disruption) throw new Error("No live disruption is available for this trip"); await events("DISRUPTION_CONFIRMED", disruption);
      const candidates = await fetchLiveCandidates(externalId, disruption); await events("RECOVERY_OPTIONS_REFRESHED", { count: candidates.length }); const result = await runRecovery(runId, trip, disruption, candidates); await pool.query("UPDATE recovery_runs SET status=$1,result=$2,completed_at=now() WHERE id=$3", [result.status, result, runId]); await events("RECOVERY_COMPLETED", result); return json(res, 200, result);
    }
    const eventMatch = url.pathname.match(/^\/v1\/recovery-runs\/([^/]+)\/events$/);
    if (req.method === "GET" && eventMatch) { res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive", "access-control-allow-origin": config.FRONTEND_ORIGIN }); const q = await pool.query("SELECT stage,payload,created_at FROM recovery_events WHERE run_id=$1 ORDER BY id", [eventMatch[1]]); for (const event of q.rows) res.write(`event: ${event.stage}\ndata: ${JSON.stringify(event.payload)}\n\n`); return res.end(); }
    return json(res, 404, { error: "not found" });
  } catch (error) { const status = (error as { status?: number }).status ?? 500; return json(res, status, { error: status === 500 ? "technical error" : (error as Error).message }); }
});
server.listen(config.PORT, () => console.log(`Sutra backend listening on ${config.PORT}`));
process.on("SIGTERM", async () => { server.close(); await closeDb(); process.exit(0); });
