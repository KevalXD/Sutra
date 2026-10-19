"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, RefreshCw } from "lucide-react";
import { getCanonicalTrip, getJourneyCatalogue, runConfiguredRecovery, SutraApiError } from "@/lib/api";
import { presentImpact, presentRun, presentTrip } from "@/lib/rail-presentation";
import type { ConstraintOverrides, JourneyCatalogueEntry, RecoveryPriority, RecoveryRunResult, SupportedDisruptionProfile, Trip } from "@/lib/domain/types";
import { RecoveryResultView, NoFeasibleView, type RecoveryResultTab } from "./result";
import { Btn } from "./sections";

const toInput = (value?: string) => value?.slice(0, 16) ?? "";
const toApi = (value: string) => `${value}:00`;
function delayOptions(profile?: SupportedDisruptionProfile) {
  const range = profile?.delayRange;
  if (!range || range.stepMinutes <= 0) return [];
  return Array.from({ length: Math.floor((range.maximumMinutes - range.minimumMinutes) / range.stepMinutes) + 1 }, (_, index) => range.minimumMinutes + index * range.stepMinutes);
}

function DependencyChecks({ run }: { run: RecoveryRunResult }) {
  return <details className="sutra-card mt-6 rounded-[18px] border border-line bg-surface/60 p-5 shadow-l2 md:p-6">
    <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
      <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-green-bright">Decision details</p>
      <h2 className="mt-2 font-display text-xl font-semibold">What else we checked</h2>
      <p className="mt-2 text-[14px] text-ink2">Open the returned evidence for connections, locations and timing.</p>
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
  const [activeStep, setActiveStep] = useState<1 | 4>(1);
  const [resultTab, setResultTab] = useState<RecoveryResultTab>("best");

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
    setLoadingTrip(true); setError(undefined); setTechnicalError(false); setRun(undefined); setActiveStep(1); setTrip(undefined);
    setProfileId(selectedJourney.supportedDisruptions[0]?.id ?? "");
    void getCanonicalTrip(selectedJourney.tripId).then(value => {
      if (!active) return;
      setTrip(value); setArrival(toInput(value.constraints.latestArrivalAt)); setBudget(String(value.constraints.maxExtraBudget ?? "")); setNoOvernight(value.constraints.noOvernight);
    }).catch(cause => { if (active) { setTechnicalError(cause instanceof SutraApiError && cause.error.audit?.status === "TECHNICAL_ERROR"); setError(cause instanceof SutraApiError ? cause.error.message : "We couldn't load this journey."); } }).finally(() => { if (active) setLoadingTrip(false); });
    return () => { active = false; };
  }, [selectedJourney]);

  useEffect(() => { setDelay(delayOptions(profile)[0]); }, [profile]);
  const valid = Boolean(trip && profile && (profile.kind === "cancellation" || delays.includes(delay ?? -1)) && arrival && budget !== "" && Number.isFinite(Number(budget)) && Number(budget) >= 0);
  const invalidateRun = () => { setRun(undefined); setResultTab("best"); };
  const calculate = async () => {
    if (!trip || !profile || !valid) return;
    const overrides: ConstraintOverrides = { latestArrivalAt: toApi(arrival), maxExtraBudget: Number(budget), noOvernight, priority };
    const disruption = { source: "SIMULATED" as const, scenarioId: profile.id, bookingId: profile.bookingId, kind: profile.kind, ...(profile.kind === "delay" ? { delayMinutes: delay } : {}) };
    setCalculating(true); setError(undefined); setTechnicalError(false); setRun(undefined); setResultTab("best");
    try { setRun(await runConfiguredRecovery({ tripId: trip.id, tripVersion: trip.version, disruption, constraintOverrides: overrides })); setActiveStep(4); window.scrollTo({ top: 0, behavior: "smooth" }); }
    catch (cause) { setTechnicalError(cause instanceof SutraApiError && cause.error.audit?.status === "TECHNICAL_ERROR"); setError(cause instanceof SutraApiError ? cause.error.message : "Recovery could not be calculated. Please retry."); setActiveStep(4); window.scrollTo({ top: 0, behavior: "smooth" }); }
    finally { setCalculating(false); }
  };
  const resetResult = () => { setRun(undefined); setResultTab("best"); setActiveStep(1); };
  const projection = trip && run ? presentRun(trip, run) : undefined;
  const openStep = (step: 1 | 4) => { if (step === 1 || run) { setActiveStep(step); window.scrollTo({ top: 0, behavior: "smooth" }); } };
  const tabs: { id: RecoveryResultTab; label: string; description: string }[] = [
    { id: "best", label: "Best Recovery", description: "Recommendation, timing and fit" },
    { id: "journey", label: "Journey & Itinerary", description: "Original and repaired journey" },
    { id: "compare", label: "Compare & Explain", description: "Alternatives and reasoning" },
  ];

  return <main id="workbench-top" className="min-h-screen bg-bg px-5 py-8 text-ink md:px-8">
    <div className="mx-auto max-w-6xl pb-16">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
        <div><Link href="/" className="inline-flex items-center gap-2 text-[14px] text-muted hover:text-ink"><ArrowLeft className="size-4" />Back home</Link><h1 className="mt-4 font-display text-3xl font-semibold md:text-4xl">Find a way forward</h1><p className="mt-2 max-w-3xl text-ink2">Tell Sutra what happened and what matters to you. We will compare options that fit.</p><p className="mt-2 text-sm text-muted">This tool evaluates options only. It does not book or change tickets.</p></div>
        <span className="rounded-full border border-warn/60 bg-warn/10 px-3 py-1.5 font-mono text-[11px] tracking-wider text-warn">SIMULATED DATA</span>
      </header>

      <nav aria-label="Recovery steps" className="sticky top-3 z-20 mt-5 rounded-2xl border border-line bg-bg/95 p-2 shadow-l2 backdrop-blur-xl">
        <ol className="grid gap-2 sm:grid-cols-2">
          {[{ step: 1 as const, label: "Your trip & preferences", complete: Boolean(trip && profile && valid) }, { step: 4 as const, label: "Your options", complete: Boolean(run) }].map(item => <li key={item.step}><button type="button" onClick={() => openStep(item.step)} disabled={item.step === 4 && !run} aria-current={activeStep === item.step ? "step" : undefined} className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${activeStep === item.step ? "border-green/70 bg-green-soft/45 text-ink shadow-[0_0_0_1px_rgba(124,255,167,0.12)]" : item.step === 1 || run ? "border-line bg-surface/45 text-ink2 hover:border-green/50 hover:bg-green-soft/20" : "border-line/70 bg-surface/20 text-muted opacity-70"}`}><span className={`flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs ${item.complete ? "bg-green-bright text-bg" : activeStep === item.step ? "border border-green-bright text-green-bright" : "border border-line text-muted"}`}>{item.complete ? <CheckCircle2 className="size-4" /> : item.step === 1 ? "01" : "02"}</span><span><span className="block text-sm font-medium">{item.label}</span><span className="block text-xs text-muted">{item.step === 1 ? "Tell us about your journey and what you need" : "Review and compare the available options"}</span></span></button></li>)}
        </ol>
      </nav>

      {error && <div role="alert" className="mt-5 flex items-start justify-between gap-4 rounded-[14px] border border-danger/60 bg-danger/10 p-4 text-danger"><span><AlertTriangle className="mr-2 inline size-4" /><strong>{technicalError ? "Technical error — no recovery result was created. " : ""}</strong>{error}</span><Btn variant="ghost" onClick={trip ? calculate : loadCatalogue}><RefreshCw className="size-4" />Retry</Btn></div>}

      {activeStep === 1 && <section aria-labelledby="workbench-configuration" className="sutra-card mt-6 rounded-[18px] border border-line bg-surface/60 p-5 shadow-l2 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[12px] uppercase tracking-[0.14em] text-green-bright">Your trip and preferences</p><h2 id="workbench-configuration" className="mt-2 font-display text-2xl font-semibold">What happened, and what would work for you?</h2><p className="mt-2 max-w-3xl text-[15px] text-ink2">Choose your journey, describe the disruption, then set the limits Sutra should respect.</p></div>{trip && <span className="inline-flex items-center gap-2 rounded-full border border-green/40 bg-green-soft/25 px-3 py-1.5 text-[13px] text-ink2"><CheckCircle2 className="size-4 text-green-bright" />Trip loaded</span>}</div>
        {loadingCatalogue ? <p className="mt-5 text-muted">Loading simulated journey catalogue…</p> : !catalogue.length ? <p className="mt-5 text-warn">No supported journeys are currently available.</p> : <div className="mt-6 grid gap-5 md:grid-cols-2"><label className="grid gap-1.5 text-[14px]" htmlFor="journey">Your journey<select id="journey" value={selectedId} onChange={event => setSelectedId(event.target.value)} disabled={loadingTrip || calculating} className="rounded-[10px] border border-line bg-bg px-3 py-2">{catalogue.map(journey => <option key={journey.tripId} value={journey.tripId}>{journey.label} · {journey.journeyDate}</option>)}</select></label><label className="grid gap-1.5 text-[14px]" htmlFor="disruption">What happened?<select id="disruption" value={profileId} onChange={event => { setProfileId(event.target.value); invalidateRun(); }} disabled={!trip || calculating} className="rounded-[10px] border border-line bg-bg px-3 py-2">{selectedJourney?.supportedDisruptions.map(value => <option key={value.id} value={value.id}>{value.label} · {value.bookingLabel}</option>)}</select></label>{profile?.kind === "delay" && <label className="grid gap-1.5 text-[14px]" htmlFor="delay">How long is the delay?<select id="delay" value={delay ?? ""} onChange={event => { setDelay(Number(event.target.value)); invalidateRun(); }} disabled={calculating} className="rounded-[10px] border border-line bg-bg px-3 py-2">{delays.map(value => <option key={value} value={value}>{value} minutes</option>)}</select></label>}{profile?.kind === "cancellation" && <p className="self-end rounded-[10px] border border-line bg-bg px-3 py-2 text-[14px] text-muted">Cancellation selected. No delay duration is needed.</p>}<label className="grid gap-1.5 text-[14px]" htmlFor="latest-arrival">I need to arrive by<input id="latest-arrival" type="datetime-local" value={arrival} onChange={event => { setArrival(event.target.value); invalidateRun(); }} disabled={calculating} className="rounded-[10px] border border-line bg-bg px-3 py-2" /></label><label className="grid gap-1.5 text-[14px]" htmlFor="budget">Maximum extra amount I can spend<input id="budget" type="number" min="0" value={budget} onChange={event => { setBudget(event.target.value); invalidateRun(); }} disabled={calculating} className="rounded-[10px] border border-line bg-bg px-3 py-2" /></label><label className="flex items-center gap-3 self-end rounded-[10px] border border-line bg-bg px-3 py-3"><input id="overnight" type="checkbox" checked={noOvernight} onChange={event => { setNoOvernight(event.target.checked); invalidateRun(); }} disabled={calculating} className="size-4 accent-green" /><span><strong>No overnight travel</strong><span className="block text-[12px] text-muted">Avoid late-night or overnight options</span></span></label></div>}
        {loadingTrip && <p className="mt-4 text-[14px] text-muted">Loading canonical trip details…</p>}
        <fieldset className="mt-6"><legend className="text-[14px] font-medium">What should Sutra prefer?</legend><div className="mt-3 flex flex-wrap gap-3">{(["LOWER_COST", "EARLIER_ARRIVAL"] as const).map(value => <label key={value} className="flex items-center gap-2 rounded-[10px] border border-line bg-bg px-3 py-2"><input type="radio" name="workbench-priority" checked={priority === value} onChange={() => { setPriority(value); invalidateRun(); }} disabled={calculating} className="accent-green" />{value === "LOWER_COST" ? "Prefer spending less" : "Prefer arriving earlier"}</label>)}</div></fieldset>
        <div className="mt-7 flex flex-wrap items-center justify-end gap-3"><Btn onClick={calculate} disabled={!valid || calculating}>{calculating ? "Checking options…" : "Find My Best Travel Option"}</Btn>{!valid && <span className="text-[13px] text-muted">Complete the fields above to continue.</span>}</div>
      </section>}

      {activeStep === 4 && <section aria-labelledby="recovery-options" className="mt-6"><div className="rounded-[18px] border border-green/50 bg-green-soft/20 p-5 md:p-6"><p className="font-mono text-[12px] uppercase tracking-[0.14em] text-green-bright">Your options</p><h2 id="recovery-options" className="mt-2 font-display text-2xl font-semibold">Choose how you want to review the result</h2><p className="mt-2 text-[15px] text-ink2">Start with the best option, then open the journey details or compare alternatives.</p></div><div role="tablist" aria-label="Recovery result views" className="mt-4 grid gap-2 rounded-2xl border border-line bg-surface/70 p-2 sm:grid-cols-3">{tabs.map(tab => <button key={tab.id} type="button" role="tab" aria-selected={resultTab === tab.id} aria-controls={`recovery-tabpanel-${tab.id}`} onClick={() => setResultTab(tab.id)} className={`rounded-xl border px-3 py-3 text-left transition ${resultTab === tab.id ? "border-green/70 bg-green-soft/45 text-ink" : "border-transparent text-ink2 hover:border-line hover:bg-bg/60"}`}><span className="block text-sm font-semibold">{tab.label}</span><span className="mt-1 block text-xs text-muted">{tab.description}</span></button>)}</div><div id={`recovery-tabpanel-${resultTab}`} role="tabpanel" tabIndex={0} className="mt-4 rounded-[18px] border border-line bg-surface/40 p-4 shadow-l2 md:p-6">{projection && run ? (run.status === "RECOVERED" ? <RecoveryResultView tab={resultTab} trip={presentTrip(trip!)} result={projection.result} candidates={projection.candidates} selectedId={projection.selectedId} disruption={presentImpact({ source: "SIMULATED", scenarioId: profileId, bookingId: profile?.bookingId ?? "", kind: profile?.kind ?? "delay", ...(profile?.kind === "delay" ? { delayMinutes: delay } : {}) }, run.impact)} onRestart={resetResult} /> : <NoFeasibleView tab={resultTab} trip={presentTrip(trip!)} result={projection.result} candidates={projection.candidates} onRestart={resetResult} />) : calculating ? <div className="p-8 text-center text-ink2" role="status">Checking the available journeys…</div> : <div className="p-8 text-center text-ink2">No recovery result is available yet. Return to the input form to try again.</div>}{run && <DependencyChecks run={run} />}</div><div className="mt-5"><Btn variant="ghost" onClick={() => openStep(1)}><ArrowLeft className="size-4" />Back to inputs</Btn></div></section>}
    </div>
  </main>;
}
