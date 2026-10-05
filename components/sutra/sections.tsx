"use client";
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "motion/react";
import { RotateCcw, ServerCrash } from "lucide-react";
import type { ApiError, Booking, Diff, DisruptionAnalysis, Itinerary } from "@/lib/types";
import { day, fmtDuration, formatMoney, hm } from "@/lib/format";
import { placeName } from "@/lib/places";
import { JourneyBand } from "./journey-band";
import { AffectedBookings, IMPACT_LABEL } from "./affected";
import { SEARCH_STAGES } from "@/hooks/use-recovery-flow";
import { StatusMark, TextLoop, ThoughtLine } from "./kit";

const TravelGlobe = dynamic(() => import("./travel-globe").then(module => module.TravelGlobe), {
  ssr: false,
  loading: () => <div aria-hidden className="mx-auto h-[19rem] w-full max-w-[30rem] sm:h-[24rem] lg:h-[27rem]" />,
});

/* ───────── shared primitives ───────── */
export function Btn({ children, onClick, variant = "primary" }: { children: ReactNode; onClick: () => void; variant?: "primary" | "ghost" | "neutral" }) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-[15px] font-medium transition active:translate-y-px ${
        variant === "primary" ? "bg-green text-bg hover:bg-green-bright" : variant === "neutral" ? "bg-ink text-bg hover:bg-ink2" : "border border-line-strong text-ink2 hover:bg-soft hover:text-ink"}`}>
      {children}
    </button>
  );
}
export function Section({ id, kicker, title, children, tone = "default" }: { id: string; kicker: string; title: ReactNode; children: ReactNode; tone?: "default" | "danger" | "warn" | "success" }) {
  const reduce = useReducedMotion();
  const kc = { default: "text-muted", danger: "text-danger", warn: "text-warn", success: "text-green-bright" }[tone];
  return (
    <motion.section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 py-12 md:py-16"
      initial={reduce ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: "easeOut" }}>
      <p className={`font-mono text-[12px] uppercase tracking-[0.18em] ${kc}`}>{kicker}</p>
      <h2 id={`${id}-h`} tabIndex={-1} className="mt-2 outline-none font-display text-[clamp(2rem,4.6vw,3.5rem)] font-semibold leading-[1.05] tracking-tight text-ink">{title}</h2>
      <div className="mt-8 space-y-8">{children}</div>
    </motion.section>
  );
}
const journeyCities = (bs: Booking[]) => {
  const legs = bs.filter(b => b.kind !== "hotel");
  return legs.length ? [legs[0].origin, ...legs.map(l => l.dest)] : [];
};

/* ───────── Hero (parallax depth + Text Loop) ───────── */
export function Hero({ trip }: { trip?: Itinerary }) {
  const reduce = useReducedMotion();
  const cities = trip ? journeyCities(trip.bookings) : [];
  return (
    <section aria-label="Sutra" className="relative isolate overflow-hidden pb-6 pt-28 md:pt-36">
      <div className="relative z-10 grid items-center gap-6 md:grid-cols-[minmax(0,1.25fr)_minmax(17rem,0.75fr)] md:gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-green-bright">An AI agent for travel disruption recovery</p>
          <h1 className="mt-5 max-w-4xl font-display text-[clamp(2.5rem,5.6vw,4.25rem)] font-semibold leading-[0.98] tracking-tight text-ink">
            <span className="block">When travel</span>
            <span className="block"><TextLoop words={["breaks,", "is delayed,", "is cancelled,"]} className="text-green-bright" /></span>
            <span className="block">Sutra repairs</span>
            <span className="block">the journey.</span>
          </h1>
          <p className="mt-6 max-w-xl text-[17px] text-ink2">
            Sutra traces how one disruption ripples through connected bookings, checks every option against your constraints, and shows exactly what changed.
          </p>
          <p className="mt-8 font-mono text-[13px] text-muted" role={trip ? undefined : "status"}>
            {trip ? `Demo trip · ${cities.map(placeName).join(" → ")} · ${day(trip.bookings[0].start)} 2026 · simulated data` : "Loading journey…"}
          </p>
        </div>
        <div className="relative z-10">
          <TravelGlobe reduceMotion={!!reduce} />
        </div>
      </div>
    </section>
  );
}

/* ───────── 01 Trip overview ───────── */
export function TripOverview({ trip, diffs, disruption, highlightId, cta }: { trip: Itinerary; diffs?: Record<string, Diff>; disruption?: DisruptionAnalysis["disruption"]; highlightId?: string; cta?: ReactNode }) {
  const c = trip.constraints;
  return (
    <Section id="trip" kicker="01 · Trip" title="Your journey">
      <JourneyBand bookings={trip.bookings} currency={trip.currency} diffs={diffs} disruption={disruption} highlightId={highlightId} idPrefix="trip" />
      <dl className="grid gap-x-8 gap-y-5 border-t border-line pt-6 sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-[13px] text-muted">Home</dt><dd className="mt-1 font-display text-xl">{placeName(c.home)}</dd></div>
        <div><dt className="text-[13px] text-muted">Maximum extra budget</dt><dd className="mt-1 font-display text-xl">{formatMoney(c.maxExtraBudget, trip.currency)}</dd></div>
        <div><dt className="text-[13px] text-muted">Overnight stay</dt><dd className="mt-1 font-display text-xl">{c.noOvernight ? "Not allowed" : "Allowed"}</dd>{c.noOvernight && <dd className="font-mono text-[12px] text-muted">23:00–05:00</dd>}</div>
        <div><dt className="text-[13px] text-muted">Must be there</dt>{c.mustBeAt?.map(g => (
          <dd key={g.label} className="mt-1 font-display text-xl">{g.label}<span className="block font-mono text-[12px] text-muted">{placeName(g.city)} by {hm(g.arriveBy)}, {day(g.arriveBy)}</span></dd>))}</div>
      </dl>
      {cta}
    </Section>
  );
}

/* ───────── 02 Disruption ───────── */
export function DisruptionEvent({ analysis, trip, highlightId, onHighlight, cta }: { analysis: DisruptionAnalysis; trip: Itinerary; highlightId?: string; onHighlight: (id?: string) => void; cta?: ReactNode }) {
  const d = analysis.disruption;
  const b = trip.bookings.find(x => x.id === d.bookingId);
  const title = d.kind === "delay" ? <>Flight {d.bookingId} delayed <span className="text-warn">{fmtDuration(d.delayMin ?? 0)}</span></>
    : <>Flight {d.bookingId} <span className="text-danger">cancelled</span></>;
  return (
    <Section id="disruption" kicker="02 · Disruption" title={title} tone="danger">
      <p className="max-w-2xl text-[17px] text-ink2">
        {b ? `${placeName(b.origin)} → ${placeName(b.dest)}, originally ${hm(b.start)}–${hm(b.end)}. ` : ""}
        {d.kind === "delay" ? "The first leg now lands much later than planned." : "The first leg will not operate, so the journey cannot start as booked."}
        {" "}Affected downstream: <span className="font-mono text-[15px] text-ink">{analysis.affectedBookingIds.join(", ")}</span>.
      </p>
      <AffectedBookings analysis={analysis} trip={trip} highlightId={highlightId} onHighlight={onHighlight} />
      {cta}
    </Section>
  );
}

/* ───────── 03 Impact analysis (causal chain) ───────── */
export function ImpactTrace({ analysis, cta }: { analysis: DisruptionAnalysis; cta?: ReactNode }) {
  const reduce = useReducedMotion();
  const steps = analysis.impact;
  return (
    <Section id="impact" kicker="03 · Impact" title="What this breaks" tone="warn">
      <ol className="max-w-2xl">
        {steps.map((s, i) => (
          <motion.li key={i} className="relative flex gap-5 pb-9 last:pb-0"
            initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : i * 0.5, duration: 0.35 }}>
            {i < steps.length - 1 && (
              <motion.span aria-hidden className="absolute left-[12px] top-[34px] -bottom-1 w-px origin-top bg-gradient-to-b from-warn/80 to-warn/20"
                initial={reduce ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: reduce ? 0 : i * 0.5 + 0.25, duration: 0.4 }} />
            )}
            <StatusMark status={i === 0 ? "error" : "warning"} size={26} label={IMPACT_LABEL[s.reason]} />
            <div>
              <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-muted">{IMPACT_LABEL[s.reason]} · <span className="text-ink2">{s.bookingId}</span></p>
              <p className="mt-1 text-[17px] text-ink">{s.text}</p>
            </div>
          </motion.li>
        ))}
      </ol>
      {cta}
    </Section>
  );
}

/* ───────── 04 Recovery analysis ───────── */
export function RecoveryAnalysis({ stage }: { stage: number }) {
  return (
    <Section id="analysis" kicker="04 · Recovery" title="Sutra is repairing the journey">
      <ThoughtLine steps={SEARCH_STAGES} current={stage} done={false} doneLabel="Recovery found." />
    </Section>
  );
}

/* ───────── Technical error (distinct from infeasibility) ───────── */
export function TechnicalErrorView({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  return (
    <Section id="error" kicker="System · Technical error" title={<span className="flex items-center gap-4"><ServerCrash aria-hidden className="size-9 text-danger" />{error.message}</span>} tone="danger">
      <div role="alert" className="max-w-2xl rounded-[18px] border border-danger/50 bg-elevated p-6">
        <p className="text-[16px] text-ink2">This is a system problem, not a recovery result. Your journey has not been judged infeasible.</p>
        <p className="mt-3 font-mono text-[12px] text-muted">{error.code}</p>
      </div>
      <Btn onClick={onRetry}><RotateCcw aria-hidden className="size-4" />Retry</Btn>
    </Section>
  );
}
