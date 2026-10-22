# E2E UI/UX testing: runbook (1CA admin + ODB storefront)

**New here? Start with [`HANDOFF.md`](./HANDOFF.md):** what exists, the 15 missing flows and the first week.

How to set up, run, read results and add new flows. Why it's built this way: [`E2E-UI-UX-PLAN.md`](./E2E-UI-UX-PLAN.md).

## 0. What lives where

| Repo | Folder | What |
|---|---|---|
| `onechanneladmin-org/onechanneladmin-latest` | `apps/web/e2e/` | 1CA admin UI flows. Login fixture, Nexus guard, `checkStep()`, the A2 popup walk, results upload. Its README has the details. |
| `onechanneladmin-org/TestingOnedirectbuy` (**public repo**) | `tests/OneDirectBuy/`, `server/` | ODB buyer flows, the flow-control app, and the `/coverage` dashboard (Google Sheet + results in MongoDB) |
| Google Sheet "use cases v2" (private; ask for the link) | tabs `Main_v2`, `1CA_Admin_Orders`, `Backend`, `CRM`, `Mobile_App` | The definition of every use case: ID, priority, expected result, layer, flow. **People edit the sheet; results are written by the tests.** |

## 1. Ground rules (read first)

- **One test org on live: onedirectbuy `3at1mrm65w3g`.** Never Nexus_Truck_Upgrades (`1p0248qcm3j1k401`); the guard refuses it in code.
- **First runs are read-only.** Keep `E2E_READ_ONLY=1`, which blocks every save. Flows that save (refund, return, cancel, ship) need `E2E_ALLOW_PROD_WRITES=1`, and only in that test org.
- **The ODB buyer tests target `dev.onedirectbuy.com` by default.** Production needs `ALLOW_PROD=1`, and then only the read-only specs run.
- **Stripe test mode only** (`sk_test_`, card 4242). A live key stops the run.
- **Credentials only go in the gitignored env files below.** Never put them in code, the sheet or chat. TestingOnedirectbuy is public, so never commit `.env`, the sheet ID or the workbook.
- **GitHub Actions are manual-only.** Nothing runs on push or PR, and the GKE deploy is off. Everything runs on your machine, one suite at a time.

## 2. One-time setup

```bash
# 1CA
cd onechanneladmin-latest && git pull && pnpm install
pnpm --filter onechanneladmin-main-ui exec playwright install chromium

# Testing app
cd TestingOnedirectbuy && git pull && npm ci
npx playwright install chromium
```

### `onechanneladmin-latest/apps/web/e2e/.env.local`

```
E2E_BASE_URL=https://admin.onechanneladmin.com     # or https://devadmin.onechanneladmin.com
E2E_USER_EMAIL=                                    # QA admin, member of the test org only
E2E_USER_PASSWORD=
E2E_USER_TOTP_SECRET=                              # base32 MFA secret; empty if the user has no MFA
E2E_ORG_ID=3at1mrm65w3g
E2E_READ_ONLY=1
# E2E_ORDER_ID=                                    # optional: open this order in A2
USECASE_RESULTS_URL=http://127.0.0.1:3847          # dashboard, for the upload step
USECASE_RESULTS_TOKEN=                             # = API_TOKEN of the dashboard
```

### `TestingOnedirectbuy/.env`

```
API_TOKEN=                         # any long random string: openssl rand -hex 24
USECASE_SHEET_ID=                  # from the sheet link …/spreadsheets/d/<ID>/edit (ask for it)
USECASE_SHEET_TABS=Main_v2:432459085,1CA_Admin_Orders:1049222425,Backend:51140332,CRM:671646867,Mobile_App:1033059754
ONEDIRECTBUY_BUYER_EMAIL=          # test buyer
ONEDIRECTBUY_BUYER_PASSWORD=
# MONGODB_URI=                     # optional; without it the server starts its own local MongoDB (data in server/data/mongo-memory, gitignored)
# USECASE_RESULTS_UPLOAD=1         # send ODB test results to the dashboard after each run
```

The sheet must stay shared as **anyone with the link: Viewer**, because the sync reads its CSV export.

## 3. Start the dashboard

```bash
cd TestingOnedirectbuy && npm run server
```

1. Open `http://127.0.0.1:3847/coverage`.
2. Paste `API_TOKEN` into the **API token** field. It is shared with the Flows page at `/`.
3. You should see 992 use cases (881 in scope).
4. **Sync sheet** pulls the latest sheet edits. **Export results CSV** gives the latest result per ID, to paste into the sheet.

## 4. Run the 1CA tests

```bash
cd onechanneladmin-latest
pnpm --filter onechanneladmin-main-ui test:e2e:unit                         # pure helpers, no browser, ~1s
pnpm --filter onechanneladmin-main-ui test:e2e:ux-report -- --reset          # clear the UX step log
E2E_READ_ONLY=1 pnpm --filter onechanneladmin-main-ui test:e2e:smoke         # login + every menu page
E2E_READ_ONLY=1 pnpm --filter onechanneladmin-main-ui test:e2e:flow          # A2: orders list → details → popups, desktop + phone
pnpm --filter onechanneladmin-main-ui test:e2e:ux-report                     # → apps/web/e2e/.ux/UX-REPORT.md
pnpm --filter onechanneladmin-main-ui test:e2e:upload-results                # → /coverage (needs the server from § 3)
```

Results land in three places:
- **Playwright HTML report:** `apps/web/e2e/playwright-report/` (in CI mode), or the terminal list output. It has a screenshot per step and a trace on failure.
- **UX report:** `apps/web/e2e/.ux/UX-REPORT.md`, listing the issues per step (axe, layout, console errors, 5xx).
- **Dashboard:** `/coverage`, one result per use-case ID.

**The first A2 run will probably need selector fixes.** The popups are found by their button text ("Refund", "Return", "Cancel"…), because there are no `data-testid`s yet. When a popup's button isn't on the chosen order, that popup is recorded as skipped, not failed. Set `E2E_ORDER_ID` to an order that shows the buttons.

## 5. Run the ODB buyer tests

```bash
cd TestingOnedirectbuy
npm run test:unit                 # 30 pure tests
npm run test:integration          # dashboard + real in-memory MongoDB (first run downloads mongod, ~77 MB)
npm run test:coupons              # existing coupon suite (plain test/expect)
# new buyer flows go in tests/OneDirectBuy/flows/ (none yet, see § 6), then:
USECASE_RESULTS_UPLOAD=1 npx playwright test tests/OneDirectBuy/flows --project=chromium --workers=1
```

Every run writes `test-results/usecase-results.json`. With `USECASE_RESULTS_UPLOAD=1` it is also posted to `/coverage`.

## 6. Add a new flow (the repeatable part)

1. **Sheet first.** Add one row per step: an ID (`ODB-UC-…` or `1CA-UC-…`), Priority, **Expected Result** (specific and checkable), Layer and Flow. Click **Sync sheet**.
2. **Create the spec.**
   - 1CA: `apps/web/e2e/specs/flows/<flow>.spec.js`. Copy `a2-order-details-ux.spec.js`, and use `../../support/fixtures` and `../../support/check-step`.
   - ODB: `TestingOnedirectbuy/tests/OneDirectBuy/flows/<flow>.spec.js`. Use plain `@playwright/test` (**not** `softTest.js`) and `../../helpers/checkStep.js`.
3. **After every screen or popup**, call `checkStep`:
   ```js
   await checkStep(page, testInfo, { id: "1CA-UC-011", name: "refund popup", health, scope: ".p-dialog" });
   ```
   It takes the screenshot, runs axe, checks layout and console errors, and records the per-ID result. It uses `expect.soft`, so the flow continues and the test still fails at the end.
4. **After any step that moves money or stock**, read the data back:
   - ODB: `readOrder` / `expectMoney` / `expectOrderStatus` from `tests/helpers/odbApi.js`.
   - 1CA: the qa-api helpers in Onedirectbuy.

   A screen that looks right but saved the wrong numbers must fail.
5. **Write flows:**
   - start with `test.skip(!writable.ok, writable.reason)` (1CA);
   - tag everything you create with `qaTag(runIdNow(), caseId)`;
   - undo it in `afterEach` / `afterAll`.
6. **Stability:**
   - add `data-testid`s for the buttons and fields you use (small UI PR); the names are in the sheet, `1CA_Admin_Orders` column M;
   - no `waitForTimeout`;
   - one test order per flow.
7. **Run it.** Check `/coverage`, then set the sheet's Automation Status to `Automated`.

Flow order from the plan:
- **First:** **E1** (ODB order → 1CA pick/pack/ship → refund → return), **A3** pick/pack/ship, **A5** refund, **A6** return, **B2** checkout.
- **Then:** A4, A7, B3, B4, B0, B1, B5 and A8.

## 7. Troubleshooting

| You see | Fix |
|---|---|
| `/coverage` says "API is off" (503) | Set `API_TOKEN` in `TestingOnedirectbuy/.env` and restart the server. |
| `/coverage` says "Wrong or missing API token" (401) | Paste the same `API_TOKEN` into the token field. |
| Sheet sync: `not shared by link?` | Share the sheet as "anyone with the link: Viewer". Tab gids must match `USECASE_SHEET_TABS` (the gid is in the tab's URL). |
| 1CA login asks for an MFA code | Set `E2E_USER_TOTP_SECRET`, or `E2E_USER_TOTP=<6 digits>` for a single run. |
| "Refusing to run … Nexus" / "not an allow-listed test org" | `E2E_ORG_ID` must be a test org. That refusal is intended. |
| ODB tests: "Refusing to run … production" | Use the dev site, or `ALLOW_PROD=1` for the read-only specs only. |
| An ID shows **blocked** | The test failed at another step. Fix the failing step first. |
| An ID shows **failed** with "flaky" | It passed only on retry. Treat it as a bug in the test or the app. |
| A step reports `axe-unavailable` | Run `npm ci` again; `@axe-core/playwright` is a devDependency. |
| Machine runs out of memory | One suite at a time, `--workers=1`, headless. |
