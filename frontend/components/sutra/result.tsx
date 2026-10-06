"use client";
import { ArrowRight, CircleSlash, PhoneCall, RotateCcw } from "lucide-react";
import type { Diff, Itinerary, RecoveryCandidate, RecoveryResult } from "@/lib/types";
import { diffOf, fmtDuration, formatMoney, hm, layovers, violationLabel } from "@/lib/format";
import { placeName } from "@/lib/places";
import { Btn, Section } from "./sections";
import { JourneyBand } from "./journey-band";
import { RecoveryPath } from "./recovery-path";
import { RecoveryComparison } from "./comparison";
import { RepairTimeline, WhatChanged } from "./repair-diff";
import { SpringCheck, StatusMark } from "./kit";
import { BorderGlow } from "./card-effects";

const cities = (bs: { kind: string; origin: string; dest: string }[]) => {
  const legs = bs.filter(b => b.kind !== "hotel");
  return legs.length ? [legs[0].origin, ...legs.map(l => l.dest)] : [];
};
const H3 = "font-display text-[clamp(1.5rem,2.6vw,2.25rem)] font-semibold";

/** Each line is derived from `result.violations` and the repaired itinerary — nothing is asserted that the data does not show. */
function constraintChecks(trip: Itinerary, result: RecoveryResult) {
  const c = trip.constraints, cur = trip.currency;
  const legs = result.itinerary.filter(b => b.kind !== "hotel");
  const arrival = legs[legs.length - 1]?.end;
  const goal = c.mustBeAt?.[0];
  const lay = layovers(result.itinerary);
  const viol = (k: string) => result.violations.filter(v => v.kind === k);
  const msg = (k: string) => viol(k).map(v => `${v.bookingId}: ${v.message}`).join(" · ");
  const rows: { k: string; ok: boolean; label: string; detail?: string }[] = [
    { k: "budget", ok: !viol("budget").length, label: viol("budget").length ? "Extra budget exceeded" : "Within extra budget",
      detail: viol("budget").length ? msg("budget") : `${formatMoney(result.extraCost, cur)} of ${formatMoney(c.maxExtraBudget, cur)}` },
    { k: "connection", ok: !viol("connection").length, label: viol("connection").length ? "Minimum connection violated" : "Minimum connection satisfied",
      detail: viol("connection").length ? msg("connection") : lay.length ? lay.map(l => `${placeName(l.city)} layover ${fmtDuration(l.minutes)}`).join(" · ") : "No connections to check" },
  ];
  if (goal && arrival) rows.push({ k: "deadline", ok: !viol("deadline").length, label: viol("deadline").length ? "Arrival deadline missed" : "Arrival deadline satisfied",
    detail: viol("deadline").length ? msg("deadline") : `Arrives ${hm(arrival)} · needed by ${hm(goal.arriveBy)}` });
  if (c.noOvernight) rows.push({ k: "overnight", ok: !viol("overnight").length, label: viol("overnight").length ? "Overnight travel required" : "No overnight travel",
    detail: viol("overnight").length ? msg("overnight") : violationLabel.overnight });
  (["route", "hotel"] as const).forEach(k => { if (viol(k).length) rows.push({ k, ok: false, label: `${violationLabel[k]} violated`, detail: msg(k) }); });
  return rows;
}

export function RecoveryResultView({ trip, result, candidates, selectedId, onRestart }: {
  trip: Itinerary; result: RecoveryResult; candidates: RecoveryCandidate[]; selectedId?: string; onRestart: () => void;
}) {
  const cur = trip.currency;
  const diffs = Object.fromEntries(result.itinerary.map(b => [b.id, diffOf(b, trip.bookings, result.affectedBookingIds)])) as Record<string, Diff>;
  const legs = result.itinerary.filter(b => b.kind !== "hotel");
  const arrival = legs[legs.length - 1]?.end;
  const route = cities(result.itinerary);
  const checks = constraintChecks(trip, result);

  return (
    <Section id="result" kicker="05 · Result" tone="success"
      title={<span className="flex items-center gap-4"><StatusMark status="done" size={44} label="Recovery feasible" />Journey repaired</span>}>
      <p className="max-w-2xl text-[17px] text-ink2">
        <span className="text-ink">{result.changes} booking change{result.changes === 1 ? "" : "s"}</span> · extra cost <span className="text-ink">{formatMoney(result.extraCost, cur)}</span>
        {arrival && <> · arrives <span className="text-ink">{hm(arrival)}</span></>}. Everything else stays as booked.
      </p>
      <RepairTimeline />
      <BorderGlow className="hidden rounded-[18px] border border-line bg-surface/60 p-5 shadow-l2 sm:block md:p-8">
        <RecoveryPath cities={route} label={`Repaired route: ${route.map(placeName).join(" to ")}`} />
      </BorderGlow>
      <div className="space-y-6">
        <h3 className={H3}>Repaired itinerary</h3>
        <JourneyBand bookings={result.itinerary} currency={cur} diffs={diffs} reveal />
        <WhatChanged original={trip.bookings} repaired={result.itinerary} diffs={diffs} />
      </div>
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <h3 className={H3}>Why this recovery is valid</h3>
          <ul className="mt-3 divide-y divide-line">
            {checks.map((x, i) => <SpringCheck key={x.k} ok={x.ok} label={x.label} detail={x.detail} delay={0.15 + i * 0.1} />)}
          </ul>
        </div>
        <div>
          <h3 className={H3}>How it was chosen</h3>
          <p className="mt-3 text-[17px] leading-relaxed text-ink2">{result.explanation}</p>
          <p className="mt-3 text-[14px] text-muted">Selection order: fewest changed bookings, then lower extra cost, then candidate ID.</p>
        </div>
      </div>
      <RecoveryComparison candidates={candidates} selectedId={selectedId} trip={trip}
        heading="Alternatives compared" intro="Every candidate Sutra evaluated, checked against the same constraints. The selected recovery is highlighted." />
      <Btn variant="ghost" onClick={onRestart}><RotateCcw aria-hidden className="size-4" />Start over</Btn>
    </Section>
  );
}

export function NoFeasibleView({ result, candidates, trip, onRestart }: { result: RecoveryResult; candidates: RecoveryCandidate[]; trip: Itinerary; onRestart: () => void }) {
  const byKind = new Map<string, { bookingId: string; message: string }[]>();
  result.violations.forEach(v => byKind.set(v.kind, [...(byKind.get(v.kind) ?? []), v]));
  return (
    <Section id="result" kicker="05 · Result" tone="warn"
      title={<span className="flex items-center gap-4"><CircleSlash aria-hidden className="size-10 text-warn" />No feasible recovery</span>}>
      <div role="alert" className="sutra-card rounded-[18px] border border-warn/50 bg-elevated p-6 shadow-l2 md:p-8">
        <p className="max-w-2xl text-[17px] text-ink">The traveller&rsquo;s constraints cannot all be met with the alternatives available. Sutra is not presenting any candidate as a recovery.</p>
        <div className="mt-6 space-y-5">
          {[...byKind.entries()].map(([k, vs]) => (
            <div key={k}>
              <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-warn">{violationLabel[k as keyof typeof violationLabel]}</p>
              <ul className="mt-1 space-y-1 text-[15px] text-ink2">{vs.map(v => <li key={v.message}><span className="font-mono text-[13px] text-muted">{v.bookingId}</span> · {v.message}</li>)}</ul>
            </div>
          ))}
        </div>
        <p className="mt-6 flex items-center gap-2 text-[15px] text-ink"><PhoneCall aria-hidden className="size-4 text-warn" />Next step: hand this journey to a human travel agent.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Btn variant="neutral" onClick={() => document.getElementById("trip")?.scrollIntoView({ behavior: "smooth" })}><ArrowRight aria-hidden className="size-4" />Review constraints</Btn>
        <Btn variant="ghost" onClick={onRestart}><RotateCcw aria-hidden className="size-4" />Start over</Btn>
      </div>
      <RecoveryComparison candidates={candidates} trip={trip}
        heading="Why no alternative works" intro="Each candidate below violates at least one constraint, so none is offered as a recovery." />
    </Section>
  );
}
