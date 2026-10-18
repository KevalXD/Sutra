"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import type { ConstraintOverrides, ConstraintSet, RecoveryPriority } from "@/lib/domain/types";
import type { Itinerary } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { Btn } from "./sections";

const timestampForInput = (value: string) => value.slice(0, 16);
const timestampForApi = (value: string) => `${value}:00`;

function defaultsFrom(trip: Itinerary): Required<Omit<ConstraintOverrides, "priority">> {
  return {
    latestArrivalAt: trip.constraints.mustBeAt?.[0]?.arriveBy ?? "",
    maxExtraBudget: trip.constraints.maxExtraBudget,
    noOvernight: Boolean(trip.constraints.noOvernight),
  };
}

/** Form state only; the server remains the sole authority for feasibility. */
export function TravellerConstraints({ trip, defaults, effectiveConstraints, appliedPriority, busy, onRecalculate }: {
  trip: Itinerary; defaults: Itinerary; effectiveConstraints: ConstraintSet; appliedPriority?: RecoveryPriority; busy: boolean; onRecalculate: (overrides: ConstraintOverrides) => Promise<boolean>;
}) {
  const original = defaultsFrom(defaults);
  const [arrival, setArrival] = useState(timestampForInput(original.latestArrivalAt));
  const [budget, setBudget] = useState(String(original.maxExtraBudget));
  const [noOvernight, setNoOvernight] = useState(original.noOvernight);
  const [priority, setPriority] = useState<RecoveryPriority | "">("");
  const [error, setError] = useState<string>();
  useEffect(() => {
    const next = defaultsFrom(defaults);
    setArrival(timestampForInput(next.latestArrivalAt)); setBudget(String(next.maxExtraBudget)); setNoOvernight(next.noOvernight); setPriority(""); setError(undefined);
  }, [defaults]);
  const submit = async (restore = false) => {
    const values: ConstraintOverrides = restore ? original : { latestArrivalAt: arrival ? timestampForApi(arrival) : "", maxExtraBudget: Number(budget), noOvernight, ...(priority ? { priority } : {}) };
    if (!values.latestArrivalAt || typeof values.maxExtraBudget !== "number" || !Number.isFinite(values.maxExtraBudget) || values.maxExtraBudget < 0) {
      setError("Enter a valid arrival date and time and a non-negative extra budget."); return;
    }
    setError(undefined);
    const applied = await onRecalculate(values);
    if (restore && applied) {
      setArrival(timestampForInput(original.latestArrivalAt)); setBudget(String(original.maxExtraBudget)); setNoOvernight(original.noOvernight); setPriority("");
    }
  };
  return (
    <section aria-labelledby="traveller-constraints-heading" className="sutra-card mt-8 rounded-[18px] border border-line bg-surface/60 p-5 shadow-l2 md:p-7">
      <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-green-bright">Your travel preferences</p>
      <h2 id="traveller-constraints-heading" className="mt-2 font-display text-[clamp(1.4rem,2.4vw,2rem)] font-semibold">What matters most to you?</h2>
      <p className="mt-2 max-w-3xl text-[15px] text-ink2">Sutra checks every simulated option against these preferences before it recommends anything.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="grid gap-1.5 text-[14px] text-ink" htmlFor="latest-arrival">
          I need to arrive by
          <span className="text-[13px] text-muted">Local journey time</span>
          <input id="latest-arrival" type="datetime-local" value={arrival} onChange={e => setArrival(e.target.value)} disabled={busy} className="rounded-[10px] border border-line bg-bg px-3 py-2 text-ink outline-none focus:border-green-bright focus:ring-2 focus:ring-green/30" />
        </label>
        <label className="grid gap-1.5 text-[14px] text-ink" htmlFor="extra-budget">
          Maximum extra amount I can spend
          <span className="text-[13px] text-muted">Original: {formatMoney(original.maxExtraBudget, trip.currency)}</span>
          <input id="extra-budget" type="number" min="0" max="100000" step="1" inputMode="decimal" value={budget} onChange={e => setBudget(e.target.value)} disabled={busy} className="rounded-[10px] border border-line bg-bg px-3 py-2 text-ink outline-none focus:border-green-bright focus:ring-2 focus:ring-green/30" />
        </label>
        <label className="flex items-center gap-3 rounded-[10px] border border-line bg-bg px-3 py-3 text-[14px] text-ink" htmlFor="no-overnight">
          <input id="no-overnight" type="checkbox" checked={noOvernight} onChange={e => setNoOvernight(e.target.checked)} disabled={busy} className="size-4 accent-green focus:ring-2 focus:ring-green/30" />
          <span><strong className="block font-medium">No overnight travel</strong><span className="text-[13px] text-muted">Prohibit late-night or overnight options</span></span>
        </label>
      </div>
      <fieldset className="mt-5" aria-describedby="recovery-priority-help">
        <legend className="text-[14px] font-medium text-ink">What should Sutra prefer?</legend>
        <p id="recovery-priority-help" className="mt-1 text-[13px] text-muted">Choose what matters most when comparing feasible recovery options. Arrival, budget, connection and overnight constraints still apply.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {(["LOWER_COST", "EARLIER_ARRIVAL"] as const).map((value) => (
            <label key={value} className="flex items-center gap-2 rounded-[10px] border border-line bg-bg px-3 py-2 text-[14px] text-ink">
              <input type="radio" name="recovery-priority" value={value} checked={priority === value} onChange={() => setPriority(value)} disabled={busy} className="accent-green" />
          {value === "LOWER_COST" ? "Prefer spending less" : "Prefer arriving earlier"}
            </label>
          ))}
        </div>
      </fieldset>
      {error && <p role="alert" className="mt-3 text-[14px] text-warn">{error}</p>}
      <p className="mt-4 text-[13px] text-muted">Currently applied by the backend: arrival {effectiveConstraints.latestArrivalAt ? timestampForInput(effectiveConstraints.latestArrivalAt).replace("T", " ") : "none"} · budget {effectiveConstraints.maxExtraBudget === undefined ? "not set" : formatMoney(effectiveConstraints.maxExtraBudget, trip.currency)} · {effectiveConstraints.noOvernight ? "no overnight" : "overnight allowed"}{appliedPriority ? ` · priority ${appliedPriority === "LOWER_COST" ? "lower additional cost" : "earlier arrival"}` : ""}.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Btn onClick={() => submit()} disabled={busy}>{busy ? "Checking options…" : "Find my best travel option"}</Btn>
        <Btn variant="ghost" onClick={() => submit(true)} disabled={busy}><RotateCcw aria-hidden className="size-4" />Restore original constraints</Btn>
      </div>
    </section>
  );
}
