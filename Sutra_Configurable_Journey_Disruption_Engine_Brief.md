# Sutra Engineering Workstream Brief
## Configurable Journey & Disruption Engine

**Project:** Sutra · DevHack 2026 · PS 4.1 — AI Agent for Travel Disruption Recovery  
**Workstream owner:** Likhith (backend, domain logic, fixtures, API and tests)  
**Parallel workstream:** Teammate (landing page, separate recovery workspace, UI/UX redesign)  
**Prepared:** 18 October 2026  
**Status:** Proposed engineering contract — review with teammate before implementation

> **Purpose:** This document defines the backend capability Likhith will build so the new recovery workspace can accept supported journey and disruption inputs and receive an authoritative recovery result. It is a coordination document for the human team and any coding assistant used on either laptop. It is not a claim that the proposed capabilities already exist.

## 1. Executive decision

Build a **Configurable, Fixture-Backed Journey & Disruption Engine**. Keep Sutra's existing recovery engine, hard-constraint validation, decision audit, journey timeline, optional AI recommendation, deterministic fallback, and four demonstration scenarios. Extend the current scenario-oriented flow so users can choose a supported journey, select an eligible transport item, configure a supported disruption, set their constraints, and trigger a fresh backend evaluation.

The goal is not unrestricted map routing or live railway search. The first version should provide a small, deliberately curated catalogue of simulated journeys and disruption profiles with complete data, dependencies, alternative offers, and testable expected outcomes.

**Product principle:** user inputs should change the backend calculation—not merely change labels or UI state. The frontend must never fabricate alternatives or calculate authoritative feasibility itself.

## 2. Rulebook alignment and project boundary

The DevHack 2026 rulebook's PS 4.1 asks for an AI agent for travel disruption recovery. Its suggested deliverables include a working prototype that detects or simulates disruptions and identifies affected bookings; an AI-driven alternative search and decision flow based on constraints such as budget, timing, or destination; and a recovery itinerary showing proposed changes and traveller actions.

Sutra already has a substantive rail-first recovery pipeline, configurable traveller constraints, candidate validation, decision-audit data, a journey timeline, optional AI recommendation, and deterministic fallback. This workstream improves how a journey and disruption enter that pipeline; it does not replace those pieces.

All current fixture-based rail schedules and recovery offers must remain clearly labelled as **simulated data**. The presence of a journey catalogue does not imply live schedule access, live delay detection, booking integration, or arbitrary route discovery.

## 3. Current baseline verified from the repository

The following reflects source inspection of the shared GitHub `main` branch on 18 October 2026. Confirm the local branch is current before changing code.

- **Framework:** Next.js, React, and TypeScript.
- **Canonical endpoints:** `GET /api/v1/trips/:tripId` and `POST /api/v1/recovery-runs`.
- **Domain model:** `Trip` contains itinerary items, dependencies, and constraints. Item types include transport, accommodation, and activity. The current `TransportMode` union is rail-only.
- **Current golden itinerary:** two connected rail bookings, `RAIL-A` and `RAIL-B`, plus `HOTEL-1` in Mysuru. The fixture's schedule is dated 10 November 2026 and is simulated.
- **Scenario handling:** `lib/domain/fixtures/recovery-scenarios.ts` exposes the delay, cancellation, no-feasible, and technical-error demonstrations. The scenarios mostly reuse the same itinerary structure; the no-feasible case uses a clone with a different trip ID rather than a substantially different route.
- **Recovery coupling:** `runRecovery` currently resolves a scenario and checks that the supplied trip, affected booking, disruption kind, and delay match that supported scenario. Alternatives are taken from the scenario fixture unless an alternative-search dependency is injected.
- **Validation and recommendation:** candidates are validated against constraints and connection rules. The optional AI provider recommends among candidates that have already passed hard-constraint validation; the backend independently validates the recommendation. A deterministic fallback is used if no valid AI recommendation is available.
- **Existing traveller constraints:** latest acceptable arrival, maximum extra budget, and no-overnight preference can be overridden per recovery run without mutating the stored fixture.
- **Existing result presentation:** the UI includes recovery details, the journey timeline, and a backend-authored decision audit. Preserve these capabilities and their current safety behaviour.

Relevant source files to inspect before editing:

- `lib/domain/types.ts`
- `lib/domain/fixtures/golden-rail-delay-01.ts`
- `lib/domain/fixtures/recovery-scenarios.ts`
- `lib/recovery/core.ts`
- `lib/recovery/route-runner.ts` (confirm exact path and current responsibility locally)
- `lib/api.ts`
- `lib/rail-presentation.ts`
- `hooks/use-recovery-flow.ts`
- `components/sutra/traveller-constraints.tsx`
- `components/sutra/journey-timeline.tsx`
- `components/sutra/recovery-explanation.tsx`
- `tests/recovery-api.test.ts`
- `tests/recovery-ui.test.ts`

If local source differs from this description, treat the current source and tests as the source of truth and report the difference before making architectural assumptions.

## 4. The gap this workstream addresses

The app already lets travellers change constraints, but the travel situation itself is still strongly scenario-driven. The current user flow selects a preset outcome; the backend expects a supported scenario combination rather than a general, catalogue-validated journey/disruption request.

That is excellent for repeatable demonstrations, but it limits the central product claim. A judge should be able to select a journey and configure a supported disruption, then see the backend calculate the consequences using that input. A stricter budget or a longer delay should change candidate feasibility because the backend reevaluated the facts—not because the UI switched to a different hard-coded result.

The workstream should turn scenario presets into **reusable demonstration configurations** around a more general, explicitly bounded recovery request model.

## 5. Scope

### 5.1 Must-have for this workstream

1. **Supported journey catalogue.** Expose a small catalogue of fixture-backed journeys. Each catalogue entry must resolve to a real `Trip` fixture with version, items, dependencies, constraints, and simulation metadata.
2. **Journey details remain canonical.** Reuse `GET /api/v1/trips/:tripId` for the selected trip's details. Add a catalogue/list endpoint only if needed by the workspace; prefer a small summary DTO rather than duplicating the full trip model unnecessarily.
3. **Validated disruption input.** Let a caller select an eligible transport booking and choose delay or cancellation only where the catalogue/profile supports it. For delays, validate the configured duration server-side.
4. **Data-driven offer pools.** Resolve simulated alternatives from a backend-owned registry keyed by the supported journey/disruption profile. Do not place candidate arrays in the browser or accept client-supplied candidate facts as authoritative.
5. **Generalized evaluation.** Run impact propagation, candidate construction, hard-constraint and connection validation, optional AI selection among feasible candidates, and deterministic fallback through the existing recovery pipeline.
6. **Preserve constraints.** Reuse current constraint overrides. An AI provider cannot override budget, deadline, overnight, or connection checks.
7. **Preserve outputs.** Keep the existing recovery status, effective constraints, candidates, recommendation source, recovery plan/actions, decision audit, and repaired timings/connection checks available to the current UI.
8. **Keep demo presets.** Existing delay, cancellation, no-feasible-recovery, and technical-error examples must continue to work as named quick-launch demonstrations and regression tests.
9. **At least one genuinely distinct additional journey fixture** after the generalized path works. It must have its own coherent itinerary, dependencies, simulated offers, and expected outcomes—not merely a different ID on a clone of the current route.
10. **Regression coverage and documentation.** Add API/domain tests for supported and unsupported inputs, dependency propagation, constraints, provider fallback, and the legacy scenarios.

### 5.2 Proposed bounded input for the first version

To make the UI feel configurable without promising arbitrary route search, use an explicit supported range controlled by the backend catalogue/profile. A practical starting proposal is delay durations of **30, 60, 90, 120, 150, and 180 minutes** for profiles configured to support delay. Confirm this list with the teammate and implement it as server-side profile data, not as an unvalidated frontend-only rule.

Cancellation does not accept `delayMinutes`. A cancellation is valid only for transport items/profiles that have a defined cancellation offer pool. Unknown trip IDs, unsupported booking IDs, unsupported disruption kinds, invalid duration values, stale versions, and malformed constraint overrides should be rejected with the established API error contract.

A supported delay may make some or all offer candidates infeasible due to connection timing. That is expected; the backend must calculate that outcome. Do not artificially guarantee a feasible result for every input.

### 5.3 One additional fixture: expectations

Add one genuinely different itinerary after the generalization is stable. Prefer a fixture that demonstrates downstream dependencies beyond the current two rail services and hotel—for example, another transport connection plus a time-sensitive activity at the destination. The exact route, dates, timings, and candidate offers should be authored as clearly simulated fixture data and validated for consistency.

The new fixture must make the whole-trip value visible: disruption to one transport item should affect only the downstream items warranted by explicit dependency rules. Preserve unrelated commitments where the domain model says they are unaffected.

## 6. Explicit non-goals

Do **not** build these as part of this workstream:

- Live railway schedule or delay APIs.
- Arbitrary origin/destination route discovery or Google Maps-style routing.
- Claims of live train availability, real-time monitoring, or guaranteed booking.
- Automatic ticket purchase, reservation modification, payment, or hotel booking.
- New login, account, payment, notification, or deployment architecture.
- Frontend redesign, landing page implementation, animation work, or re-layout of recovery result panels. Those belong to the teammate's UI workstream.
- A second recovery engine or client-side feasibility calculation.
- New AI-generated railway timetable facts or alternatives that do not come from the supported offer source.
- Exposing every domain preference in the UI before the selection logic actually implements it. Soft preferences such as `LOWER_COST`, `EARLIER_ARRIVAL`, `FEWER_CHANGES`, and `PRESERVE_ITINERARY` should only be exposed as active controls when they demonstrably influence the real selection policy.

## 7. Target request and evaluation flow

1. The workspace requests the supported journey catalogue.
2. The user selects a catalogue entry; the app loads canonical trip details.
3. The user selects an eligible affected transport item, disruption kind, and supported delay duration if applicable.
4. The user sets hard constraints using the existing constraint controls.
5. The frontend submits the selected inputs to the existing canonical recovery endpoint.
6. The backend validates trip ID/version, booking membership, disruption/profile compatibility, delay duration, and constraint overrides.
7. A backend resolver selects the appropriate simulated offer pool for that journey and disruption profile.
8. The existing impact-analysis logic propagates effects through declared dependencies.
9. The engine builds and validates candidates against timing, budget, overnight, and connection rules.
10. The optional AI provider may recommend among the already-feasible candidates. Its selection is independently validated; on failure or invalid output, deterministic fallback remains active.
11. The backend returns the authoritative recovery status, evaluated candidates, effective constraints, impact, recommendation source, audit, itinerary/plan, and traveller actions using the current response contract wherever possible.
12. The frontend renders only this returned data. It does not invent offers, recalculate candidate feasibility, or claim an AI result when fallback was used.

## 8. API and architecture coordination contract

The following is a **proposal to agree together before implementation**, not a requirement to create a new API if a smaller extension works.

### Catalogue

- Keep `GET /api/v1/trips/:tripId` as the canonical trip-detail endpoint.
- Add `GET /api/v1/trips` (or an equivalently named catalogue route) if the workspace needs to list supported journeys.
- Return a small typed summary for each journey: `tripId`, `version`, display name, origin/destination summary, available transport item identifiers/labels, supported disruption options and delay values, and an explicit `simulated: true` indicator.
- The summary must be generated from or checked against backend-owned fixtures/profiles. Do not maintain a separate hard-coded list in the frontend.

### Recovery request

Extend the existing `POST /api/v1/recovery-runs` path to support a catalogue-validated request for a trip, affected booking, disruption kind, optional supported delay duration, and current `constraintOverrides`.

The current request/domain type includes `scenarioId`, and `runRecovery` currently uses it to resolve an exact scenario. Before changing that schema, inspect all callers and choose a backwards-compatible boundary. Prefer a request DTO for the new workspace that is normalized by the backend into the existing internal `Disruption` type. Legacy preset callers should continue to work while scenario-specific test controls remain server-owned. Do not make the technical-error injection a general uncontrolled user input.

### Response

Keep the current canonical result structure stable unless a demonstrated need requires an optional, backwards-compatible addition. The workspace needs the selected trip context, disruption/impact, candidates (feasibility and violations), `effectiveConstraints`, recommendation/source, `decisionAudit`, recovery plan/actions, repaired timings, and connection checks.

If the UI requires a new field, document it in shared TypeScript types and tests and coordinate the contract before both developers implement it. Avoid frontend duplication of backend profile data.

## 9. Domain rules and integrity safeguards

- **Backend is authoritative.** The browser sends intent; the backend resolves the supported profile and calculates the result.
- **No client-supplied offers.** Do not accept an arbitrary candidate list from the browser as the source of truth.
- **No fake success.** Invalid input is an input error; no feasible candidate is `NO_FEASIBLE_RECOVERY`; an adapter/provider failure follows its established failure/fallback path. Keep these states distinct.
- **Fixture immutability.** Apply constraint overrides and dynamic request values to a clone or per-run context, not the stored fixture. A previous recovery must not mutate the next run's baseline.
- **Dependencies are explicit.** Propagate impact through defined dependency edges. Do not infer that every later commitment is necessarily affected.
- **Connection checks are recomputed.** Calculate buffers against the actual disrupted timing and each candidate's repaired timing. Do not reuse a precomputed `passed` flag when the configured delay changes.
- **Hard constraints always win.** AI can select only among validated feasible candidates. Post-validate all AI output and keep the deterministic fallback.
- **Source labels are truthful.** `AI` only when a valid provider recommendation was accepted; otherwise show `DETERMINISTIC_FALLBACK` or the appropriate no-selection state.
- **Time semantics are stable.** Current timestamps are timezone-less ISO schedule values. Keep them that way across the API and calculations; do not introduce browser timezone conversion or change the actual instants while implementing display formatting. Twelve-hour formatting is a presentation responsibility for the UI workstream.
- **Simulation is disclosed.** Catalogue labels and demo copy should make it clear that route timings and offers are simulated.
- **No arbitrary travel claims.** If there is no supported offer pool or required itinerary data, reject the request or return a precise unsupported-data state. Do not fabricate alternatives.

## 10. Acceptance criteria

### A. Catalogue and validation

- The catalogue lists only journeys that resolve to valid versioned fixtures.
- Selecting a journey loads its real trip items, constraints, and dependencies.
- An unknown trip ID is rejected cleanly.
- An item not present in the selected trip cannot be disrupted.
- A non-transport item cannot be selected for a transport disruption unless the domain model explicitly supports that disruption type.
- Unsupported disruption-kind/duration combinations return a structured validation error.
- Invalid overrides and stale trip versions preserve the current error contract.

### B. Existing golden delay case

- The original 120-minute delay preset continues to behave as before.
- The candidate pool is resolved by the backend profile, not posted by the browser.
- The backend recomputes downstream impact and connection buffers for the current request.
- With deterministic fallback and the original constraints, behaviour remains consistent with the existing fixture/test expectation (RC-B in the current golden fallback case).
- When an AI provider returns a valid selection, the audit truthfully labels it as AI and confirms the chosen candidate is feasible.

### C. Dynamic delay

- Test supported values across the proposed set: 30, 60, 90, 120, 150, and 180 minutes.
- A longer delay changes impact/connection calculations based on the actual duration.
- Candidate feasibility changes when the recalculated connection buffer or another hard constraint is violated.
- No code path merely swaps a preset label while keeping the original delay calculation.

### D. Traveller constraints

- With the current golden offer fixtures, 7:00 PM / ₹500 / no overnight retains the established default behaviour.
- With 8:00 PM / ₹300 / no overnight, RC-C is the sole feasible candidate for the existing golden profile, assuming its current fixture facts are unchanged.
- With 7:00 PM / ₹300 / no overnight, the backend returns `NO_FEASIBLE_RECOVERY` and the actual violations.
- These outcomes are tested against the backend result, not asserted by frontend fixture conditionals.

### E. Cancellation and legacy presets

- The current cancellation demonstration remains functional.
- Cancellation has no delay duration and uses the configured cancellation offer pool.
- The no-feasible demonstration returns no recommended candidate.
- The technical-error demonstration retains its controlled first-failure/retry behaviour.
- Legacy scenario links remain supported until an intentional, reviewed migration is agreed.

### F. Additional journey

- A second journey is genuinely distinct, not a cloned record with only a different ID.
- Its items, timings, dependencies, supported disruption profiles, and offers are internally coherent.
- At least one test proves that its recovery result differs appropriately from the golden route based on its own data.

### G. Quality and regression

- Existing recovery tests remain intact; no tests are weakened to pass.
- `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check` pass (verify actual script names locally).
- The current constraints, journey timeline, decision audit, source labels, cancellation flow, no-feasible flow, and technical retry still work.
- API tests cover both new generalised requests and old preset compatibility.

## 11. Implementation sequence

### Phase 0 — Baseline and contract sync

- Pull/fetch the latest shared `main`.
- Confirm that the current interactive constraints, journey timeline, and decision audit code are present.
- Run the current test, typecheck, lint, and build scripts before editing.
- Review this brief with the UI owner and agree on catalogue-summary fields, disruption inputs, supported delay values, and the additional journey fixture.

### Phase 1 — Catalogue and profile resolver

- Add a backend-owned registry of journey fixtures and supported disruption/offer profiles.
- Add a typed catalogue summary endpoint or service for the workspace.
- Keep trip-detail retrieval canonical.
- Keep legacy scenario presets as adapters over supported profiles where feasible.

### Phase 2 — Generalized request path

- Normalize new workspace input to the internal domain model.
- Validate the request and find its supported offer pool.
- Reuse impact analysis, candidate construction, validation, recommendation, audit, and response projection.
- Ensure delay duration affects impact and connection checks dynamically.
- Do not refactor unrelated presentation components.

### Phase 3 — Additional distinct journey fixture

- Add one independently authored fixture with real dependency edges and simulated offers.
- Validate timestamps, ordering, connection buffers, constraints, and expected outcomes.
- Add tests before presenting it to the UI as selectable.

### Phase 4 — Regression, contract handoff, and PR

- Run all validations and review the complete diff.
- Document catalogue and recovery request/response DTOs.
- Push a feature branch and open a PR; do not merge or deploy directly.
- Give the UI owner a concise integration note with example catalogue and recovery responses taken from real tests.

## 12. Workstream boundaries and collaboration

| Area | Likhith — this workstream | Teammate — UI workstream |
|---|---|---|
| Journey catalogue | Own fixture registry, server validation, typed catalogue response | Render catalogue using API response; do not hard-code authoritative journey list |
| Disruption controls | Own supported booking/kind/duration validation and backend normalization | Build form controls and explain allowed values to user |
| Recovery evaluation | Own impact, offer-pool resolution, candidate validation, audit/source integrity | Submit user intent and render the returned result; no local feasibility logic |
| Traveller constraints | Preserve API/domain semantics and add backend regression coverage | Retain/rework control design and 12-hour display formatting |
| Landing page and overall visual redesign | No changes unless specifically coordinated | Full ownership |
| Journey timeline and decision audit | Preserve response contract and authoritative data | Own visual hierarchy and workspace integration |
| Demo presets | Preserve the four regression presets and server-controlled technical failure | Present them as optional “Try a demo” quick-starts, not the only main workflow |

**Shared rule:** agree on the API contract before either person hard-codes assumptions. If a shared type needs to change, make the change in one branch, communicate the exact fields, and have the other branch consume it rather than duplicating it.

## 13. Git and coding-assistant instructions

- Work on a separate branch: `feat/configurable-journey-disruption-engine`.
- Base from the latest shared `main` only after checking it includes the working constraints, timeline, and audit features. If it does not, stop and agree on the base branch with the team; do not silently use an obsolete base.
- Keep changes focused on domain types, fixtures/profile registry, API request normalization, backend recovery logic, and tests/documentation.
- Avoid changing landing-page or workspace UI files owned by the teammate unless required for shared types; coordinate any such change first.
- Inspect `git status` before creating/switching branches. Preserve existing uncommitted work. Never use destructive cleanup/reset commands to make the branch easier to work with.
- Do not merge into `main` or deploy production directly.
- Do not claim live railway data or successful live AI without observed evidence.
- Before completion, report files changed, actual commands/results, any limitations, branch and commit, and a concise API integration example for the teammate.

### Prompt to the coding assistant

> Implement the workstream described in this document. First inspect the repository and the current Git state; report any mismatch between this brief and the source before assuming an architecture. Preserve all existing working features and legacy demonstration links. Build a backend-owned catalogue/profile resolver, support validated configurable disruptions within explicitly supported profiles, reuse the existing recovery/validation/audit pipeline, add one genuinely distinct journey fixture after the general path is stable, and add meaningful regression tests. Do not build or redesign the landing page/workspace, invent live railway data, accept client-provided offer facts, duplicate feasibility logic in the frontend, or weaken existing tests. Keep the work on `feat/configurable-journey-disruption-engine`; run test, typecheck, lint, build, and `git diff --check`; do not merge or deploy. At completion, provide a truthful implementation report and example responses the UI owner can integrate against.

## 14. Decisions to confirm before coding

Keep this discussion short and resolve these points with the teammate before either branch makes assumptions:

1. **Catalogue DTO:** Which summary fields does the UI need, and which can it obtain from `GET /api/v1/trips/:tripId`?
2. **Delay values:** Is the proposed 30-minute step set from 30 to 180 minutes adequate for the first version, or does the existing data justify a different explicit set?
3. **Additional journey:** Which distinct route and downstream commitment best demonstrates dependency propagation without growing the fixture scope too far?
4. **Public request schema:** Can the new UI request be normalized at the API boundary while preserving legacy scenario callers? Agree the exact DTO before implementation.
5. **Soft preferences:** Keep them out of the configurable UI until the backend's selection policy truly applies them.
6. **Deployment integration:** Merge and verify the backend contract before the UI relies on it in production; use preview deployments for integration testing.

## Definition of done

The workstream is done when a user can select a supported journey and supported disruption, change hard constraints, and obtain a fresh, validated recovery result from the backend; a genuinely distinct second journey is supported; all four legacy demonstrations still work; the current decision audit and timeline consume the same authoritative run; the API contract is documented for the UI owner; all required checks pass; and the change is available in a reviewable feature branch/PR.

**North star:** make Sutra's recovery behaviour respond truthfully to supported user inputs. Do not expand the number of controls faster than the backend's ability to validate what they mean.
