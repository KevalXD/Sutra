// Server-side deterministic mock of the recovery engine (used by /api route handlers only).
import type { RecoveryResult, ScenarioId } from "./types";
import { analysisFor, candidatesFor, getDisruption } from "./mock";

/** Selection semantics: fewest changed bookings, then lower extra cost, then candidate ID. */
export function recover(s: ScenarioId): { result: RecoveryResult; selectedId?: string } {
  const candidates = candidatesFor(s);
  const ok = candidates.filter(c => c.feasible).sort((a, b) => a.changes - b.changes || a.extraCost - b.extraCost || a.id.localeCompare(b.id));
  if (!ok.length) return { result: { feasible: false, itinerary: [], changes: 0, extraCost: 0, violations: candidates.flatMap(c => c.violations),
    affectedBookingIds: analysisFor(s).affectedBookingIds, explanation: "No feasible repair exists within the available candidate set." } };
  const w = ok[0]; const d = getDisruption(s);
  const what = d.kind === "delay" ? `delayed by ${d.delayMin} minutes` : "cancelled";
  const { id, label, arrival, ...rest } = w; void label; void arrival;
  return { selectedId: id, result: { ...rest, explanation: `${d.bookingId} was ${what}. Candidate ${id} was selected: it needs the fewest booking changes (${w.changes}) among feasible candidates, and all traveller constraints are satisfied.` } };
}
