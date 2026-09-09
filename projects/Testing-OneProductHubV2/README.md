# Testing-OneProductHubV2

Playwright E2E automation for **One Product Hub V2**.

## Setup

```bash
npm ci
npx playwright install
copy .env.example .env
```

Edit `.env` with credentials. Never commit `.env`.

## Run

```bash
npm test                 # full suite
npm run test:smoke       # admin / brand / client login
npm run test:headed      # headed browser
npm run test:ui          # Playwright UI mode
npm run test:flow        # enabled flows from flows.config.json
npm run test:flow:smoke  # flow 1 only (three logins)
```

## Flow Control UI (step progress)

Specs are marked with `soft("OPH-…", "title", fn)` so the local flow runner can show live **X / Y steps** progress.

```bash
npm run extract-flow-steps   # rebuild server/data/flow-steps.json from soft() markers
npm run server               # http://127.0.0.1:3847/
```

1. Open the UI, pick a flow, click **Run flow**.
2. Watch the live panel: `stepsCompleted / stepsTotal` and per-step status.
3. Toggle flows in [`flows.config.json`](flows.config.json).

Uses MongoDB when available (`MONGODB_URI`); otherwise starts an in-memory MongoDB automatically.

Optional env (see `.env.example`):

- `PORT=3847`
- `STATUS_API_URL=http://127.0.0.1:3847`
- `MONGODB_URI` / `MONGODB_MEMORY=1`

## Structure

```
tests/
  OneproducthubV2/   # specs (soft() step markers)
  helpers/           # V2 auth, nav, capture, softCheck, statusApi
  fixtures/          # oneProductHubV2Test.js (+ soft fixture)
server/              # Express flow control plane + UI
flows.config.json    # local flow grouping
docs/                # website flow documentation
lib/                 # shared framework utilities
reporters/           # custom Playwright reporters
```

**Website flows:** open [docs/ONEPRODUCTHUB_FLOWS.html](docs/ONEPRODUCTHUB_FLOWS.html) (interactive) or [docs/ONEPRODUCTHUB_FLOWS.md](docs/ONEPRODUCTHUB_FLOWS.md) for the full Guest / Brand / Client / Admin journey catalog.

## CI

GitHub Actions workflow: `.github/workflows/playwright.yml` (smoke / regression).
