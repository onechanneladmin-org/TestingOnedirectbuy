# Testing-OneChannelAdmin

Playwright E2E automation for **One Channel Admin**.

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
