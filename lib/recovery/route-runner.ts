import { recoveryRunOutcome } from "./http";
import { selectRecommendationProvider, type ProviderSelection } from "./provider-selection";

/** Server-only route helper: logs safe provider diagnostics without exposing credentials or request content. */
export async function executeRecoveryRun(body: unknown, selection: ProviderSelection = selectRecommendationProvider()) {
  if (selection.diagnostic) console.warn("[recovery] recommendation provider configuration", { diagnostic: selection.diagnostic });
  else console.info("[recovery] recommendation provider selected", { provider: selection.provider ?? "none", model: selection.model ?? null, configured: Boolean(selection.recommender) });
  return recoveryRunOutcome(body, { recommender: selection.recommender, aiRequired: selection.aiRequired, onRecommendationDiagnostic: (diagnostic) => console.warn("[recovery] recommendation provider fallback", { provider: selection.provider ?? "unknown", model: selection.model ?? null, ...diagnostic }) });
}
