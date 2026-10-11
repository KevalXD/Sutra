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

The repository includes a separate backend under `backend/`. The default hackathon demo is reproducible synthetic fixture data: it uses no browser local storage, paid AI key, database, or live railway service. Set `NEXT_PUBLIC_API_BASE=http://localhost:4000` and `NEXT_PUBLIC_TRIP_ID=trip-golden-rail-delay-01` in `frontend/.env`. See [backend/.env.example](backend/.env.example) and [backend/README.md](backend/README.md) for fixture, live-provider, and optional PostgreSQL configuration. Synthetic results are not live schedules, ticket inventory, or booking confirmations.

The interface is designed to work on mobile and desktop. The current product brief, UI and technical specifications are in [`docs/spec/`](docs/spec/), and implementation details and known limitations are in [`IMPLEMENTATION_NOTES.md`](IMPLEMENTATION_NOTES.md).
