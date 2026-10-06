# Sutra frontend rebuild — implementation notes

## Component classification (per 02_UI_DESIGN_SPEC §13 and 05_TECHNICAL_RULES §13)

`core-sutra-ui.md` supplied **install/usage info only** for almost every component (the demos import files that are not in the document, and the shadcn registries are not reachable from the build sandbox). Only Skiper 17 and Skiper 19 include source, and both are marketing demo pages. Nothing below claims original library source was integrated.

| Component (from core-sutra-ui.md) | Classification | Where it is rendered |
|---|---|---|
| Tracing Beam | SUTRA-NATIVE (pattern only) | `components/sutra/kit.tsx` → wraps the workflow in `app.tsx` (scroll-linked beam + node on the left rail) |
| Status Mark | SUTRA-NATIVE | header phase indicator, dock, impact chain, recovery activity, result headline, alternatives rows |
| Spring Check | SUTRA-NATIVE | "Constraint status" list in `RecoveryResultView` (data-driven from `result.violations`) |
| Thought Line | SUTRA-NATIVE | `RecoveryAnalysis` — fixed, user-facing workflow stages only (no reasoning text) |
| Floating Dock | SUTRA-NATIVE | workflow stage dock + primary next action (`app.tsx`) |
| Progressive Blur | SUTRA-NATIVE (source not provided) | top edge under the header (`app.tsx`) |
| Text Loop | SUTRA-NATIVE (source not provided) | hero headline word loop (`sections.tsx` → `Hero`) |
| Parallax Hero Images | SUTRA-NATIVE variation | hero route arcs with pointer parallax (SVG layers, no images, no external assets) |
| Skiper 19 (scroll-progress stroke) | ADAPTED (technique from supplied demo source) | `recovery-path.tsx`: `useScroll → useTransform → motion.path pathLength`; geometry, tokens and nodes are Sutra's; uses `motion/react` instead of `framer-motion` |
| Skiper 17 (sticky cards) | SOURCE PROVIDED — NOT USED | needs gsap + @gsap/react + lenis; not justified for this flow (spec: optional) |
| Scroll Stack, Scroll Expand, Swipe Toast, Target Cursor, Terminal, Kinetic Text, Text Shimmer, Toolbar Dynamic, Flex Carousel, Chroma Grid, Side Rays, Particles, Meteors, Globe, Pin, others | NOT USED | Alternatives use a plain expandable list; no toast; no custom cursor. Avoids "component soup" (05 §15) |

GSAP and Lenis were **not** added (05 §8: only when justified). No new runtime dependencies were added beyond the existing stack; ESLint was added as a dev dependency.

## What was rebuilt
- New UI layer in `components/sutra/` (`app.tsx`, `sections.tsx`, `journey-band.tsx`, `recovery-path.tsx`, `kit.tsx`); the old `components/sutra*.tsx` card UI is gone.
- Design tokens registered in Tailwind `@theme` (token-named utilities such as `bg-surface`, `text-ink2`, `border-line`); fonts wired through `next/font` variables (this also removes the earlier `.font-mono` precedence ambiguity).
- Type scale per spec (H1 clamp 44→88px, H2 32→56px, body 16–18px), radius/shadow tokens, atmospheric gradient, glass used only on the dock.
- Journey is a connected band (cities as nodes, legs as lines). A disruption interrupts the leg in place (dashed danger line, old time struck through, new time, downstream legs flagged).
- Impact chain: Disrupted booking → Immediate effect → Downstream booking → Constraint impact, revealed sequentially.
- Result hierarchy: status → repaired path → repaired itinerary → constraint status → explanation → alternatives.
- `NO_FEASIBLE_RECOVERY` (amber, violated constraints grouped by kind with booking ids, human next step, no success styling) and `TECHNICAL_ERROR` (red, Retry) are visually distinct.
- Preserved: `/api/*` route handlers, `lib/engine.ts`, `lib/mock.ts`, `lib/api.ts`, `hooks/use-recovery-flow.ts` (improved).
- Fixed from the previous handoff: `day()` timezone bug (no more `Date` round-trip), StrictMode error-scenario race (retry counter is state-driven), "Start over" link/scenario drop, hardcoded constraint list (now derived from `result.violations`), `.font-mono` precedence.

## Polish pass (second iteration)
- **Recovery comparison** (`comparison.tsx`): side-by-side decision surface. Every candidate shows feasibility (Selected / Feasible / Infeasible), changed bookings (replaced + new ids), extra cost, arrival, and connection / budget / deadline status with the actual violation text, plus affected bookings. The selected recovery is raised, bordered and larger. Values come from candidate data; nothing is hidden behind interaction (only the optional itinerary preview is). In the no-feasible state the same surface explains why each alternative fails.
- **View affected bookings** (`affected.tsx`): inline toggle in the Disruption section. Lists each affected booking with the reasons from the impact analysis data; "Show in journey" highlights and scrolls to that booking in the existing journey band (`#trip-booking-<id>`). No route, no separate page.
- **Recovered-journey transition** (`repair-diff.tsx`, `journey-band.tsx`, `result.tsx`): a four-step repair sequence (Journey broken → Impact traced → Recovery selected → Journey repaired), scroll-drawn route, left-to-right staggered reveal of the repaired band with a one-time pulse on NEW legs, a legend, and an explicit before/after list (Replaced / Unchanged / Changed / New / Affected). Motion only; reduced motion shows everything immediately.
- **Constraint explanation** (`result.tsx`): each line is derived from `result.violations` and the repaired itinerary (budget used vs limit, actual layovers, actual arrival vs deadline). A violated constraint shows its real violation message instead of a success line. The 60-min and 23:00–05:00 figures are the prototype rules from the spec.
- **Accessibility fixes found by testing:** focus is lost when an activated button unmounts → focus now moves to the new section heading after each workflow step; informational text that failed AA on the soft surface → `--muted` lightened slightly from #7D8B84 to #8A9890; pending-step and "Demo" labels no longer use the disabled-grade `--faint` token.
- **Responsive fixes found by testing:** the horizontal journey band was cramped at 768–820px → horizontal layout now starts at 1024px (`lg`), vertical below; comparison list counted a delayed booking as a "change" → it now lists replaced/new bookings only; impact-chain connectors stopped short → now span the full gap.
- **Components deliberately NOT added:** Swipe Toast (the flow already scrolls to and focuses the result, so a toast would duplicate it), Scroll Expand (the explanation is short; no hierarchy gain), Skiper 17 (the comparison is clearer as a static side-by-side surface than a sticky stack; would need gsap + lenis). GSAP and Lenis were not added.

## Verification actually performed (sandbox)
- `npm run typecheck`: clean. `npm run lint` (eslint, next/core-web-vitals + next/typescript): clean.
- `npm run build`: succeeds **with the `next/font/google` import stubbed** (the sandbox cannot reach Google Fonts). Run it on your machine with the real layout.
- Headless Chromium, production build, all four scenarios end to end (delay, cancellation, infeasible, error→Retry), plus delay/infeasible at 390px and delay with reduced motion: all complete; no horizontal overflow; no console errors apart from the intentionally simulated 503 in the error scenario. `next dev` (React StrictMode) also verified for the error scenario.
- **Responsive:** full flow + no-feasible + technical-error at 390, 768, 820, 1024, 1280 and 1440px: horizontal overflow 0 at every stage and width; floating dock inside the viewport at every stage and width. Screenshots inspected: hero, disrupted journey (390/768/1024), impact chain, recovery comparison (390/1280), repaired journey (390/1280), no-feasible (1280).
- **Accessibility (executed, not assumed):** axe-core (WCAG 2A/AA + best practice) at eight states (trip, disruption with affected panel open, impact, recovery analysis, result, result with itinerary preview open, no-feasible, technical error): 0 violations. Keyboard-only walkthrough of the whole flow using Tab/Enter/Space: every step reachable and operable; every focused element showed a visible focus ring; focus moves to the new heading after each step. Structure: 1 h1, header/main/nav/footer landmarks, no unnamed buttons, `lang="en"`. Reduced motion: hero word loop static, no infinite animations running, scroll behaviour `auto`, repair sequence rendered immediately. Contrast ratios computed for all text tokens on all surfaces (informational text ≥ 4.5:1; `--faint` #52615A is used only for disabled dock items).
- The axe/screenshot runs used a stub layout with a `<title>`; the real `app/layout.tsx` exports `metadata.title`.

## Not verified / remaining
- Real-fonts rendering (Instrument Sans / Inter / IBM Plex Mono): all screenshots used fallback fonts, so line breaks may differ slightly.
- No screen-reader (NVDA/VoiceOver) session; axe + keyboard + structure checks only. No Firefox/Safari run (Chromium only). No touch-device test.
- The headless runs cannot judge animation *feel*; motion was verified functionally (it runs, it respects reduced motion), not aesthetically in real time.
- Sutra-native components approximate the named patterns; they are not library originals (see classification table).
- Backend-dependent: request bodies are still `{ scenario }` and `/api/recovery` returns `{ result, selectedId }` (envelope backend-owned/TBD); candidates' `affectedBookingIds` and violation texts are hand-authored mock data; the simulator decides feasibility. `ApiError.code` is a required union here while the contract allows `code?: string; status?: number`.
- Search stages 2–4 are fixed-duration presentation steps (stages 0–1 follow real calls).
- Hotel shows "Affected" in the repaired itinerary because its booking was affected (times unchanged).
- Extra scenarios `infeasible` and `error` go beyond the two scenarios named in the spec. Scenario E from the data contract ("no downstream impact") is not built.
- `--muted` deviates slightly from the spec token (#7D8B84 → #8A9890) for AA contrast.
- Round 1 deliverables (PPT, GitHub link, demo video) are not part of this codebase.
- Attribution: footer notes patterns inspired by Aceternity UI / React Bits / Motion Primitives / Skiper UI and the adapted Skiper 19 technique.
