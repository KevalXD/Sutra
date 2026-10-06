"use client";
import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, X } from "lucide-react";
import type { Diff, Itinerary, RecoveryCandidate } from "@/lib/types";
import { day, diffOf, fmtDuration, formatMoney, hm, layovers } from "@/lib/format";
import { placeName } from "@/lib/places";
import { JourneyBand } from "./journey-band";
import { MagicBento } from "./card-effects";

function Row({ label, ok, children }: { label: string; ok?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="flex items-center gap-2 text-[13px] text-muted">
        {ok !== undefined && (
          <span className={`grid size-5 shrink-0 place-items-center rounded-full ${ok ? "bg-green/20 text-green-bright" : "bg-danger/20 text-danger"}`}>
            {ok ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : <X aria-hidden className="size-3.5" strokeWidth={3} />}
            <span className="sr-only">{ok ? "Satisfied" : "Violated"}</span>
          </span>
        )}
        {label}
      </dt>
      <dd className="text-right text-[14px] text-ink">{children}</dd>
    </div>
  );
}

/** Side-by-side decision surface. Every criterion is visible without interaction. All values come from the
 *  candidate data (violations, itinerary, affectedBookingIds); the selected candidate is the engine's selection. */
export function RecoveryComparison({ candidates, selectedId, trip, heading, intro }: {
  candidates: RecoveryCandidate[]; selectedId?: string; trip: Itinerary; heading: string; intro: string;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<string>();
  if (!candidates.length) return null;
  const cur = trip.currency;
  const goal = trip.constraints.mustBeAt?.[0];
  const inspected = candidates.find(c => c.id === open);

  return (
    <div id="comparison" className="scroll-mt-24">
      <h3 className="font-display text-[clamp(1.5rem,2.6vw,2.25rem)] font-semibold">{heading}</h3>
      <p className="mt-2 max-w-2xl text-[16px] text-ink2">{intro}</p>
      <MagicBento className="mt-8 grid items-start gap-5 lg:grid-cols-3">
        {candidates.map((c, i) => {
          const sel = c.id === selectedId;
          const viol = (k: string) => c.violations.filter(v => v.kind === k);
          const diffs = Object.fromEntries(c.itinerary.map(b => [b.id, diffOf(b, trip.bookings, c.affectedBookingIds)])) as Record<string, Diff>;
          const added = c.itinerary.filter(b => diffs[b.id] === "NEW");
          const removed = trip.bookings.filter(o => !c.itinerary.some(r => r.id === o.id));
          const lay = layovers(c.itinerary);
          const isOpen = open === c.id;
          const status = sel ? "Selected recovery" : c.feasible ? "Feasible" : "Infeasible";
          return (
            <motion.li key={c.id}
              initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08, duration: 0.35 }}
              className={`sutra-card rounded-[18px] border p-5 ${
                sel ? "border-2 border-green bg-green-soft/50 shadow-l3 lg:-mt-3 lg:p-6"
                : c.feasible ? "border-line-strong bg-surface shadow-l1" : "border-line bg-surface/60"}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[12px] text-muted">{c.id}</span>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[12px] uppercase tracking-wide ${
                  sel ? "border-green bg-green text-bg" : c.feasible ? "border-green text-green-bright" : "border-danger text-danger"}`}>
                  {c.feasible ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : <X aria-hidden className="size-3.5" strokeWidth={3} />}
                  {status}
                </span>
              </div>
              <p className={`mt-3 font-display leading-snug ${sel ? "text-[22px]" : "text-[19px]"} text-ink`}>{c.label}</p>

              <dl className="mt-4 divide-y divide-line">
                <Row label="Changed bookings">
                  <span className="font-mono">{c.changes}</span>
                  {removed.length > 0 && <span className="block font-mono text-[12px] text-muted">Replaced {removed.map(b => b.id).join(", ")}</span>}
                  {added.length > 0 && <span className="block font-mono text-[12px] text-green-bright">New {added.map(b => b.id).join(", ")}</span>}
                </Row>
                <Row label="Extra cost"><span className="font-mono">{formatMoney(c.extraCost, cur)}</span></Row>
                <Row label="Arrival"><span className="font-mono">{hm(c.arrival)}</span><span className="block font-mono text-[12px] text-muted">{day(c.arrival)}</span></Row>
                <Row label="Connection" ok={viol("connection").length === 0}>
                  {viol("connection").length ? <span className="text-danger">{viol("connection")[0].message}</span>
                    : <span className="font-mono text-[13px]">{lay.length ? lay.map(l => `${placeName(l.city)} ${fmtDuration(l.minutes)}`).join(" · ") : "No connection"}</span>}
                </Row>
                <Row label="Budget" ok={viol("budget").length === 0}>
                  {viol("budget").length ? <span className="text-danger">{viol("budget")[0].message}</span>
                    : <span className="font-mono text-[13px]">+{formatMoney(c.extraCost, cur)} of {formatMoney(trip.constraints.maxExtraBudget, cur)}</span>}
                </Row>
                {goal && (
                  <Row label="Deadline" ok={viol("deadline").length === 0}>
                    {viol("deadline").length ? <span className="text-danger">{viol("deadline")[0].message}</span>
                      : <span className="font-mono text-[13px]">Arrives {hm(c.arrival)} · by {hm(goal.arriveBy)}</span>}
                  </Row>
                )}
                <Row label="Affected">
                  <span className="inline-flex flex-wrap justify-end gap-1">
                    {c.affectedBookingIds.map(id => <span key={id} className="rounded-full border border-warn/60 px-2 font-mono text-[12px] text-warn">{id}</span>)}
                  </span>
                </Row>
              </dl>

              <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? undefined : c.id)}
                className="mt-4 w-full rounded-[10px] border border-line-strong px-4 py-2 text-[14px] text-ink2 transition hover:bg-soft hover:text-ink">
                {isOpen ? "Hide itinerary" : "Inspect itinerary"}
              </button>
            </motion.li>
          );
        })}
      </MagicBento>

      {inspected && (
        <div className="sutra-card mt-6 space-y-4 rounded-[18px] border border-line bg-surface/60 p-5 md:p-6" aria-live="polite">
          <p className={`font-mono text-[12px] uppercase tracking-wide ${inspected.feasible ? "text-green-bright" : "text-danger"}`}>
            {inspected.id} · {inspected.id === selectedId ? "Selected recovery" : inspected.feasible ? "Feasible" : "Infeasible — not a recovery"}
          </p>
          {inspected.violations.map(v => <p key={v.message} className="text-[14px] text-danger">✕ {v.bookingId}: {v.message}</p>)}
          <JourneyBand bookings={inspected.itinerary} currency={cur}
            diffs={Object.fromEntries(inspected.itinerary.map(b => [b.id, diffOf(b, trip.bookings, inspected.affectedBookingIds)])) as Record<string, Diff>} />
        </div>
      )}
    </div>
  );
}
