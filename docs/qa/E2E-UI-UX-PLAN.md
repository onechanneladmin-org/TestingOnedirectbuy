# End-to-end UI/UX test plan: 1CA admin and OneDirectBuy

Written 2026-10-20. Companion files:
- **Use cases:** the team's use-case Google Sheet (v2 layout), shared privately, not stored in this public repo. It adds the new columns and the new `1CA_Admin_Orders` tab. The app reads it through `USECASE_SHEET_ID` / `USECASE_SHEET_TABS` in `.env`.
- **Helper code:** the `checkStep()` helper and the first flow spec are on branch `qa/ui-ux-checkstep` in `onechanneladmin-latest`, under `apps/web/e2e/`.

## 1. Goal

The client asked for Playwright to run every main UI flow end to end, with a screenshot and a UX check at each step. Every run produces:
1. **A Playwright HTML report:** each flow, each step, its screenshot, and a video and trace when it fails.
2. **A UX report (`UX-REPORT.md`):** the issues found per step, with links to their screenshots.
3. **A result per use-case ID**, written back to the sheet: Pass, Fail, Skipped with a reason, or Manual.

A flow that looks right but saves the wrong data must fail. So after every step that moves money or stock, the test also reads the order back through the API.

## 2. Ground rules

| Rule | Detail |
|---|---|
| One test org on live | Agreed: live, one org. Set `E2E_ORG_ID` and the qa-api org to it. Default: onedirectbuy `3at1mrm65w3g`, with ODB seller `6a57d091447dc8e81333ca89`. **Nexus_Truck_Upgrades is refused in code.** |
| Writes on live | Only in that org. The 1CA suite needs `E2E_ALLOW_PROD_WRITES=1` for flows that write. The read-only walks run with `E2E_READ_ONLY=1`. |
| Payments | Stripe test mode and the test card (`pm_card_visa` / 4242) only. EasyPost labels in sandbox only. |
| Credentials | Only in gitignored env files, never in chat, code or the sheet: `onechanneladmin-latest/apps/web/e2e/.env.local`, `TestingOnedirectbuy/.env`, `Onedirectbuy/qa-api/.env.local`. |
| Admin MFA | If the admin account has TOTP, put its base32 secret in `E2E_USER_TOTP_SECRET`. Otherwise you must type a fresh code for every run. |
| Where it runs | Not on GitHub for now. Run locally: headless, `--workers=1`, one suite at a time, with nothing else heavy running (low-RAM Mac). Later, optionally on the self-hosted GKE runner, which uses no GitHub minutes. |
| Data hygiene | Everything created is tagged `qa-e2e-<run>-<case>` and undone at the end of the test: cancel, restock, void label. |

## 3. Which test layer covers what

| Layer | Use it for | Tool | Where |
|---|---|---|---|
| API | Money and stock rules, status sync between ODB and 1CA, refund amounts | qa-api scripts | `Onedirectbuy/qa-api` (stays where it is) |
| Popup test | One popup on its own with fake API replies: errors, empty, loading, permission-denied | Jest + React Testing Library | next to the component in the UI repo |
| Playwright flow | 5–8 real journeys across screens and popups, plus the UX checks | Playwright + axe | 1CA: `apps/web/e2e/specs/flows`; ODB buyer: `TestingOnedirectbuy/tests/OneDirectBuy/flows` |
| Manual | Wording, "does this make sense to a user", device-only checks | the person running the release checklist | `docs/qa/manual-test-checklist-*.md` |

The `Layer` column in the sheet says which one covers each use case.

## 4. What happens at every step: `checkStep()`

```js
await checkStep(page, testInfo, { id: "1CA-UC-011", name: "refund popup", health, scope: ".p-dialog" });
```

1. Waits for the page to settle: network idle, spinners gone.
2. Takes a screenshot and attaches it to the report. With `E2E_VISUAL=1`, also compares it with the approved baseline; dates, order numbers and tables are masked.
3. Runs an axe scan (WCAG 2.1 A/AA) on the page or the popup. Serious and critical issues fail the step.
4. Checks the layout: page wider than the screen, buttons off-screen, text cut off, tap targets under 24 px.
5. Fails on browser console errors, uncaught exceptions and 5xx responses seen since the last step.
6. Writes one line per step to `.ux/steps.jsonl`; `ux-report.js` turns that log into `UX-REPORT.md`.

For popups, `checkPopupKeyboard()` also checks that focus stays inside the popup and that Esc closes it.

Steps use `expect.soft`: the flow keeps going, so every step gets its screenshot, and the test **still fails** at the end. That's the difference from the old `softTest.js` wrapper, which passed even when steps failed.

Every flow runs at **1440×900** and **390×844** (phone).

## 5. The flows

The full list is in the `Flows` tab, and every use case points to one flow.

| Flow | What | Priority | Week |
|---|---|---|---|
| **E1** | ODB buyer order → 1CA fulfil (pick, pack, ship) → refund one line → return → the buyer sees each status | P0 | 1 |
| A1 | 1CA login + menu walk (exists: `menu-smoke.spec.js`) | P0 | 1 |
| A2 | Orders list → details → every popup, **read-only** (written: `a2-order-details-ux.spec.js`) | P1 | 1 |
| A3 | Pick → pack → ship (sandbox label) | P0 | 2 |
| A5 | Refund popup: refund a line, over-refund blocked, refund details | P0 | 2 |
| A6 | Return / RMA → WMS receive → restock | P0 | 2 |
| B2 | ODB checkout (card) | P0 | 2 |
| A4, A7 | Short pick → cancel line; cancel before or after pick, and decline a cancel request | P0 | 3 |
| B0, B1, B3, B4, B5 | ODB account, browse → cart, coupons (exists), my orders / cancel / return, mobile | P1 | 3 |
| A8 | Low-permission user: buttons hidden, typed URL shows "no access" | P1 | 3 |
| B6, S1, C1 | B2B buyer, seller onboarding, CRM core | P2 | 4 |

## 6. Making the tests stable

- **`data-testid` on every button and field a flow touches.** Today the order-flow files have **0** of them (see `Popup_Inventory`); the names to add are in `1CA_Admin_Orders` column M. This is the first UI PR, starting with Refund, Return, Cancel, Shipping, Pick/Pack and Tracking.
- **No fixed waits:** wait for the API response or for the element.
- **Each flow creates its own order** and cleans it up afterwards.
- **Retry at most once.** A test that only passes on retry is reported as flaky, not as a pass.
- **Screenshot baselines** are approved once, together with the client, then only changed on purpose.

## 7. Working with the use-case sheet

1. **Use one main tab.** Testers stop keeping personal copies, and record results in `Run By`, `Last Run`, `Merged Tester Result` and `Bug Link`. The workbook has already merged the four personal tabs.
2. **Fill in `Expected Result`.** P0 rows still missing one are highlighted yellow. A case is not "covered" until it has an expected result, a run and a Pass on the latest run.
3. **The ID in code is the use-case ID** (`ODB-UC-201`, `1CA-UC-011`), so the report maps straight back to the sheet.
4. **Cases not automated are recorded as Skipped with a reason**, never left out or faked. The coupon suite (`Coupons.spec.js`) already works this way; copy it.
5. **Rework the existing TestingOnedirectbuy specs as you go.** They cover 303 IDs, but all use `softTest.js`. Their rows say `Needs rework (soft test)`; switch each to plain `test`/`expect` when its flow is built.
6. **Start with `Tester_Fails`.** 64 use cases were marked failed or not working by a tester; 38 of them are P0. Retest them first, because they are the quickest visible wins.

## 8. The first 10 working days

| Day | Work | Done when |
|---|---|---|
| 1 | Put credentials in the three env files. Confirm the org. Merge `qa/safety-fixes` (TestingOnedirectbuy) and `qa/ui-ux-checkstep` (1CA). | `test:e2e:unit` passes; login setup passes once |
| 2 | Run A1 menu smoke and the A2 read-only walk (`E2E_READ_ONLY=1`). Review the first `UX-REPORT.md`. | report has screenshots of the list, details and popups |
| 2–3 | Fill `Expected Result` for the P0 rows used by E1, A3, A5, A6, B2. Retest the 38 P0 `Tester_Fails` by hand. | rows filled; retest results in the sheet |
| 3–4 | UI PR: `data-testid`s for the Refund, Return, Cancel, Shipping, Pick/Pack and Tracking popups. | merged to main |
| 4–6 | Build E1 end to end: ODB checkout → 1CA fulfil → refund → return, with `checkStep` at every step and API checks after the checkout, ship, refund and return steps. | E1 passes 3 runs in a row |
| 7–8 | A3, A5, A6 as separate flows, copied from E1's steps. | pass, screenshots approved |
| 9 | B2 (ODB checkout) in TestingOnedirectbuy, reusing the same step-check pattern. | passes |
| 10 | Walk the client through the report; approve the baselines; agree the week 3 list. | client sign-off |

## 9. Needed from the owner or client

1. The one live org to use (default onedirectbuy `3at1mrm65w3g`) and confirmation that writes are allowed there.
2. Admin login details: put the email, password and TOTP secret in the env file.
3. A test buyer account; the ODB scripts already have one.
4. A low-permission user, for A8.
5. A test SKU that has bin stock in that org.

## 10. Done means

- Every P0 popup has a screenshot baseline, an axe pass, a keyboard check and, where money or stock moves, an API data check.
- E1, A3, A5, A6 and B2 each pass 3 runs in a row with no retries.
- Every P0 use case in the sheet shows Pass, Fail with a bug link, or Skipped with a reason.
- The client has reviewed and approved one full report.
