# Sutra

> **When travel breaks, Sutra repairs the journey.**
>
> A work-in-progress frontend prototype for exploring travel disruption and recovery.

> **Hackathon direction:** Sutra is being realigned to PS 4.1 as a rail-first, whole-trip recovery agent covering transport, accommodation, and destination plans. Read the [product plan](docs/HACKATHON_PRODUCT_PLAN.md) for the target experience, rulebook acceptance checks, and staged migration. The current app is still the flight-based prototype described below; it does not monitor live rail or destination events.

## Check it out on your laptop

You’ll need **Node.js 18.18 or newer** (Node.js 20 LTS recommended) and npm. Check that they’re installed:

```bash
node --version
npm --version
```

### 1. Get the project

If you already have the project files, open a terminal in the project folder. Otherwise, clone the repository and move into it:

```bash
git clone <repository-url>
cd sutra
```

Replace `<repository-url>` with the repository’s clone URL.

### 2. Install dependencies

```bash
npm ci
```

### 3. Start the app

```bash
npm run dev
```

When the server is ready, open **[http://localhost:3000](http://localhost:3000)** in your browser. Leave the terminal running while you explore; press **Ctrl+C** there to stop the server.

> **First run:** An internet connection is needed to fetch the Google Fonts used by the app.

## Try the current prototype scenarios

Open any of these links while the development server is running:

| Scenario | Link | What to expect |
| --- | --- | --- |
| Flight delay | [localhost:3000/?scenario=delay](http://localhost:3000/?scenario=delay) | Follow a delayed journey through its recovery options. |
| Cancellation | [localhost:3000/?scenario=cancellation](http://localhost:3000/?scenario=cancellation) | Explore the cancellation recovery flow. |
| No feasible recovery | [localhost:3000/?scenario=infeasible](http://localhost:3000/?scenario=infeasible) | See how the app explains when no option meets the constraints. |
| Technical error | [localhost:3000/?scenario=error](http://localhost:3000/?scenario=error) | See the error state, then try **Retry**. The retry is expected to succeed. |

These are deterministic, user-triggered prototype scenarios—not live disruption detection. The delay scenario is the default, so opening the base URL starts there too. Use **Start over** in the app to replay a flow.

## Optional AI recommendation providers

The recovery engine always validates feasibility before asking an AI provider for a preference-based recommendation. Without an API key it remains fully functional and truthfully reports `DETERMINISTIC_FALLBACK` (RC-B for the golden delay scenario).

Copy `.env.example` to `.env.local` and configure one server-side provider. `SUTRA_AI_PROVIDER=auto` (or unset) prefers Gemini when `GEMINI_API_KEY` is set, otherwise OpenAI when `OPENAI_API_KEY` is set. Set `SUTRA_AI_PROVIDER=gemini` or `openai` to require that provider; a missing selected key emits a safe server diagnostic and retains deterministic fallback. `SUTRA_GEMINI_MODEL` defaults to `gemini-3.8-flash`; `SUTRA_OPENAI_MODEL` defaults to `gpt-4o-mini`.

Keys are read only by the API route and are never included in browser code or recovery responses. A provider receives only already-feasible candidate facts and returns a strict structured selection; the backend independently checks the candidate and all provider-supplied objective claims, then generates the displayed explanation from verified data. Network, timeout, malformed-output, and validation failures fall back safely. There is no runtime switch from a selected, failing provider to the other provider.

### Opt-in real-provider smoke test

After configuring a provider in `.env.local`, run `npm run test:ai:smoke`. It runs the canonical golden request with `constraintOverrides.priority = "EARLIER_ARRIVAL"` through the same provider selection and recovery pipeline as the API route. It never prints keys or request headers; it emits only the provider/model, safe diagnostic category (if any), and verification result. A successful command proves an AI-labelled RC-A result with matching audit and plan, one feasible selected candidate, and the verified 45-minute-earlier / ₹100-more RC-B comparison. It is intentionally separate from `npm test`.

## Explainable recovery audit

Every successful or no-feasible recovery response includes a backend-authored `decisionAudit`. It records the effective traveller constraints, the decision status and source, the selected candidate when one exists, and each candidate's checked rules and violations. The frontend renders this audit directly, so changing the deadline, budget, or overnight preference triggers a fresh authoritative evaluation instead of a local feasibility guess. Technical failures remain separate from no-feasible outcomes and preserve their error code for retry and diagnostics.

## Check the current changes

From the project folder, run:

```bash
npm run typecheck
npm run lint
npm run build
```

To try the production build locally after it succeeds:

```bash
npm run start
```

Then open [http://localhost:3000](http://localhost:3000).

## What this version is

This is an evolving frontend prototype, not a finished travel service. The current fixtures represent simulated rail journeys and local mock recovery data; they are not live railway schedules or availability. The recovery result includes an interactive journey timeline: original fixture segments are shown separately from validator-provided repaired timings, feasible candidates can be previewed without changing the backend recommendation, and connection checks are shown only when the backend returned them. Missing segment or timing data is explicitly left unavailable. Its `/api/*` routes currently use local mock data so the scenarios can be explored without connecting to an external backend. The API client can be pointed at a backend later with `NEXT_PUBLIC_API_BASE`; leave it unset for the built-in demo.

The interface is designed to work on mobile and desktop. The current product brief, UI and technical specifications are in [`docs/spec/`](docs/spec/), and implementation details and known limitations are in [`IMPLEMENTATION_NOTES.md`](IMPLEMENTATION_NOTES.md).
