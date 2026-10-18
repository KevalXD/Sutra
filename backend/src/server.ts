import http from "node:http";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { analyzeImpact, runRecovery } from "./domain.js";
import { provider } from "./rail-provider.js";
import type { Disruption, StoredRun } from "./types.js";
import { AuthError, createAccount, login, logout, sessionUser, type AuthUser } from "./auth.js";

type Event = { stage: string; payload: unknown; createdAt: string };
const runs = new Map<string, StoredRun>();
const keys = new Map<string, string>();
const events = new Map<string, Event[]>();
const authAttempts = new Map<string, { started: number; count: number }>();

function send(res: http.ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": config.FRONTEND_ORIGIN, "access-control-allow-credentials": "true", "cache-control": "no-store" });
  res.end(JSON.stringify(data));
}
async function read(req: http.IncomingMessage) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try { return JSON.parse(raw || "{}"); } catch { throw Object.assign(new Error("Invalid JSON"), { status: 400 }); }
}
function record(runId: string, stage: string, payload: unknown) {
  const list = events.get(runId) ?? [];
  list.push({ stage, payload, createdAt: new Date().toISOString() });
  events.set(runId, list);
}
function notFound(message: string): never { throw Object.assign(new Error(message), { status: 404 }); }
function cookies(req: http.IncomingMessage) { return Object.fromEntries((req.headers.cookie ?? "").split(";").filter(Boolean).map(value => { const [key, ...rest] = value.trim().split("="); return [key, rest.join("=")]; })); }
function setSessionCookie(res: http.ServerResponse, token: string) { res.setHeader("set-cookie", `sutra_session=${token}; HttpOnly; Path=/; Max-Age=${Math.floor(config.SESSION_TTL_HOURS * 3600)}; SameSite=Lax${config.COOKIE_SECURE ? "; Secure" : ""}`); }
function clearSessionCookie(res: http.ServerResponse) { res.setHeader("set-cookie", "sutra_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax"); }
async function currentUser(req: http.IncomingMessage): Promise<AuthUser | null> { const token = cookies(req).sutra_session; return token ? sessionUser(token) : null; }
function checkAuthRateLimit(req: http.IncomingMessage) { const key = req.socket.remoteAddress ?? "unknown"; const now = Date.now(); const prior = authAttempts.get(key); if (!prior || now - prior.started >= config.AUTH_RATE_LIMIT_WINDOW_MS) { authAttempts.set(key, { started: now, count: 1 }); return; } if (prior.count >= config.AUTH_RATE_LIMIT_MAX) throw new AuthError("AUTH_RATE_LIMITED", "Too many authentication attempts. Try again shortly.", 429); prior.count += 1; }
function requiredUser(user: AuthUser | null): AuthUser { if (!user) throw new AuthError("UNAUTHENTICATED", "Sign in is required.", 401); return user; }

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": config.FRONTEND_ORIGIN, "access-control-allow-credentials": "true", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type,idempotency-key" }); return res.end(); }
    if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { status: "ok", dataMode: config.DATA_MODE, storageMode: config.STORAGE_MODE, aiProvider: config.AI_PROVIDER });
    if (req.method === "POST" && url.pathname === "/v1/auth/signup") { checkAuthRateLimit(req); const input = await read(req) as { fullName?: string; email?: string; password?: string }; if (!input.fullName || !input.email || !input.password || input.fullName.trim().length < 2 || input.password.length < 8) return send(res, 400, { error: { code: "INVALID_INPUT", message: "Name, valid email, and a password of at least 8 characters are required." } }); const result = await createAccount(input.fullName, input.email, input.password); setSessionCookie(res, result.token); return send(res, 201, { user: result.user }); }
    if (req.method === "POST" && url.pathname === "/v1/auth/login") { checkAuthRateLimit(req); const input = await read(req) as { email?: string; password?: string }; if (!input.email || !input.password) return send(res, 400, { error: { code: "INVALID_INPUT", message: "Email and password are required." } }); const result = await login(input.email, input.password); setSessionCookie(res, result.token); return send(res, 200, { user: result.user }); }
    if (req.method === "GET" && url.pathname === "/v1/auth/me") { const user = await currentUser(req); if (!user) return send(res, 401, { error: { code: "UNAUTHENTICATED", message: "Sign in is required." } }); return send(res, 200, { user }); }
    if (req.method === "POST" && url.pathname === "/v1/auth/logout") { const token = cookies(req).sutra_session; if (token) await logout(token); clearSessionCookie(res); return send(res, 204, null); }
    if (req.method === "GET" && url.pathname === "/v1/me/recovery-runs") { const user = requiredUser(await currentUser(req)); return send(res, 200, { runs: [...runs.values()].filter(run => run.userId === user.id).map(run => run.result ?? run) }); }
    const tripMatch = url.pathname.match(/^\/v1\/trips\/([^/]+)$/);
    if (req.method === "GET" && tripMatch) return send(res, 200, await provider.getTrip(tripMatch[1]));
    const disruptionMatch = url.pathname.match(/^\/v1\/trips\/([^/]+)\/disruptions$/);
    if (req.method === "GET" && disruptionMatch) {
      const trip = await provider.getTrip(disruptionMatch[1]);
      const disruption = await provider.getDisruption(trip);
      const impact = analyzeImpact(trip, disruption);
      return send(res, 200, { disruption: { bookingId: disruption.bookingId, kind: disruption.kind === "cancellation" ? "cancel" : "delay", delayMin: disruption.delayMinutes }, affectedBookingIds: [...impact.disruptedItemIds, ...impact.affectedItemIds], impact: impact.reasons });
    }
    if (req.method === "POST" && url.pathname === "/v1/recovery-runs") {
      const input = await read(req) as { tripId?: string; tripVersion?: number; disruption?: Disruption; idempotencyKey?: string };
      if (!input.tripId || input.tripVersion === undefined) return send(res, 400, { error: "tripId and tripVersion are required" });
      const requestKey = input.idempotencyKey ?? (typeof req.headers["idempotency-key"] === "string" ? req.headers["idempotency-key"] : undefined);
      if (requestKey && keys.has(`${input.tripId}:${requestKey}`)) { const prior = runs.get(keys.get(`${input.tripId}:${requestKey}`)!); return send(res, 200, prior?.result ?? prior); }
      const trip = await provider.getTrip(input.tripId);
      if (trip.version !== input.tripVersion) return send(res, 409, { error: "stale trip version" });
      const user = await currentUser(req);
      const runId = randomUUID();
      const stored: StoredRun = { id: runId, tripId: trip.id, tripVersion: trip.version, status: "RUNNING", request: input, userId: user?.id, createdAt: new Date().toISOString() };
      runs.set(runId, stored); events.set(runId, []); if (requestKey) keys.set(`${trip.id}:${requestKey}`, runId); record(runId, "RUN_CREATED", { tripId: trip.id });
      try {
        record(runId, "TRIP_LOADED", { version: trip.version });
        const disruption = await provider.getDisruption(trip, input.disruption); record(runId, "DISRUPTION_APPLIED", disruption);
        const candidates = await provider.getCandidates(trip, disruption); record(runId, "CANDIDATES_LOADED", { count: candidates.length });
        const result = await runRecovery(runId, trip, disruption, candidates); record(runId, "RECOVERY_COMPLETED", { status: result.status });
        stored.status = result.status; stored.result = result; stored.completedAt = new Date().toISOString();
        return send(res, 200, result);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Technical error";
        const result = { runId, status: "TECHNICAL_ERROR" as const, trip, disruption: input.disruption ?? null, impact: { disruptedItemIds: [], affectedItemIds: [], impactStates: {}, reasons: [] }, candidates: [], recommendation: null, recoveryPlan: null, actions: [], error: { code: "TECHNICAL_ERROR", message } };
        stored.status = result.status; stored.result = result as never; stored.completedAt = new Date().toISOString(); record(runId, "TECHNICAL_ERROR", result.error);
        return send(res, 500, result);
      }
    }
    const eventsMatch = url.pathname.match(/^\/v1\/recovery-runs\/([^/]+)\/events$/);
    if (req.method === "GET" && eventsMatch) {
      const eventRun = runs.get(eventsMatch[1]); if (!eventRun) return notFound("Recovery run not found");
      if (eventRun.userId && (await currentUser(req))?.id !== eventRun.userId) return notFound("Recovery run not found");
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", "access-control-allow-origin": config.FRONTEND_ORIGIN, "access-control-allow-credentials": "true" });
      for (const event of events.get(eventsMatch[1]) ?? []) res.write(`event: ${event.stage}\ndata: ${JSON.stringify(event)}\n\n`);
      return res.end();
    }
    const runMatch = url.pathname.match(/^\/v1\/recovery-runs\/([^/]+)$/);
    if (req.method === "GET" && runMatch) { const run = runs.get(runMatch[1]); if (!run) return notFound("Recovery run not found"); if (run.userId && (await currentUser(req))?.id !== run.userId) return notFound("Recovery run not found"); return send(res, 200, run.result ?? run); }
    return send(res, 404, { error: "not found" });
  } catch (e) { const status = (e as { status?: number }).status ?? 500; const error = e instanceof AuthError ? { code: e.code, message: e.message } : { code: status === 500 ? "TECHNICAL_ERROR" : "REQUEST_ERROR", message: status === 500 ? "Technical error" : (e as Error).message }; return send(res, status, { error }); }
});
server.listen(config.PORT, () => console.log(`Sutra backend listening on ${config.PORT}`));
process.on("SIGTERM", () => server.close());
