# Testing-OneDirectBuy

Playwright E2E automation for **OneDirectBuy**.

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
npm run test:smoke       # Login.spec.js
npm run test:cart        # Cart.spec.js
npm run test:headed      # headed browser
npm run test:ui          # Playwright UI mode
```

## Structure

```
tests/
  OneDirectBuy/      # specs + seller.csv
  helpers/           # auth, nav, seller, address helpers
  fixtures/          # uiAwareTest.js
lib/                 # shared framework utilities
reporters/           # custom Playwright reporters
docs/                # flow docs + CI secrets
```

**Website flows:** see [docs/ONEDIRECTBUY_FLOWS.html](docs/ONEDIRECTBUY_FLOWS.html) (interactive HTML) or [docs/ONEDIRECTBUY_FLOWS.md](docs/ONEDIRECTBUY_FLOWS.md) for the full catalog of storefront journeys (actors, steps, routes, automation mapping).

## Deploy

| Role | URL |
|------|-----|
| UI | https://onetest.onechanneladmin.com |
| Backend / API | https://dev-onetest.onechanneladmin.com |

Same GKE Deployment (`onetest`). See **[DEPLOY.md](./DEPLOY.md)**.

```bash
gcloud builds submit --config=cloudbuild.yaml --project=gentle-epoch-277301 .
kubectl apply -f <onechanneladmin-latest>/deploymentsAll/ui/deployment-onetest.yaml
```

## CI

GitHub Actions (`.github/workflows/playwright.yml`) runs on push/PR to `main`, `master`, or `develop`.

- **Browser:** Chromium only (no Firefox/WebKit)
- **Speed:** `CI_FAST=1` — 4 workers, 1 retry, no video, traces only on retry, lean reporters
- **Failures fail the job:** the runner exits with Playwright's exit code. UI mismatches are still recorded in `ISSUES.md` with markers (`[MISSING-ELEMENT]`, `[STRICT-MODE]`, …)
- **Reports:** `reports/<timestamp>/` (HTML + `ISSUES.md` + summary) uploaded as one artifact
- **Soft pass (opt-in, default off):** `CI_SOFT_PASS=1` forces exit 0 even when tests fail — use only for exploratory runs, never as the gating check
- **Target:** `BASE_URL` defaults to `https://dev.onedirectbuy.com`. Production is refused unless `ALLOW_PROD=1`, and then only the read-only specs in `ci-tests.config.json → productionReadOnly` run

**Control which specs run:** edit `ci-tests.config.json` — set `"enabled": false` to skip a file in the default `regression` suite.

| Suite | Command | What runs |
|-------|---------|-----------|
| `regression` (push default) | `npm run test:regression` | files with `enabled: true` |
| `smoke` | `npm run test:smoke` | files listed in `suites.smoke` |
| `all` | `npm run test:all` | every file in `tests[]` |
