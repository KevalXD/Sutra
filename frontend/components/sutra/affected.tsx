"use client";
import { useId, useState } from "react";
import { useReducedMotion } from "motion/react";
import { ChevronDown, Crosshair } from "lucide-react";
import type { DisruptionAnalysis, Itinerary } from "@/lib/types";
import { hm } from "@/lib/format";
import { placeName } from "@/lib/places";
import { StatusMark } from "./kit";

export const IMPACT_LABEL: Record<string, string> = {
  delay: "Disrupted booking", cancel: "Disrupted booking", connection: "Immediate effect", route: "Immediate effect",
  hotel: "Downstream booking", deadline: "Constraint impact", overnight: "Constraint impact", budget: "Constraint impact",
};

/** Lists the affected bookings with the reason each is affected (from the impact analysis data) and
 *  highlights the matching booking in the journey above. No route, no separate page. */
export function AffectedBookings({ analysis, trip, highlightId, onHighlight }: {
  analysis: DisruptionAnalysis; trip: Itinerary; highlightId?: string; onHighlight: (id?: string) => void;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const ids = [analysis.disruption.bookingId, ...analysis.affectedBookingIds.filter(i => i !== analysis.disruption.bookingId)];

  const show = (id: string) => {
    const next = highlightId === id ? undefined : id;
    onHighlight(next);
    if (next) document.getElementById(`trip-booking-${id}`)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  };

  return (
    <div>
      <button type="button" aria-expanded={open} aria-controls={panelId}
        onClick={() => { setOpen(o => !o); if (open) onHighlight(undefined); }}
        className="inline-flex items-center gap-2 rounded-[10px] border border-line-strong px-4 py-2.5 text-[15px] text-ink2 transition hover:bg-soft hover:text-ink">
        <Crosshair aria-hidden className="size-4" />View affected bookings
        <span className="rounded-full bg-soft px-2 font-mono text-[12px] text-ink">{ids.length}</span>
        <ChevronDown aria-hidden className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul id={panelId} className="mt-4 max-w-3xl divide-y divide-line rounded-[14px] border border-line bg-surface/70">
          {ids.map(id => {
            const b = trip.bookings.find(x => x.id === id);
            const reasons = analysis.impact.filter(s => s.bookingId === id);
            const active = highlightId === id;
            return (
              <li key={id} className={`p-4 ${active ? "bg-soft/60" : ""}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <StatusMark status={id === analysis.disruption.bookingId ? "error" : "warning"} size={20} label={id === analysis.disruption.bookingId ? "disrupted" : "affected"} />
                  <span className="font-mono text-[13px] text-ink">{id}</span>
                  <span className="text-[15px] text-ink2">
                    {b ? (b.kind === "hotel" ? `Hotel · ${placeName(b.dest)} · check-in ${hm(b.start)}` : `${placeName(b.origin)} → ${placeName(b.dest)} · ${hm(b.start)}–${hm(b.end)}`) : ""}
                  </span>
                  <button type="button" aria-pressed={active} onClick={() => show(id)}
                    className="ml-auto rounded-[10px] border border-line-strong px-3 py-1.5 text-[13px] text-ink2 hover:bg-soft hover:text-ink aria-pressed:border-warn aria-pressed:text-warn">
                    {active ? "Hide in journey" : "Show in journey"}
                  </button>
                </div>
                <ul className="mt-2 space-y-1 pl-8 text-[15px]">
                  {reasons.map((r, i) => (
                    <li key={i} className="text-ink2"><span className="font-mono text-[12px] uppercase tracking-wide text-muted">{IMPACT_LABEL[r.reason]} — </span>{r.text}</li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
