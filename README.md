# Sutra

> **When travel breaks, Sutra repairs the journey.**
>
> A work-in-progress frontend prototype for exploring travel disruption and recovery.

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

## Try the demo scenarios

Open any of these links while the development server is running:

| Scenario | Link | What to expect |
| --- | --- | --- |
| Flight delay | [localhost:3000/?scenario=delay](http://localhost:3000/?scenario=delay) | Follow a delayed journey through its recovery options. |
| Cancellation | [localhost:3000/?scenario=cancellation](http://localhost:3000/?scenario=cancellation) | Explore the cancellation recovery flow. |
| No feasible recovery | [localhost:3000/?scenario=infeasible](http://localhost:3000/?scenario=infeasible) | See how the app explains when no option meets the constraints. |
| Technical error | [localhost:3000/?scenario=error](http://localhost:3000/?scenario=error) | See the error state, then try **Retry**. The retry is expected to succeed. |

The delay scenario is the default, so opening the base URL starts there too. Use **Start over** in the app to replay a flow.

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

This is an evolving frontend prototype, not a finished travel service. Its `/api/*` routes currently use local mock data so the scenarios can be explored without connecting to an external backend. The API client can be pointed at a backend later with `NEXT_PUBLIC_API_BASE`; leave it unset for the built-in demo.

The interface is designed to work on mobile and desktop. The current product brief, UI and technical specifications are in [`docs/spec/`](docs/spec/), and implementation details and known limitations are in [`IMPLEMENTATION_NOTES.md`](IMPLEMENTATION_NOTES.md).
