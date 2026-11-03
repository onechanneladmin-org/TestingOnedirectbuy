# Testing-OneChannelAdmin

Playwright E2E automation for **One Channel Admin**.

## Setup

```bash
npm ci
npx playwright install
copy .env.example .env
```

Edit `.env` with credentials. Never commit `.env`.

**Target:** staging (`https://staging-admin.onechanneladmin.com`) by default. `lib/targetGuard.cjs` refuses any other host, such as the live `admin.onechanneladmin.com`, unless `ALLOW_PROD_READONLY=1` is set; then only `login.spec.js` runs, and the order, fulfilment, catalog and CRM write specs never do. On staging runs the browser cannot resolve live `*.onechanneladmin.com` hosts. Guard tests: `npm run test:unit`.

## Run

```bash
npm test                 # full suite
npm run test:smoke       # login.spec.js
npm run test:headed      # headed browser
npm run test:ui          # Playwright UI mode
```

## Structure

```
tests/
  Onechanneladmin/   # specs + loginSteps.js
  helpers/           # oneChannelAdminAuth.js
lib/                 # shared framework utilities
reporters/           # custom Playwright reporters
```

## CI

GitHub Actions workflow: `.github/workflows/playwright.yml` (smoke / regression).
