"use client";

import React, { useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { LiveRailStatus } from "@/lib/integrations/rail-status";

type ViewState = "idle" | "loading" | "success" | "error";

function displayTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function LiveRailStatusContent({ state, status, error }: { state: ViewState; status?: LiveRailStatus; error?: string }) {
  if (state === "loading") return <p className="mt-4 text-sm text-ink2" role="status">Checking RailRadar for the latest reported status…</p>;
  if (state === "error") return <p className="mt-4 flex items-start gap-2 text-sm text-danger" role="alert"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{error ?? "Live status is unavailable."}</p>;
  if (state !== "success" || !status) return <p className="mt-4 text-sm text-muted">Check a train number to see its reported running status. This does not change Sutra’s simulated recovery alternatives.</p>;
  return <div className="mt-5 rounded-xl border border-green/40 bg-green-soft/20 p-4" aria-live="polite">
    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-green-bright">Live status reported by RailRadar</p>
    <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-display text-xl font-semibold">{status.trainNumber} · {status.trainName}</h3><span className="rounded-full border border-line bg-bg/50 px-2.5 py-1 text-xs text-ink2">{status.status}</span></div>
    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-muted">Delay</dt><dd>{status.delayMinutes === null ? "Not reported" : `${status.delayMinutes} minutes`}</dd></div><div><dt className="text-muted">Current station</dt><dd>{status.currentStationCode ?? "Not reported"}</dd></div><div><dt className="text-muted">Next station</dt><dd>{status.nextStationName ? `${status.nextStationName}${status.nextStationCode ? ` (${status.nextStationCode})` : ""}` : "Not reported"}</dd></div><div><dt className="text-muted">Last updated</dt><dd>{displayTime(status.lastUpdatedAt)}</dd></div></dl>
    <p className="mt-4 text-xs text-muted">Source: {status.providerSource} · {status.isLive ? "Provider marks this as live" : "Provider does not currently mark this as live"}</p>
  </div>;
}

export function LiveRailStatus() {
  const [trainNumber, setTrainNumber] = useState("12919");
  const [state, setState] = useState<ViewState>("idle");
  const [status, setStatus] = useState<LiveRailStatus>();
  const [error, setError] = useState<string>();
  const valid = /^\d{5}$/.test(trainNumber);
  const checkStatus = async () => {
    if (!valid || state === "loading") return;
    setState("loading"); setError(undefined); setStatus(undefined);
    try {
      const response = await fetch(`/api/v1/rail-status?trainNumber=${encodeURIComponent(trainNumber)}`, { cache: "no-store" });
      const body: unknown = await response.json().catch(() => undefined);
      if (!response.ok || !body || typeof body !== "object" || !("trainNumber" in body)) throw new Error((body as { error?: { message?: string } } | undefined)?.error?.message ?? "Live status is unavailable.");
      setStatus(body as LiveRailStatus); setState("success");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Live status is unavailable."); setState("error"); }
  };
  return <section aria-labelledby="live-rail-status" className="sutra-card mt-6 rounded-[18px] border border-line bg-surface/60 p-5 shadow-l2 md:p-7">
    <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-blue-bright">Live railway status</p><h2 id="live-rail-status" className="mt-2 font-display text-2xl font-semibold">Check a reported train status</h2><p className="mt-2 max-w-3xl text-[15px] text-ink2">This is a manual check—Sutra does not poll RailRadar in the background.</p>
    <div className="mt-5 flex flex-wrap items-end gap-3"><label className="grid gap-1.5 text-sm" htmlFor="live-train-number">Train number<input id="live-train-number" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} value={trainNumber} onChange={event => setTrainNumber(event.target.value.replace(/\D/g, ""))} disabled={state === "loading"} className="w-40 rounded-[10px] border border-line bg-bg px-3 py-2" /></label><button type="button" onClick={checkStatus} disabled={!valid || state === "loading"} className="inline-flex items-center gap-2 rounded-[10px] bg-green px-4 py-2 text-sm font-semibold text-bg transition hover:bg-green-bright disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className={`size-4 ${state === "loading" ? "sutra-spin" : ""}`} />{state === "loading" ? "Checking…" : "Check live status"}</button>{!valid && <span className="text-xs text-muted">Enter exactly five digits.</span>}</div>
    <LiveRailStatusContent state={state} status={status} error={error} />
    <p className="mt-5 border-t border-line pt-4 text-xs text-warn">Recovery alternatives are simulated and no ticket availability or booking is confirmed. Live status is not yet used to calculate these alternatives.</p>
  </section>;
}
