"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useReducedMotion } from "motion/react";
import { ArrowRight, Radar, Search } from "lucide-react";
import { useRecoveryFlow } from "@/hooks/use-recovery-flow";
import type { Diff, Phase, ScenarioId } from "@/lib/types";
import { Btn, DisruptionEvent, Hero, ImpactTrace, RecoveryAnalysis, TechnicalErrorView, TripOverview } from "./sections";
import { NoFeasibleView, RecoveryResultView } from "./result";
import { FloatingDock, ProgressiveBlur, StatusMark, TracingBeam, type DockStage, type MarkStatus } from "./kit";
import { Grainient } from "./grainient";
import { Meteors } from "@/components/ui/meteors";

const SCENARIOS: { id: ScenarioId; label: string }[] = [
  { id: "delay", label: "Delay" }, { id: "cancellation", label: "Cancellation" },
  { id: "infeasible", label: "No recovery" }, { id: "error", label: "Technical error" },
];
const SCROLL_TARGET: Partial<Record<Phase, string>> = {
  DISRUPTION_DETECTED: "disruption", IMPACT_ANALYSIS: "impact", RECOVERY_ANALYSIS: "analysis",
  RECOVERY_READY: "result", NO_FEASIBLE_RECOVERY: "result", TECHNICAL_ERROR: "error",
};

export function SutraApp({ scenario }: { scenario: ScenarioId }) {
  const f = useRecoveryFlow(scenario);
  const { phase, trip, analysis, result } = f;
  const reduce = useReducedMotion();
  const [highlightId, setHighlightId] = useState<string>();

  useEffect(() => {
    const id = SCROLL_TARGET[phase];
    if (!id) return;
    const t = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      // Keep keyboard/screen-reader position with the new content (the activated button has just unmounted).
      document.getElementById(`${id}-h`)?.focus({ preventScroll: true });
    }, 120);
    return () => clearTimeout(t);
  }, [phase, reduce]);

  const restart = () => { setHighlightId(undefined); f.reload(); };
  const hasDisruption = !!analysis && phase !== "TRIP_LOADED" && phase !== "IDLE";
  const hasImpact = ["IMPACT_ANALYSIS", "RECOVERY_ANALYSIS", "RECOVERY_READY", "NO_FEASIBLE_RECOVERY"].includes(phase);
  const hasResult = (phase === "RECOVERY_READY" || phase === "NO_FEASIBLE_RECOVERY") && !!result;

  // Original trip is annotated in place once a disruption exists (continuity: the journey itself is interrupted).
  const tripDiffs: Record<string, Diff> | undefined = hasDisruption && trip && analysis
    ? Object.fromEntries(trip.bookings.map(b => [b.id, b.id === analysis.disruption.bookingId ? "CHANGED" : analysis.affectedBookingIds.includes(b.id) ? "AFFECTED" : "UNCHANGED"])) as Record<string, Diff>
    : undefined;

  const next = phase === "TRIP_LOADED" ? { label: "Simulate disruption", run: f.simulateDisruption }
    : phase === "DISRUPTION_DETECTED" ? { label: "Analyze impact", run: f.analyzeImpact }
    : phase === "IMPACT_ANALYSIS" ? { label: "Find recovery", run: f.findRecovery } : null;

  const st = (done: boolean, running = false, bad: MarkStatus = "done"): MarkStatus => (running ? "running" : done ? bad : "pending");
  const stages: DockStage[] = [
    { id: "trip", label: "Trip", status: st(!!trip), enabled: !!trip },
    { id: "disruption", label: "Disruption", status: st(hasDisruption, false, "warning"), enabled: hasDisruption },
    { id: "impact", label: "Impact", status: st(hasImpact, false, "warning"), enabled: hasImpact },
    { id: "analysis", label: "Recovery", status: hasResult && !result!.feasible ? "warning" : st(hasResult, phase === "RECOVERY_ANALYSIS"), enabled: phase === "RECOVERY_ANALYSIS" || hasResult },
    { id: "result", label: "Result", status: hasResult ? (result!.feasible ? "done" : "warning") : "pending", enabled: hasResult },
  ];
  const phaseMark: MarkStatus = phase === "TECHNICAL_ERROR" ? "error" : phase === "NO_FEASIBLE_RECOVERY" ? "warning" : phase === "RECOVERY_READY" ? "done" : phase === "IDLE" || phase === "RECOVERY_ANALYSIS" ? "running" : "pending";

  return (
    <div className="relative isolate min-h-screen" onPointerMove={event => {
      if (!(event.target instanceof Element)) return;
      const card = event.target.closest<HTMLElement>(".sutra-card");
      if (!card) return;
      const bounds = card.getBoundingClientRect();
      card.style.setProperty("--pointer-x", `${event.clientX - bounds.left}px`);
      card.style.setProperty("--pointer-y", `${event.clientY - bounds.top}px`);
    }}>
      <Grainient
        color1="#07110e"
        color2="#123f32"
        color3="#172b46"
        timeSpeed={0.25}
        noiseScale={2}
        grainAmount={0.1}
        zoom={0.9}
      />
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="sutra-starfield" />
        <Meteors number={30} />
      </div>
      <ProgressiveBlur position="top" height={96} />
      <header className="fixed inset-x-0 top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 md:px-8">
          <Link href="/" className="font-display text-[22px] font-semibold tracking-tight text-ink">Sutra</Link>
          <nav aria-label="Demo scenario" className="hidden items-center gap-1 text-[13px] sm:flex">
            <span className="mr-2 font-mono text-[11px] uppercase tracking-widest text-muted">Demo</span>
            {SCENARIOS.map(s => (
              <Link key={s.id} href={`/?scenario=${s.id}`} aria-current={scenario === s.id ? "page" : undefined}
                className={`rounded-[10px] px-3 py-1.5 transition ${scenario === s.id ? "bg-soft text-ink" : "text-muted hover:text-ink"}`}>{s.label}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted" aria-live="polite">
            <StatusMark status={phaseMark} size={16} label={phase} /><span className="hidden md:inline">{phase.replaceAll("_", " ")}</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-5 pb-40 md:px-8">
        <Hero trip={trip} />

        {phase === "TECHNICAL_ERROR" && f.error && !trip && <TechnicalErrorView error={f.error} onRetry={f.reload} />}

        {trip && (
          <TracingBeam>
            <TripOverview trip={trip} diffs={tripDiffs} highlightId={highlightId} disruption={hasDisruption ? analysis!.disruption : undefined}
              cta={phase === "TRIP_LOADED" ? <Btn onClick={f.simulateDisruption}><Radar aria-hidden className="size-4" />Simulate disruption</Btn> : undefined} />

            {hasDisruption && analysis && (
              <DisruptionEvent analysis={analysis} trip={trip} highlightId={highlightId} onHighlight={setHighlightId}
                cta={phase === "DISRUPTION_DETECTED" ? <Btn onClick={f.analyzeImpact}><ArrowRight aria-hidden className="size-4" />Analyze impact</Btn> : undefined} />
            )}
            {hasImpact && analysis && (
              <ImpactTrace analysis={analysis}
                cta={phase === "IMPACT_ANALYSIS" ? <Btn onClick={f.findRecovery}><Search aria-hidden className="size-4" />Find recovery</Btn> : undefined} />
            )}
            {phase === "RECOVERY_ANALYSIS" && <RecoveryAnalysis stage={f.stage} />}
            {phase === "RECOVERY_READY" && result && <RecoveryResultView trip={trip} result={result} candidates={f.candidates} selectedId={f.selectedId} onRestart={restart} />}
            {phase === "NO_FEASIBLE_RECOVERY" && result && <NoFeasibleView trip={trip} result={result} candidates={f.candidates} onRestart={restart} />}
            {phase === "TECHNICAL_ERROR" && f.error && <TechnicalErrorView error={f.error} onRetry={f.reload} />}
          </TracingBeam>
        )}

      </main>

      <FloatingDock stages={stages} action={next ? { label: next.label, onClick: next.run } : null} />
    </div>
  );
}
