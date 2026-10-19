"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, RefreshCw } from "lucide-react";
import { getCanonicalTrip, getJourneyCatalogue, runConfiguredRecovery, SutraApiError } from "@/lib/api";
import { presentImpact, presentRun, presentTrip } from "@/lib/rail-presentation";
import type { ConstraintOverrides, JourneyCatalogueEntry, RecoveryPriority, RecoveryRunResult, SupportedDisruptionProfile, Trip } from "@/lib/domain/types";
import { RecoveryResultView, NoFeasibleView } from "./result";
import { Btn } from "./sections";

const toInput = (value?: string) => value?.slice(0, 16) ?? "";
const toApi = (value: string) => `${value}:00`;
function delayOptions(profile?: SupportedDisruptionProfile) {
  const range = profile?.delayRange;
  if (!range || range.stepMinutes <= 0) return [];
  return Array.from({ length: Math.floor((range.maximumMinutes - range.minimumMinutes) / range.stepMinutes) + 1 }, (_, index) => range.minimumMinutes + index * range.stepMinutes);
}

function DependencyChecks({ run }: { run: RecoveryRunResult }) {
  return <details className="sutra-card mt-8 rounded-[18px] border border-line bg-surface/60 p-5 shadow-l2 md:p-7">
    <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
      <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-green-bright">Decision details</p>
      <h2 id="dependency-checks" className="mt-2 font-display text-2xl font-semibold">What else we checked</h2>
      <p className="mt-2 text-[15px] text-ink2">Open the returned evidence for connections, locations and timing.</p>
    </summary>
    <div className="mt-5 space-y-4">
      {run.decisionAudit.candidates.map(candidate => <article key={candidate.candidateId} className="rounded-[12px] border border-line bg-bg/40 p-4">
        <p className="font-mono text-[13px] text-ink">{candidate.candidateId} · {candidate.feasible ? "feasible" : "rejected"}</p>
        <ul className="mt-3 space-y-2 text-[14px] text-ink2">
          {candidate.dependencyChecks.map(check => <li key={check.dependencyId} className={check.passed ? "text-ink2" : "text-danger"}><strong>{check.passed ? "✓" : "×"} {check.kind}</strong> · {check.message}</li>)}
          {!candidate.dependencyChecks.length && <li className="text-muted">No dependency checks returned.</li>}
        </ul>
      </article>)}
    </div>
  </details>;
}

/** Configures only backend-supported simulated journeys; the server remains feasibility authority. */
export function RecoveryWorkbench() {
  const [catalogue, setCatalogue] = useState<JourneyCatalogueEntry[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [trip, setTrip] = useState<Trip>();
  const [profileId, setProfileId] = useState("");
  const [delay, setDelay] = useState<number>();
  const [arrival, setArrival] = useState("");
  const [budget, setBudget] = useState("");
  const [noOvernight, setNoOvernight] = useState(true);
  const [priority, setPriority] = useState<RecoveryPriority>("LOWER_COST");
  const [loadingCatalogue, setLoadingCatalogue] = useState(true);
  const [loadingTrip, setLoadingTrip] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string>();
  const [technicalError, setTechnicalError] = useState(false);
  const [run, setRun] = useState<RecoveryRunResult>();

  const selectedJourney = catalogue.find(journey => journey.tripId === selectedId);
  const profile = selectedJourney?.supportedDisruptions.find(value => value.id === profileId);
  const delays = useMemo(() => delayOptions(profile), [profile]);

  const loadCatalogue = useCallback(async () => {
    setLoadingCatalogue(true); setError(undefined); setTechnicalError(false);
    try { const response = await getJourneyCatalogue(); setCatalogue(response.journeys); setSelectedId(current => response.journeys.some(journey => journey.tripId === current) ? current : response.journeys[0]?.tripId ?? ""); }
    catch (cause) { setTechnicalError(cause instanceof SutraApiError && cause.error.audit?.status === "TECHNICAL_ERROR"); setError(cause instanceof SutraApiError ? cause.error.message : "We couldn't load the journey catalogue."); }
    finally { setLoadingCatalogue(false); }
  }, []);
  useEffect(() => { void loadCatalogue(); }, [loadCatalogue]);

  useEffect(() => {
    if (!selectedJourney) { setTrip(undefined); return; }
    let active = true;
    setLoadingTrip(true); setError(undefined); setTechnicalError(false); setRun(undefined); setTrip(undefined);
    setProfileId(selectedJourney.supportedDisruptions[0]?.id ?? "");
    void getCanonicalTrip(selectedJourney.tripId).then(value => {
      if (!active) return;
      setTrip(value); setArrival(toInput(value.constraints.latestArrivalAt)); setBudget(String(value.constraints.maxExtraBudget ?? "")); setNoOvernight(value.constraints.noOvernight);
    }).catch(cause => { if (active) { setTechnicalError(cause instanceof SutraApiError && cause.error.audit?.status === "TECHNICAL_ERROR"); setError(cause instanceof SutraApiError ? cause.error.message : "We couldn't load this journey."); } }).finally(() => { if (active) setLoadingTrip(false); });
    return () => { active = false; };
  }, [selectedJourney]);

  useEffect(() => { setDelay(delayOptions(profile)[0]); }, [profile]);
  const valid = Boolean(trip && profile && (profile.kind === "cancellation" || delays.includes(delay ?? -1)) && arrival && budget !== "" && Number.isFinite(Number(budget)) && Number(budget) >= 0);
  const calculate = async () => {
    if (!trip || !profile || !valid) return;
    const overrides: ConstraintOverrides = { latestArrivalAt: toApi(arrival), maxExtraBudget: Number(budget), noOvernight, priority };
    const disruption = { source: "SIMULATED" as const, scenarioId: profile.id, bookingId: profile.bookingId, kind: profile.kind, ...(profile.kind === "delay" ? { delayMinutes: delay } : {}) };
    setCalculating(true); setError(undefined); setTechnicalError(false); setRun(undefined);
    try { setRun(await runConfiguredRecovery({ tripId: trip.id, tripVersion: trip.version, disruption, constraintOverrides: overrides })); }
    catch (cause) { setTechnicalError(cause instanceof SutraApiError && cause.error.audit?.status === "TECHNICAL_ERROR"); setError(cause instanceof SutraApiError ? cause.error.message : "Recovery could not be calculated. Please retry."); }
    finally { setCalculating(false); }
  };
  const resetResult = () => setRun(undefined);
  const projection = trip && run ? presentRun(trip, run) : undefined;

  return <main className="min-h-screen bg-bg px-5 py-8 text-ink md:px-8">
    <div className="mx-auto max-w-6xl pb-20">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
        <div><Link href="/" className="inline-flex items-center gap-2 text-[14px] text-muted hover:text-ink"><ArrowLeft className="size-4" />Back home</Link><h1 className="mt-4 font-display text-4xl font-semibold">Plan a recovery</h1><p className="mt-2 max-w-3xl text-ink2">Choose a simulated journey and see the travel option Sutra recommends.</p></div>
        <span className="rounded-full border border-warn/60 bg-warn/10 px-3 py-1.5 font-mono text-[11px] tracking-wider text-warn">SIMULATED DATA</span>
      </header>
      {error && <div role="alert" className="mt-6 flex items-start justify-between gap-4 rounded-[14px] border border-danger/60 bg-danger/10 p-4 text-danger"><span><AlertTriangle className="mr-2 inline size-4" /><strong>{technicalError ? "Technical error — no recovery result was created. " : ""}</strong>{error}</span><Btn variant="ghost" onClick={trip ? calculate : loadCatalogue}><RefreshCw className="size-4" />Retry</Btn></div>}
      <section aria-labelledby="workbench-configuration" className="sutra-card mt-8 rounded-[18px] border border-line bg-surface/60 p-5 shadow-l2 md:p-7">
        <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-green-bright">Your journey</p><h2 id="workbench-configuration" className="mt-2 font-display text-2xl font-semibold">What happened to your journey?</h2>
        {loadingCatalogue ? <p className="mt-5 text-muted">Loading simulated journey catalogue…</p> : !catalogue.length ? <p className="mt-5 text-warn">No supported journeys are currently available.</p> : <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-[14px]" htmlFor="journey">Journey<select id="journey" value={selectedId} onChange={event => setSelectedId(event.target.value)} disabled={loadingTrip || calculating} className="rounded-[10px] border border-line bg-bg px-3 py-2">{catalogue.map(journey => <option key={journey.tripId} value={journey.tripId}>{journey.label} · {journey.journeyDate}</option>)}</select></label>
          <label className="grid gap-1.5 text-[14px]" htmlFor="disruption">Disruption<select id="disruption" value={profileId} onChange={event => setProfileId(event.target.value)} disabled={!trip || calculating} className="rounded-[10px] border border-line bg-bg px-3 py-2">{selectedJourney?.supportedDisruptions.map(value => <option key={value.id} value={value.id}>{value.label} · {value.bookingLabel}</option>)}</select></label>
          {profile?.kind === "delay" && <label className="grid gap-1.5 text-[14px]" htmlFor="delay">Delay duration<select id="delay" value={delay ?? ""} onChange={event => setDelay(Number(event.target.value))} disabled={calculating} className="rounded-[10px] border border-line bg-bg px-3 py-2">{delays.map(value => <option key={value} value={value}>{value} minutes</option>)}</select></label>}
          {profile?.kind === "cancellation" && <p className="self-end rounded-[10px] border border-line bg-bg px-3 py-2 text-[14px] text-muted">Cancellation selected. No delay duration is sent.</p>}
        </div>}
        {loadingTrip && <p className="mt-4 text-[14px] text-muted">Loading canonical trip details…</p>}
      </section>
      {trip && <section aria-labelledby="traveller-preferences" className="sutra-card mt-8 rounded-[18px] border border-line bg-surface/60 p-5 shadow-l2 md:p-7">
        <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-green-bright">Your travel preferences</p><h2 id="traveller-preferences" className="mt-2 font-display text-2xl font-semibold">What matters most to you?</h2><p className="mt-2 text-[15px] text-ink2">Sutra checks every simulated option against these preferences.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3"><label className="grid gap-1.5 text-[14px]" htmlFor="latest-arrival">I need to arrive by<input id="latest-arrival" type="datetime-local" value={arrival} onChange={event => setArrival(event.target.value)} disabled={calculating} className="rounded-[10px] border border-line bg-bg px-3 py-2" /></label><label className="grid gap-1.5 text-[14px]" htmlFor="budget">Maximum extra amount I can spend<input id="budget" type="number" min="0" value={budget} onChange={event => setBudget(event.target.value)} disabled={calculating} className="rounded-[10px] border border-line bg-bg px-3 py-2" /></label><label className="flex items-center gap-3 self-end rounded-[10px] border border-line bg-bg px-3 py-3"><input id="overnight" type="checkbox" checked={noOvernight} onChange={event => setNoOvernight(event.target.checked)} disabled={calculating} className="size-4 accent-green" /><span><strong>No overnight travel</strong><span className="block text-[12px] text-muted">Avoid late-night or overnight options</span></span></label></div>
        <fieldset className="mt-5"><legend className="text-[14px] font-medium">What should Sutra prefer?</legend><div className="mt-3 flex flex-wrap gap-3">{(["LOWER_COST", "EARLIER_ARRIVAL"] as const).map(value => <label key={value} className="flex items-center gap-2 rounded-[10px] border border-line bg-bg px-3 py-2"><input type="radio" name="workbench-priority" checked={priority === value} onChange={() => setPriority(value)} disabled={calculating} className="accent-green" />{value === "LOWER_COST" ? "Prefer spending less" : "Prefer arriving earlier"}</label>)}</div></fieldset>
        <div className="mt-6 flex flex-wrap items-center gap-3"><Btn onClick={calculate} disabled={!valid || calculating}>{calculating ? "Checking options…" : "Find my best travel option"}</Btn>{!valid && <span className="text-[13px] text-muted">Choose a journey, what happened and your preferences first.</span>}</div>
      </section>}
      {projection && run && <div className="mt-10">{run.status === "RECOVERED" ? <RecoveryResultView trip={presentTrip(trip!)} result={projection.result} candidates={projection.candidates} selectedId={projection.selectedId} disruption={presentImpact({ source: "SIMULATED", scenarioId: profileId, bookingId: profile?.bookingId ?? "", kind: profile?.kind ?? "delay", ...(profile?.kind === "delay" ? { delayMinutes: delay } : {}) }, run.impact)} onRestart={resetResult} /> : <NoFeasibleView trip={presentTrip(trip!)} result={projection.result} candidates={projection.candidates} onRestart={resetResult} />}<DependencyChecks run={run} /></div>}
      {run?.status === "RECOVERED" && <p className="mt-4 flex items-center gap-2 text-[13px] text-muted"><CheckCircle2 className="size-4 text-green-bright" />Recommendation and all checks above are API-derived simulated results; no booking has been made.</p>}
    </div>
  </main>;
}
