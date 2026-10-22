# E2E UI/UX testing: hand-over (start here)

Written 2026-10-22. You are taking over the end-to-end UI/UX test work for the 1CA admin and the ODB storefront. Read in this order:
1. **This file:** what exists, what's missing, and what to do first.
2. [`RUNBOOK.md`](./RUNBOOK.md): setup, env files, run commands, adding a flow, troubleshooting.
3. [`E2E-UI-UX-PLAN.md`](./E2E-UI-UX-PLAN.md): the reasoning (test layers, per-step checks, stability rules).

What the client asked for: Playwright runs each main UI flow end to end, with a screenshot and UX checks at every step and popup, and the data behind the screen checked through the API.

## 1. What is already built

| Piece | Where | State |
|---|---|---|
| Per-step check `checkStep()`: screenshot, baseline (`E2E_VISUAL=1`), axe, layout, console/5xx; per-ID result | 1CA: `apps/web/e2e/support/check-step.js`; ODB: `tests/helpers/checkStep.js` + `lib/checkStepCore.js` | ✅ unit-tested; the ODB helper also ran once in Playwright |
| Popup keyboard check (focus trap, Esc closes) | 1CA `check-step.js` → `checkPopupKeyboard` | ✅ |
| ODB API checks after money steps (`readOrder`, `expectMoney`, `expectOrderStatus`) | `tests/helpers/odbApi.js` | ✅ loads; not used by any flow yet |
| Use cases: Google Sheet → MongoDB, results per ID, `/coverage` dashboard, CSV export | `server/` (`npm run server` → `/coverage`) | ✅ integration-tested on a real MongoDB; 992 use cases synced |
| Results reporter (ODB) and upload script (1CA) | `reporters/useCaseResultsReporter.js`; 1CA `e2e/scripts/upload-usecase-results.js` | ✅ |
| Safety: Nexus refused, read-only mode, dev site by default, API token required, Actions manual-only | both repos | ✅ |
| Flow **A1**: 1CA login + menu walk | 1CA `e2e/specs/menu-smoke.spec.js` | ✅ exists |
| Flow **A2**: orders list → details → popups, read-only, desktop + phone | 1CA `e2e/specs/flows/a2-order-details-ux.spec.js` | ⚠️ **never run in a browser** (run it first, see § 3) |
| Flow **B3**: coupons | `tests/OneDirectBuy/Coupons.spec.js` | ⚠️ exists, off in CI until the "SAVE10" coupon bug is fixed |

## 2. What is missing: 15 flows

Use-case IDs per flow: in the sheet, filter the **Flow** column (tabs `Main_v2` and `1CA_Admin_Orders`). The 1CA IDs are listed below.

| # | Flow | Steps (call `checkStep` after each screen or popup) | API check after | Use cases | Prio | Spec file to create |
|---|---|---|---|---|---|---|
| 1 | **E1** full end to end | 1. ODB: add test SKU to cart. 2. Checkout with Stripe test card. 3. Confirmation. 4. 1CA: order appears in the list. 5. Order details. 6. Fulfil. 7. Pick. 8. Pack. 9. Ship (sandbox label or manual tracking). 10. ODB buyer sees shipped + tracking. 11. 1CA: refund one line. 12. ODB buyer sees the refund. 13. 1CA: return after delivery. 14. Receive + restock. | 3: order placed. 4: same lines in 1CA. 9: ODB shipped. 11: refund amount = line total. 14: stock +qty | Main_v2 Flow=E1 (19) + 1CA-UC-002, 009 | P0 | 1CA `e2e/specs/flows/e1-order-to-return.spec.js` |
| 2 | **A3** pick → pack → ship | Fulfil dialog → pick (bin, qty) → pack (box, serials) → Show Rates → Buy Label (sandbox) → Mark In Transit | WMS task qty, stock holds, tracking saved | 1CA-UC-004, 005, 007, 008, 010, 021, 027 | P0 | 1CA `e2e/specs/flows/a3-pick-pack-ship.spec.js` |
| 3 | **A5** refund | Refund one line → over-refund blocked → empty reason blocked → refund details popup | Refund row exists; ODB line = refunded | 1CA-UC-011, 012, 013 | P0 | 1CA `…/a5-refund.spec.js` |
| 4 | **A6** return / RMA | Return dialog → Generate RMA → WMS returns: receive → restock → return details popup | RMA exists; stock +qty; return closed | 1CA-UC-014, 015, 016 | P0 | 1CA `…/a6-return.spec.js` |
| 5 | **B2** ODB checkout | Cart → address → shipping → tax → payment (Stripe test) → confirmation | Order placed; total = cart + tax + shipping | Main_v2 Flow=B2 (30) | P0 | `tests/OneDirectBuy/flows/b2-checkout.spec.js` |
| 6 | **A4** short pick | Pick less than ordered → cancel the remaining line → refund it | Remaining qty, line cancelled, refund amount | 1CA-UC-006 | P0 | 1CA `…/a4-short-pick.spec.js` |
| 7 | **A7** cancel | Cancel before pick (reason → confirm) → cancel after pick → decline a cancel request | Holds released; payment voided/refunded; ODB = cancelled | 1CA-UC-017, 018 | P0 | 1CA `…/a7-cancel.spec.js` |
| 8 | **B4** my orders | Orders list → details → cancel-item popup → return-request popup | Status matches 1CA | Main_v2 Flow=B4 (59) | P0 | `tests/OneDirectBuy/flows/b4-orders.spec.js` |
| 9 | **B0** account | Login → dashboard → profile → address book (add / edit / delete confirm) → logout | Address saved | Main_v2 Flow=B0 (22) | P1 | `…/flows/b0-account.spec.js` |
| 10 | **B1** browse → cart | Home → search → category + filters → product (fitment) → add to cart → cart drawer | Cart qty/price = API | Main_v2 Flow=B1 (108) | P1 | `…/flows/b1-browse-cart.spec.js` |
| 11 | **B5** mobile | B1 + B2 at 390×844 | as B1 / B2 | Main_v2 Flow=B5 (23) | P1 | same specs, phone viewport |
| 12 | **A8** permissions | Low-priv login → order details → refund/cancel/ship hidden or disabled → typed URL shows "no access" | — | 1CA-UC-028 | P1 | 1CA `…/a8-permissions.spec.js` |
| 13 | **B6** B2B buyer | B2B login → org switch → credit/terms checkout → PO | Credit used, and restored on cancel | Main_v2 Flow=B6 (12) | P2 | `…/flows/b6-b2b.spec.js` |
| 14 | **S1** seller | Seller sign-up → brand approval → product create/approve → inventory | Listing visible on storefront | Main_v2 Flow=S1 (66) | P2 | `…/flows/s1-seller.spec.js` |
| 15 | **C1** 1CA CRM | Contacts → leads → companies → tickets | Records saved | CRM tab (244) | P2 | 1CA `…/c1-crm.spec.js` |

`1CA-UC-029`, the UX baseline for every popup, is covered by `checkStep` inside each flow above.

**Not in any flow:** API-only use cases (201, which qa-api in the Onedirectbuy repo covers), SEO (11, the existing storefront SEO smoke), and Not Required/Later (101). The old TestingOnedirectbuy specs mention 303 IDs, but they use `softTest.js`, which passes on failure. Redo each one inside its flow and don't count the old spec as coverage.

## 3. Your first week

1. **Setup** (RUNBOOK § 2): both env files, `npm ci` / `pnpm install`, Chromium. Ask the owner for:
   - the sheet link;
   - the QA admin login, plus its TOTP secret if it has MFA;
   - the test buyer login.
2. **Prove the base works** (RUNBOOK § 3–4):
   - start `/coverage`;
   - run `test:e2e:unit`, then the A1 smoke, then **A2** with `E2E_READ_ONLY=1`;
   - fix the A2 selectors that break. The popups are found by button text today. Set `E2E_ORDER_ID` to an order that shows Refund/Return/Cancel;
   - run `test:e2e:ux-report` and `test:e2e:upload-results`, and check that `/coverage` shows the 1CA results.
3. **UI PR: `data-testid`s** on the order-flow popups, before writing A3–A7. The names are in the sheet, `1CA_Admin_Orders` column M. The files are in `onechanneladmin-latest/apps/web/src/containers/`:
   - `Fulfill/Orders/OrderDetails/`: `NewOrderDetails.js`, `CancelDialog.js`, `RefundDilaog.js`, `ReturnDialog.js`, `ShippingDialog.js`, `TrackingNumbersUI.js`, `FulfillmentDialogs/FullfilmentDialog.js`, `RefundDetailsPopUp.js`, `ReturnDetailsPopUp.js`;
   - `wms/`: `commonPickPackPutDialog.js`, `PickPackScanner.js`, `WMSorders.js`, `WMSReturns.js`.

   Attribute-only changes; never change behaviour. Nexus uses these screens daily.
4. **Build E1**, the flagship. Then A3, A5, A6 and B2, in the table's order.

## 4. Building each flow

1. Sheet: every step has an ID, a **specific Expected Result**, a Priority and the Flow. Then click **Sync sheet** on `/coverage`.
2. Copy the pattern:
   - 1CA: copy `a2-order-details-ux.spec.js`; use `fixtures` + `check-step`.
   - ODB: plain `@playwright/test` + `tests/helpers/checkStep.js`. **Never** use `softTest.js`.
3. After every screen or popup:
   ```js
   await checkStep(page, testInfo, { id, name, health, scope })
   ```
4. After every money or stock step: an API read-back (`odbApi.js`, or qa-api helpers for 1CA).
5. Flows that save data:
   - start with `test.skip(!writable.ok, writable.reason)`;
   - run with `E2E_ALLOW_PROD_WRITES=1` in the test org only;
   - tag what you create with `qaTag(runIdNow(), caseId)`;
   - undo it in `afterEach` / `afterAll`.
6. Run 3 times in a row with no retries. Then upload the results, set the sheet's Automation Status to `Automated`, and tick the flow in § 5 below.

**Done for a flow** means:
- every step has a screenshot, an axe pass and no console errors or 5xx;
- money and stock steps have an API check;
- it passes 3 runs in a row;
- its IDs show **passed** on `/coverage`.

## 5. Progress (update this table as you go)

| Flow | Status | Notes |
|---|---|---|
| A1 | exists | verify on first run |
| A2 | written, not run | fix selectors on first run |
| B3 | exists, off | SAVE10 apply bug |
| E1 | not started | |
| A3 | not started | needs data-testids |
| A5 | not started | needs data-testids |
| A6 | not started | needs data-testids |
| B2 | not started | |
| A4 | not started | |
| A7 | not started | |
| B4 | not started | |
| B0 | not started | |
| B1 | not started | |
| B5 | not started | |
| A8 | not started | needs a low-permission test user |
| B6 | not started | needs a B2B test org |
| S1 | not started | needs a test seller |
| C1 | not started | |

## 6. Rules that don't change

- Live testing in **one test org only**: onedirectbuy `3at1mrm65w3g`. **Never Nexus_Truck_Upgrades.**
- Read-only first. Writes only in the test org, and always clean up afterwards.
- Stripe test mode, EasyPost sandbox.
- Credentials only in gitignored env files. This repo is **public**: no sheet ID, no workbook, no `.env` in git.
- GitHub Actions stay manual. Run locally, one suite at a time.
- 1CA `cicd-prod` deploys the live admin. Test changes go to 1CA `main` only, and the owner releases.
