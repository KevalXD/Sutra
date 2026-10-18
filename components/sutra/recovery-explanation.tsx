import { Check, CircleSlash, X } from "lucide-react";
import type { DecisionAudit } from "@/lib/domain/types";
import { formatMoney, hm } from "@/lib/format";

const constraintLabel = (kind: string) => ({
  ARRIVAL_DEADLINE: "Arrival deadline",
  MAX_EXTRA_BUDGET: "Extra budget",
  NO_OVERNIGHT: "Overnight travel",
  CONNECTION: "Connection buffer",
}[kind] ?? kind);

/** Renders the backend decision evidence without recalculating feasibility in React. */
export function RecoveryExplanation({ audit, currency }: { audit?: DecisionAudit; currency: string }) {
  if (!audit || !audit.effectiveConstraints) return null;
  const selected = audit.selectedCandidateId ? audit.candidates.find((candidate) => candidate.candidateId === audit.selectedCandidateId) : undefined;
  const source = audit.decisionSource === "AI" ? "AI recommendation (post-validated)" : audit.decisionSource === "DETERMINISTIC_FALLBACK" ? "Deterministic fallback" : "No candidate selected";
  const constraints = audit.effectiveConstraints;
  const constraintSummary = [
    constraints.latestArrivalAt ? `arrival by ${hm(constraints.latestArrivalAt)}` : "no arrival deadline",
    constraints.maxExtraBudget === undefined ? "no extra-budget cap" : `budget ${formatMoney(constraints.maxExtraBudget, currency)}`,
    constraints.noOvernight ? "no overnight" : "overnight allowed",
  ].join(" · ");
  return (
    <section aria-labelledby="recovery-explanation-heading" className="sutra-card rounded-[18px] border border-line bg-surface/60 p-5 shadow-l2 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-green-bright">Decision audit</p>
          <h3 id="recovery-explanation-heading" className="mt-2 font-display text-[clamp(1.4rem,2.4vw,2rem)] font-semibold">
            {audit.status === "RECOVERED" ? "Why this recovery was selected" : "Why no recovery was offered"}
          </h3>
        </div>
        {audit.status === "RECOVERED" ? <Check aria-hidden className="size-7 text-green-bright" /> : <CircleSlash aria-hidden className="size-7 text-warn" />}
      </div>
      <p className="mt-3 text-[15px] text-ink2">Evaluated with the backend-applied constraints: <span className="font-mono text-[13px] text-ink">{constraintSummary}</span>.</p>
      <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.1em] text-muted">Source: {source}{selected ? ` · selected ${selected.candidateId}` : ""}</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {audit.candidates.map((candidate) => (
          <div key={candidate.candidateId} className={`rounded-[12px] border p-4 ${candidate.candidateId === audit.selectedCandidateId ? "border-green bg-green-soft/50" : "border-line bg-bg/40"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[12px] text-muted">{candidate.candidateId}</span>
              {candidate.feasible ? <Check aria-label="Feasible" className="size-4 text-green-bright" /> : <X aria-label="Infeasible" className="size-4 text-danger" />}
            </div>
            <p className="mt-2 text-[14px] text-ink">{candidate.feasible ? "Feasible candidate" : "Rejected candidate"}</p>
            <p className="mt-1 font-mono text-[12px] text-muted">{formatMoney(candidate.extraCost, currency)} · arrives {hm(candidate.finalArrivalAt)}</p>
            <ul className="mt-3 space-y-1 text-[13px] text-ink2">
              {candidate.constraintChecks.map((check) => <li key={`${candidate.candidateId}-${check.kind}-${check.itemId}`} className={check.passed ? "text-ink2" : "text-danger"}>{check.passed ? "✓" : "×"} {constraintLabel(check.kind)}: {check.message}</li>)}
              {!candidate.constraintChecks.length && <li className="text-muted">No hard constraints were evaluated.</li>}
            </ul>
          </div>
        ))}
      </div>
      {audit.status === "NO_FEASIBLE_RECOVERY" && audit.noFeasibleReasons.length > 0 && (
        <div role="alert" className="mt-5 border-l-2 border-warn pl-4 text-[14px] text-ink2">
          <p className="font-medium text-warn">Blocking reasons</p>
          <ul className="mt-2 space-y-1">{audit.noFeasibleReasons.map((reason, index) => <li key={`${reason.itemId}-${reason.kind}-${index}`}>{constraintLabel(reason.kind)} · {reason.message}</li>)}</ul>
        </div>
      )}
    </section>
  );
}
