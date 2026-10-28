# OneDirectBuy + 1CA: end-to-end UI/UX test guide

**Version 1.0 · 2026-10-23.** This is the single reference for checking the existing test scripts, fixing them, and adding the missing flows.

Companion files in `docs/qa/`:
- [`RUNBOOK.md`](./RUNBOOK.md): setup and run commands.
- [`HANDOFF.md`](./HANDOFF.md): short start page.
- [`E2E-UI-UX-PLAN.md`](./E2E-UI-UX-PLAN.md): the reasoning behind this approach.

---

## Contents

1. [Where things stand](#1-where-things-stand)
2. [Rules to keep in mind on every test](#2-rules-to-keep-in-mind-on-every-test)
3. [Audit of the existing scripts](#3-audit-of-the-existing-scripts)
4. [How to fix an existing script](#4-how-to-fix-an-existing-script)
5. [The 18 flows: steps and what to validate](#5-the-18-flows-steps-and-what-to-validate)
6. [Validation checklists (every step, popup, form, money step)](#6-validation-checklists)
7. [Test data and environments](#7-test-data-and-environments)
8. [Formats and templates](#8-formats-and-templates)
9. [Definition of done and review checklist](#9-definition-of-done-and-review-checklist)
10. [Progress tracker](#10-progress-tracker)

---

## 1. Where things stand

| Item | Number | Comment |
|---|---|---|
| Use cases in the Google Sheet | 992 | `Main_v2` 524, `1CA_Admin_Orders` 29, `Backend` 170, `CRM` 244, `Mobile_App` 25 |
| In scope | 881 | The other 101 are marked Not Required or Later |
| P0 use cases with an Expected Result | 108 of 344 (31%) | **Fill the rest before automating them** |
| Existing ODB spec files | 60 | 41 storefront/seller specs + 19 `ux-modules` |
| Use-case IDs mentioned in those specs | 323 | Mentioned is not the same as tested (see § 3) |
| Specs that report a real pass/fail | **1** (`Coupons.spec.js`, off in CI because of the SAVE10 bug) | All the others use `softTest.js`, which records a failure but still passes |
| Flows planned / existing / missing | 18 / 3 / **15** | Existing: A1 (exists), A2 (never run), B3 (coupons) |

**What's already built and tested** (details in `RUNBOOK.md`):
- `checkStep()` for both 1CA and ODB;
- the API read-back helpers (`odbApi.js`);
- the Google Sheet → MongoDB use-case store and the `/coverage` dashboard;
- the results reporter and the 1CA upload;
- the safety guards.

---

## 2. Rules to keep in mind on every test

### 2.1 Safety (not negotiable)
- **One test org on live: onedirectbuy `3at1mrm65w3g`** (ODB seller `6a57d091447dc8e81333ca89`). **Never Nexus_Truck_Upgrades `1p0248qcm3j1k401`.** The guards refuse it; never try to work around them.
- **Read-only first.**
  - 1CA: `E2E_READ_ONLY=1` blocks every non-GET call to the backend. Writes need `E2E_ALLOW_PROD_WRITES=1`, in the test org only.
  - ODB: the dev site by default. Production needs `ALLOW_PROD=1`, and then only the read-only specs run.
- **Payments:** Stripe test mode only (`sk_test_`, card `4242 4242 4242 4242` / `pm_card_visa`). A live key stops the run.
- **Shipping labels:** EasyPost sandbox only.
- **Never create real buyer accounts on production.** Use the fixed test buyer.
- **Never touch a real customer's order, product or stock.** Only use data your test created, or the named test fixtures (§ 7).
- **Credentials only in the gitignored env files.** This repo is public: no passwords, tokens, sheet IDs or workbooks in git.
- **GitHub Actions are manual-only.** Run locally, one suite at a time, `--workers=1`.

### 2.2 Reliability
- **Plain `@playwright/test` only.** Never `softTest.js` / `softCheck.js` in new or fixed specs. A failure must fail the test.
- **Find elements in this order:**
  1. `data-testid`;
  2. role + accessible name (`getByRole('button', { name: 'Refund' })`);
  3. label or placeholder;
  4. a stable class.

  **Never** `nth-child`, long CSS chains or text that changes often.
- **No `waitForTimeout`.** Wait for the element, the URL or the API response (`page.waitForResponse`).
- **Each test creates its own data** (order, cart, address), tags it `qa-e2e-<runId>-<caseId>` and cleans it up afterwards. No test depends on another test's data or order.
- **Retries:** at most 1. A test that passes only on retry is reported as **flaky**, never as a pass.
- **Screenshots** use the same viewports every time: **1440×900** and **390×844**. Animations off, dynamic regions masked (dates, order numbers, counters, Stripe iframes).
- **Never test only that "the page loaded".** Every test asserts the outcome: the record exists, the status changed, the total is right.

### 2.3 Two systems
- An ODB order is synced to 1CA. After every money or stock step, check **both systems** through the API:
  - ODB: order or line status, refunds, tracking, the buyer's view;
  - 1CA: line status, WMS tasks, stock holds and quantities.
- Sync takes time. Poll with a timeout (`expect.poll`, about 60 s); never use a fixed sleep.

### 2.4 What counts as a defect
- **UX:** a serious or critical axe issue, horizontal overflow, a control off-screen, a console error, a 5xx response, a popup that can't be closed with Esc, focus escaping a popup.
- **Functional:** the expected result in the sheet is not met.
- **Data:** the UI and the API disagree (amount, status or quantity).

---

## 3. Audit of the existing scripts

Legend for the **Verdict** column:
- **FAKE:** checks nothing on the real site (no navigation, or it checks rules re-implemented inside the test). Delete it, or rewrite it inside its flow.
- **SOFT:** really drives the UI, but goes through `softTest.js`, so failures are hidden. Convert it (§ 4).
- **WEAK:** drives the UI but asserts very little, or only that the page loaded. Add the validations from § 5.
- **OK:** real pass/fail.

"Tester fails" is how many of the spec's use cases a manual tester marked as failed or not working (sheet tab `Tester_Fails`). **Fix those first.**

| # | Spec (`tests/OneDirectBuy/`) | IDs | Belongs to flow | Verdict | Tester fails | What to do |
|---|---|---|---|---|---|---|
| 1 | `Coupons.spec.js` | 34 tests (own IDs) | B3 | **OK** | — | Keep. Fix the SAVE10 apply bug, then re-enable in `ci-tests.config.json` |
| 2 | `Checkout.spec.js` | 21 (129–149) | B2 | SOFT, plus "throw if control not present" paths | 5 | Convert. Replace the throws with real asserts and API checks |
| 3 | `Cart.spec.js` | 16 (113–128) | B1 | SOFT | 1 | Convert. Add a cart API read-back (qty, price, totals) |
| 4 | `BuyerOrders.spec.js` | 16 (167–182) | B4 | SOFT, 12 throw paths | 4 | Convert. Statuses must match 1CA |
| 5 | `ProductDetail.spec.js` | 22 (056–075, 508) | B1 / B3 / B5 | SOFT | **12** | Convert first: the most tester fails |
| 6 | `AutoPartsFitment.spec.js` | 22 (091–112) | B1 | SOFT, 11 throw paths | **10** | Convert. Fitment results must match the selected vehicle |
| 7 | `CategoryProductListing.spec.js` | 12 (041–053) | B1 | SOFT | 4 | Convert. Assert filter and sort results, not just visibility |
| 8 | `Search.spec.js` | 9 (030–040, 507) | B1 | SOFT | 3 | Convert. Assert results relevance and the empty state |
| 9 | `Navigation.spec.js` | 6 (027–040) | B1 | SOFT | 2 | Convert. Assert the target URL and heading per link |
| 10 | `Homepage.spec.js` | 2 (026, 506) | B1 / B5 | SOFT, WEAK | 0 | Convert. Add the hero, nav, footer and benefits-strip asserts |
| 11 | `Login.spec.js` | 4 (005–015) | B0 | SOFT | 3 | Convert. Wrong password = error shown, no session |
| 12 | `BuyerAccount.spec.js` | 5 (001–385) | B0 | SOFT | 1 | Convert. **Registration only on dev**, never on production |
| 13 | `BuyerAccountAuthenticated.spec.js` | 3 | B0 | SOFT | 1 | Merge into flow B0 |
| 14 | `BuyerAccountSecurity.spec.js` | 5 (021–025) | B0 | SOFT | 4 | Convert. Password change, mismatch, lockout |
| 15 | `BuyerAddress.spec.js` | 6 (010–132) | B0 / B2 | SOFT | 1 | Convert. The address saved = what the API returns; the delete confirm popup |
| 16 | `BuyerVerification.spec.js` | 5 (016–020) | B0 | SOFT | 4 | Convert. Testers want email OTP before account creation; check with the owner first |
| 17 | `PaymentsRefundsWallet.spec.js` | 17 (150–166) | B2 (7 out of scope) | SOFT, 20 throw paths | 1 | Rewrite inside B2 / E1 with API money checks |
| 18 | `ProductVariantsPricing.spec.js` | 15 (076–090) | B1 | SOFT, WEAK | 0 | Convert. Variant change updates price, SKU and stock |
| 19 | `LegalPages.spec.js` | 10 (375–384) | B1 | SOFT | 0 | Convert (cheap). Check every page's heading and that the breadcrumb works (a tester reported broken breadcrumbs) |
| 20 | `ErrorHandlingSeo.spec.js` | 5 (458–510) | SEO / B5 | SOFT | 0 | Convert. 404 page, canonical, sitemap |
| 21 | `ResponsiveAccessibility.spec.js` | 7 (491–503) | B5 | SOFT | 0 | Replace with `checkStep` at 390×844 inside B1/B2 |
| 22 | `SellerFulfillmentShipping.spec.js` | 19 (261–279) | **E1** | WEAK (0 asserts) | 1 | Rewrite inside E1 / A3 |
| 23 | `SellerOrders.spec.js` | 8 | B4 | SOFT | 1 | Convert, or move into B4 / E1 |
| 24 | `SellerOnboardingStorefront.spec.js` | 20 (183–202) | S1 | SOFT, 14 throw paths | 2 | Rewrite inside S1 |
| 25 | `SellerOnboarding.spec.js` | 12 | S1 / B1 | SOFT | 0 | Merge into S1 |
| 26 | `SellerStorefront.spec.js` | 5 | B1 / S1 / A1 | SOFT | **4** | Convert |
| 27 | `SellerAdminManagement.spec.js` | 9 | S1 / A1 | SOFT | 0 | Convert |
| 28 | `SellerMessaging.spec.js` | 5 | B4 | SOFT | 1 | Convert |
| 29 | `SellerPromotions.spec.js` | 1 (396) | B3 | SOFT | 0 | Merge into B3 |
| 30 | `AdminBackend.spec.js` | 8 (357–476) | A1 | SOFT | 0 | Convert, or drop where 1CA A1 already covers it |
| 31 | `BuyerPurchaseJourney.spec.js` | journey (6 steps) | B2 / E1 | SOFT, 1 assert | — | Reuse its helper inside B2 and E1, then delete the spec |
| 32 | `ProductCatalog.spec.js` | 23 (215–237) | S1 | **FAKE** (no navigation; no-op or rule checks) | 0 | Delete; rewrite inside S1 |
| 33 | `BrandApproval.spec.js` | 12 (203–214) | S1 | **FAKE** (rule checks only) | 0 | Delete; rewrite inside S1 |
| 34 | `SellerInventory.spec.js` | 10 (251–260) | S1 | **FAKE** (rule checks only) | 0 | Delete; rewrite inside S1 |
| 35 | `CatalogImportExport.spec.js` | 13 (238–250) | S1 (6 out of scope) | **FAKE** (no navigation, no asserts) | 0 | Delete; rewrite inside S1 |
| 36 | `SellerCatalogBackend.spec.js` | 15 | B1 / B4 / B5 | **FAKE** (no navigation, no asserts) | 1 | Delete; the IDs move to their flows |
| 37 | `SellerCsvCoverage.spec.js` | — | — | **FAKE** | — | Delete |
| 38 | `OneFulfillment3pl.spec.js` | 1 (280) | out of scope | **FAKE** | — | Delete |
| 39 | `MarketplaceGapRules.spec.js` | 60 | mixed (31 out of scope) | **FAKE** (asserts rules re-implemented in `marketplaceGapRules.js`) | 5 | Delete, together with `helpers/marketplaceGapRules.js` |
| 40 | `ProductionQaCoverage.spec.js` | 188 cases via a TSV | — | **FAKE** (rules in `productionQaRules.js`) | — | Delete, together with its helper |
| 41 | `ProductionQaLive.spec.js` | 60 tests | — | **WEAK**: 56 of 60 only check the page `body` is visible | — | Delete; the real checks live in the flows |
| 42 | `ux-modules/*.spec.js` (19 files) | — | — | Not UI tests: they run the backend's Jest suites through `npm ci` | — | Delete. Backend tests belong in the backend repo's own test run |

**Summary of actions:**
- **Delete 11 items:** rows 32–42 (`ux-modules/` counts as one).
- **Convert 30 specs:** rows 2–31. Start with the most tester fails: ProductDetail (12), AutoPartsFitment (10), Checkout (5), then BuyerOrders, CategoryProductListing, Login, BuyerAccountSecurity, BuyerVerification and SellerStorefront.
- **Keep 1:** Coupons.

> Before deleting, get the owner's OK: these files are a colleague's work. Delete them in one PR titled "Remove non-product tests (audit § 3)".

---

## 4. How to fix an existing script

### 4.1 Convert a SOFT spec (step by step)

1. **Swap the import:**
   ```js
   // before
   import { test } from "../helpers/softTest.js";
   // after
   import { test, expect } from "@playwright/test";
   import { watchHealth, checkStep } from "../helpers/checkStep.js";
   ```
2. **Unwrap each `soft("ODB-UC-xxx", "title", async () => { … })`** into the test body, and **put the ID in the test title** so the results reporter can find it:
   ```js
   test("ODB-UC-115 cart quantity update recalculates totals", async ({ page }, testInfo) => {
     const health = watchHealth(page);
     // … actions …
     await expect(page.getByTestId("cart-subtotal")).toHaveText(/\$\d/);
     await checkStep(page, testInfo, { id: "ODB-UC-115", name: "cart after qty update", health });
   });
   ```
3. **Replace "presence only" checks with outcome checks.** Take them from the sheet's **Expected Result** column; fill that cell first if it's empty.
4. **Replace the `throw new Error("… not available")` branches:**
   - feature really missing (the sheet says Later or Not Required) → `test.skip(true, "Later version — sheet status")`;
   - feature should exist → a real failing `expect`.
5. **Add API read-back** for money, stock or status (§ 6.4).
6. **Remove the shared state:** each test logs in (or uses `storageState`) and creates its own cart or order.
7. **Run it 3 times** with `--workers=1 --retries=0`. It must pass all 3 times, and fail when you break the expected value on purpose.
8. **Update the sheet:** Automation Status = `Automated`. Then delete the old `.tsv` rows for those IDs, if any.

### 4.2 Rewrite a FAKE spec

Don't patch it. Find its IDs' flow (§ 3 table, column "Belongs to flow") and implement those steps inside that flow's spec (§ 5). Delete the fake spec in the same PR.

### 4.3 Quality checks before merging any spec

- `grep softTest` in the file returns nothing.
- Every `test(...)` title starts with a use-case ID.
- Every test has at least one outcome `expect` and one `checkStep`.
- There is no `waitForTimeout`, no `nth-child` and no hard-coded order ID.
- Data it creates is tagged and cleaned up.

---

## 5. The 18 flows: steps and what to validate

How to read each flow:
- **Step:** what the user does.
- **Validate on screen:** what must be visible or true in the UI.
- **Validate data:** the API read-back.
- **Use cases:** sheet IDs to tag.

**`checkStep` runs after every step**, so it isn't repeated in each row: screenshot, axe, layout, console and 5xx.

Status key: ✅ exists · ⚠️ exists, unproven or off · ❌ missing.

### E1. Full end to end: ODB order → 1CA fulfil → refund → return ❌ · P0

- **Spec:** 1CA `apps/web/e2e/specs/flows/e1-order-to-return.spec.js`
- **Use cases:** Main_v2 Flow=E1 (19, ODB-UC-261…279), plus 1CA-UC-002 and 1CA-UC-009.
- **Preconditions:** a test buyer; a test SKU with bin stock in a WMS warehouse of the test org; Stripe test mode; EasyPost sandbox, or manual tracking.

| # | Step | Validate on screen | Validate data (API) |
|---|---|---|---|
| 1 | ODB: open the test product, add qty 2 to the cart | Cart shows the SKU, qty 2, line total = price × 2 | Cart API: line qty, unit price |
| 2 | Checkout: address, shipping, tax, card 4242 | Each step's totals; no layout break at 390 px | — |
| 3 | Confirmation | Order number shown; total = items + shipping + tax | ODB order status `placed`; total matches to the cent |
| 4 | 1CA: Fulfill → Orders, search the order number | Order row visible in the test org; channel OneDirectBuy | 1CA order exists with the same lines and qty (poll ≤ 60 s) |
| 5 | Open order details | Header, buyer, address, lines, totals = ODB | Stock **hold** created for the qty |
| 6 | Fulfil dialog → Continue | Lines with qty, location, box; qty can't exceed ordered | Order moves to the pick stage |
| 7 | WMS pick: choose a bin, confirm qty 2 | Pick locations list bins that have stock | WMS pick task completed qty = 2 |
| 8 | Pack: box size/weight; serials if required | Required fields enforced | Pack task done |
| 9 | Ship: Show Rates → pick a rate → Buy Label (sandbox), or Add Tracking | Rates load; Buy button disabled while buying; tracking number shown | Tracking saved; ODB line/header = `shipped` |
| 10 | ODB buyer: My orders → this order | Status Shipped, the same tracking number | ODB buyer API: same tracking |
| 11 | 1CA: Refund one line (reason, source) | Can't exceed the paid amount; success message; refund row | Refund amount = line total (including tax share); ODB line `refunded` |
| 12 | ODB buyer: order view | Refund shown with its amount | Buyer API: refund recorded |
| 13 | 1CA: mark delivered → Return → Generate RMA | RMA number shown | Return pending |
| 14 | WMS Returns: receive, restock | Return closed | Stock +qty in the bin; hold released |

**Cleanup:** void the label if one was bought; cancel any open lines. Refunded and returned orders stay as tagged history.

**Watch for:**
- the sync delay between ODB and 1CA;
- refund rounding with tax;
- double refunds on retry: a second refund of the same line must be refused;
- stock must not go negative.

### A1. 1CA login + menu walk ✅ · P0

- **Spec:** `apps/web/e2e/specs/menu-smoke.spec.js` (exists).
- **Use cases:** Main_v2 Flow=A1 (12).
- **Validate:**
  - login, with TOTP if the account has MFA, lands on the dashboard of the test org;
  - every visible menu leaf opens with no error screen, no console error and no 5xx;
  - a permission-hidden item isn't shown.
- **Add:** `checkStep` on the 10 most-used pages (orders, catalog, WMS, accounting, CRM).

### A2. Orders list → details → popups (read-only) ⚠️ · P1

- **Spec:** `apps/web/e2e/specs/flows/a2-order-details-ux.spec.js` (exists, **never run**).
- **Use cases:** 1CA-UC-001, 003, 019, 020, 022–026.
- **Validate:**
  - the list loads with test-org orders only;
  - filters and search narrow the list;
  - order details match the API (totals, payment status);
  - each popup (Refund, Return, Cancel, Shipping, Tracking, Email logs, Mark as paid, Purchase details, Reply, Work order) opens, passes axe, keeps focus inside, closes with Esc, and **saves nothing** (`E2E_READ_ONLY=1`).
- **First-run fixes expected:** the button-text selectors. Set `E2E_ORDER_ID` to an order that shows all the buttons.

### A3. Pick → pack → ship ❌ · P0

- **Spec:** 1CA `…/flows/a3-pick-pack-ship.spec.js`.
- **Use cases:** 1CA-UC-004, 005, 007, 008, 010, 021, 027.

| Step | Validate on screen | Validate data |
|---|---|---|
| Fulfillment dialog | Open lines, qty ≤ ordered, location suggestions | — |
| Pick (`/wms/pickpack`) | Bins with stock listed; over-pick blocked | Pick task assigned/completed qty |
| Pack | Box required; serial prompt for serialised SKUs | Pack done |
| Shipping dialog: dimensions → Show Rates | Rates appear, or a clear error | — |
| Buy Label (sandbox) | Disabled while buying; tracking shown | Tracking saved |
| Mark In Transit | Status changes; "deliver" refused while pick/pack is incomplete | Status |
| Fulfilled-qty popup | Totals = fulfilled qty | — |
| WMS Orders: Batch Assign | Orders assigned to the picker | Tasks in the pick queue |

### A4. Short pick → cancel line → refund ❌ · P0

- **Use case:** 1CA-UC-006.
- **Validate:**
  - partial pick saved; the remaining qty stays open;
  - cancelling the remaining line releases its hold;
  - the refund equals the cancelled line's value;
  - ODB shows the line as cancelled and refunded.

### A5. Refund popup ❌ · P0

- **Use cases:** 1CA-UC-011, 012, 013.

| Case | Validate |
|---|---|
| Refund one line | The line, reason and source are required; amount ≤ paid; success message; a refund row in Refund Details |
| Over-refund | Blocked with a clear message; **no API call made**, or the API refuses it |
| Empty reason | Blocked |
| Double click on Submit | Only one refund created (button disabled while saving) |
| Refund details popup | Amount, date, reason and source = API |
| ODB side | Line `refunded`; the buyer sees the amount |

### A6. Return / RMA ❌ · P0

- **Use cases:** 1CA-UC-014, 015, 016.
- **Validate:**
  - only delivered lines can be returned;
  - reason is required;
  - an RMA number is generated, and the return label is optional;
  - WMS Returns: receive with restock → stock +qty in the chosen bin; receive without restock → stock unchanged;
  - return details show the RMA, lines, reason and status;
  - "Open service work order" works.

### A7. Cancel ❌ · P0

- **Use cases:** 1CA-UC-017, 018.
- **Validate:**
  - **before pick:** reason required → order cancelled, hold released, payment voided or refunded, ODB = cancelled;
  - **after pick:** picked qty is restocked or flagged, per the owner's rule;
  - **decline a cancel request:** the order stays open and the decline reason is logged;
  - the confirmation dialog appears before anything happens.

### A8. Permissions ❌ · P1

- **Use case:** 1CA-UC-028.
- **Needs:** a low-permission test user.
- **Validate:**
  - Refund, Cancel and Ship are hidden or disabled;
  - a typed URL to a restricted page shows "no access";
  - no 5xx response;
  - no data from another org.

### B0. Account ❌ (from 6 SOFT specs) · P1

- **Use cases:** Main_v2 Flow=B0 (22).
- **Validate:**

| Area | Check |
|---|---|
| Login | Valid → dashboard; wrong password → error, no session |
| Logout | Session ends |
| Register | **Dev only.** Required fields shown; a duplicate email refused |
| Profile | The edit is saved and shown on reload |
| Address book | Add, edit, delete (with a confirmation popup; testers asked for a better one); default address |
| Password change | Mismatch error; "logout all devices" (a tester reported the option missing) |
| Verification | Email OTP before creating an account (testers expect it; confirm with the owner) |

### B1. Browse → search → product → cart ❌ (from 12 SOFT specs) · P1

- **Use cases:** Main_v2 Flow=B1 (108).
- **Validate:**

| Area | Check |
|---|---|
| Home | Nav, hero, benefits strip, footer, legal links |
| Search | Relevant results for a known SKU or term; an empty-state message; no 5xx |
| Category | Filters and sort change the results (count and order); pagination |
| Product page | Title, price, stock, images, specs, seller; variant change updates price, SKU and stock |
| Fitment | Add a vehicle → only fitting parts; VIN decode; garage set/clear default |
| Cart | Add, update qty → totals recalculate; remove; cart persists after login |
| Legal pages | Each page has a heading; breadcrumbs work (reported broken) |

### B2. Checkout (card) ❌ (from Checkout + Payments, SOFT) · P0

- **Use cases:** Main_v2 Flow=B2 (30).
- **Validate:**

| Step | Check |
|---|---|
| Address | Required fields; invalid ZIP error; save and reuse |
| Shipping | Rates shown; choosing one updates the total; "shipping quote error" (reported) must be handled gracefully |
| Tax | Applied by destination state; shown as its own line |
| Payment | Stripe test card OK; declined card (`4000 0000 0000 0002`) shows an error and creates **no** order |
| Totals | Items + shipping + tax − discount = charged amount (to the cent) |
| Confirmation | Order number; a confirmation email (if testable) |
| API | ODB order total and status match the screen |

### B3. Coupons ⚠️ · P1

- **Spec:** `Coupons.spec.js` (real tests; off until the SAVE10 bug is fixed).
- **Use cases:** Main_v2 Flow=B3 (16), plus the coupon doc IDs.
- **Add:**
  - `checkStep` on the cart and checkout screens;
  - discount = the expected amount, through the API (`cents()`);
  - a coupon refused below the minimum order;
  - a one-use coupon refused the second time.

### B4. My orders → cancel → return ❌ (from BuyerOrders, SOFT) · P0

- **Use cases:** Main_v2 Flow=B4 (59).
- **Validate:**
  - the orders list shows the buyer's orders only;
  - order details = the API;
  - the cancel-item popup (reason) → line cancelled, and 1CA shows it;
  - the return-request popup only on delivered lines;
  - the multi-seller order is split correctly;
  - messages with the seller.

### B5. Mobile (390×844) ❌ · P1

- **Use cases:** Main_v2 Flow=B5 (23).
- **Run B1 + B2 at phone size.** On every step, `checkStep` must report no horizontal overflow, no off-screen buttons and no tap target under 24 px.
- **Also check:** the menu drawer works, and the checkout is usable with the on-screen keyboard.

### B6. B2B buyer ❌ · P2

- **Use cases:** Main_v2 Flow=B6 (12).
- **Validate:**
  - B2B login and org switch;
  - B2B prices shown;
  - credit or terms checkout reduces available credit;
  - cancel restores the credit;
  - PO number saved;
  - tax exemption applied when on file.

### S1. Seller onboarding + catalog ❌ (replaces 6 FAKE/SOFT specs) · P2

- **Use cases:** Main_v2 Flow=S1 (66).
- **Validate:**
  - seller sign-up and required fields;
  - brand approval request → approved or refused;
  - product create: required fields; **a product needs an image to go live** (saving without one is allowed);
  - offer on an existing product;
  - inventory update reflected on the storefront;
  - CSV import/export: valid rows imported, invalid rows reported.

### C1. 1CA CRM ❌ · P2

- **Use cases:** the CRM tab (244).
- **Validate:**
  - contacts, leads and companies: create, edit, search, delete;
  - tickets: create and change status;
  - a partial-CRM user sees only what's assigned or shared to them.

---

## 6. Validation checklists

### 6.1 Every step (automatic in `checkStep`)
- [ ] Screenshot attached, at 1440×900 and, where relevant, 390×844.
- [ ] axe: no serious or critical issue.
- [ ] No horizontal overflow; no control off-screen; no clipped labels or headings; tap targets ≥ 24 px.
- [ ] No console error, page error or 5xx on our hosts since the last step.

### 6.2 Every popup or dialog
- [ ] Opens from its button; the title matches the action.
- [ ] Focus moves inside on open and stays inside on Tab (`checkPopupKeyboard`).
- [ ] Esc and the × close it without saving.
- [ ] Required fields marked; submitting empty shows field errors and makes no API call.
- [ ] Submit is disabled while saving; a double click creates one record.
- [ ] On an API error, a readable message appears and the popup stays open with the input kept.
- [ ] On success, the popup closes, a toast or message appears, and the list or details refresh.
- [ ] It works at 390 px: no clipped buttons, and it scrolls inside.

### 6.3 Every form
- [ ] Validation of formats (email, phone, ZIP, amount), min and max, and trimmed spaces.
- [ ] Saved values show again after a reload (read back through the API).
- [ ] Phone fields: the digits fill the mask correctly (a known past bug).

### 6.4 Every money step (checkout, refund, cancel, coupon, credit)
- [ ] Amount on screen = API amount, compared in cents (`expectMoney`).
- [ ] Totals: items + shipping + tax − discount = charged.
- [ ] Refund ≤ paid; partial refunds add up; no double refund on retry.
- [ ] Both systems agree (ODB and 1CA).
- [ ] Stripe test mode; no live key anywhere.

### 6.5 Every stock step (pick, pack, cancel, return, import)
- [ ] Hold created on order; released on cancel or ship.
- [ ] Bin quantity changes by the exact qty.
- [ ] Never negative; over-pick blocked.
- [ ] Restock only when chosen.

### 6.6 Permissions and org isolation
- [ ] Hidden or disabled actions for users without the permission.
- [ ] A typed URL to a restricted page shows "no access", not a crash.
- [ ] No other org's data in any list or API response.

### 6.7 Errors and resilience
- [ ] A slow network (Playwright `route` with a delay) shows loading states, not blank pages.
- [ ] A 500 from the API (mocked) shows a readable error.
- [ ] Back and refresh mid-flow don't create duplicates.

---

## 7. Test data and environments

| What | Value / where |
|---|---|
| 1CA test org | onedirectbuy `3at1mrm65w3g` (also allowed: The_Paradise `2wi2r1mas0pi2b` for restaurant, `oneauto` read-mostly) |
| ODB test seller | `6a57d091447dc8e81333ca89` |
| Test SKUs (stock in a WMS bin) | `MSA_M34-020756M`, `MSA_M35-020756M` (verify the stock before running) |
| Test buyer | `ONEDIRECTBUY_BUYER_EMAIL` / `_PASSWORD` in `TestingOnedirectbuy/.env` |
| QA admin (1CA) | `E2E_USER_EMAIL` / `_PASSWORD` / `_TOTP_SECRET` in `apps/web/e2e/.env.local` |
| Low-permission user | needed for A8: ask the owner |
| B2B test org / test seller | needed for B6 / S1: ask the owner |
| Stripe | test mode; `4242 4242 4242 4242` OK; `4000 0000 0000 0002` declined |
| Shipping | EasyPost sandbox, or manual tracking |
| ODB site | `dev.onedirectbuy.com` (default) · production read-only with `ALLOW_PROD=1` |
| 1CA site | `admin.onechanneladmin.com` (live, test org) or `devadmin.onechanneladmin.com` |
| Tags | everything created: `qa-e2e-<runId>-<caseId>` |

---

## 8. Formats and templates

### 8.1 Sheet row (Main_v2 / 1CA_Admin_Orders)

| Column | Example | Rule |
|---|---|---|
| Use Case ID | `1CA-UC-011` | Unique and never reused; `ODB-UC-###` for ODB, `1CA-UC-###` for 1CA |
| Use Case | Refund one line | Short |
| Expected Result | "Refund $12.50 shown; refund row in Refund Details; ODB line status = refunded" | **Specific and checkable**: values, statuses, messages |
| Priority | P0 / P1 / P2 | P0 = money, stock or order status |
| Layer | Playwright flow + API check | One of: API, Popup test, Playwright flow, Playwright flow + API check, Manual, N/A |
| Flow | A5 | From § 5 |
| Screenshot | Y | |
| Automation Status | Automated / Skipped / Manual / Not started / Needs rework (soft test) | |
| Last Run / Run By / Bug Link | filled after a run | |

### 8.2 Spec file template: 1CA

```js
// @flow A5 — Refund popup. Use cases: 1CA-UC-011, 1CA-UC-012, 1CA-UC-013. Plan: docs/qa/E2E-TEST-GUIDE.md § 5.
const { test, expect, expectTestOrg } = require("../../support/fixtures");
const { settle } = require("../../support/page-health");
const { checkStep, checkPopupKeyboard } = require("../../support/check-step");
const { qaTag, runIdNow } = require("../../support/guard");

test.describe("A5 refund @flow", () => {
  test("1CA-UC-011 refund one line", async ({ page, settings, health, writable }, testInfo) => {
    test.skip(!writable.ok, writable.reason);
    const tag = qaTag(runIdNow(), "1CA-UC-011");
    // 1. arrange: create or find the tagged test order (never a real customer order)
    // 2. act + checkStep after each screen/popup
    // 3. assert the UI outcome AND read back through the API
    // 4. cleanup in afterEach
  });
});
```

### 8.3 Spec file template: ODB buyer

```js
// @flow B2 — Checkout. Use cases: Main_v2 Flow=B2.
import { test, expect } from "@playwright/test";
import { watchHealth, checkStep } from "../../helpers/checkStep.js";
import { readOrder, expectMoney, expectOrderStatus, moneyFromText } from "../../helpers/odbApi.js";

test("ODB-UC-140 checkout with test card places the order", async ({ page }, testInfo) => {
  const health = watchHealth(page);
  // … steps; checkStep after each screen …
  // const order = await readOrder(buyerToken, orderId);
  // expectOrderStatus(order, ["placed", "processing"]);
  // expectMoney(order.total, moneyFromText(await page.getByTestId("order-total").innerText()), "charged = shown");
});
```

### 8.4 Naming
- **Files:**
  - 1CA: `apps/web/e2e/specs/flows/<flow>-<name>.spec.js`, e.g. `a5-refund.spec.js`;
  - ODB: `tests/OneDirectBuy/flows/<flow>-<name>.spec.js`.
- **Tests:** `"<USE-CASE-ID> <what is proven>"`.
- **`data-testid`:** `<area>-<element>[-<n>]`, e.g. `refund-submit`, `refund-line-2`, `pick-qty`.

### 8.5 Bug report (one per failure)

```
Title:     [1CA-UC-011] Refund allows amount above paid total
Flow/step: A5 › refund popup › submit
Env:       admin.onechanneladmin.com, org 3at1mrm65w3g, run qa-e2e-20261023…
Expected:  (sheet Expected Result)
Actual:    …
Evidence:  screenshot + trace from the Playwright report; API response
Severity:  P0 money / P1 / P2
```

### 8.6 Commits and PRs
- One flow per PR, titled `e2e: <flow> <name> (<IDs>)`.
- The PR description lists the use cases covered and the run evidence (3 passing runs, no retries).
- 1CA test changes merge to `main` only; **never push 1CA `cicd-prod`**, which deploys the live admin.
- TestingOnedirectbuy: merge to `main` (Actions stay manual).

---

## 9. Definition of done and review checklist

**A flow is done when:**
- [ ] Every step has an ID in the sheet with a specific Expected Result.
- [ ] The spec uses plain `test`/`expect`, and `checkStep` after every screen and popup.
- [ ] Money and stock steps have API read-back in both systems.
- [ ] Popups pass the § 6.2 checklist.
- [ ] Data is tagged and cleaned up.
- [ ] 3 passing runs in a row with `--retries=0`, at 1440×900; at 390×844 too for buyer flows.
- [ ] Results are uploaded, and `/coverage` shows its IDs as passed.
- [ ] The sheet's Automation Status is `Automated`, and § 10 is updated.

**The reviewer checks:**
- [ ] No `softTest`, `waitForTimeout`, `nth-child` or hard-coded real order IDs.
- [ ] Test titles start with use-case IDs.
- [ ] There is at least one outcome assert per test, not just "visible".
- [ ] No credentials, sheet IDs or customer data in the code.
- [ ] The guard isn't bypassed, and the org is the test org.

---

## 10. Progress tracker

| Flow | Status | Spec | Notes |
|---|---|---|---|
| A1 | ✅ passes read-only (live, test org) | 1CA `menu-smoke.spec.js` · hub `flows/a1-login-menu.spec.js` | needs QA user creds (see `1CA-E2E-AUDIT.md`) |
| A2 | ✅ passes read-only (live, test org) | hub `flows/a2-order-details-ux.spec.js` | new-UI order details; read-only |
| B3 | ⚠️ off | `Coupons.spec.js` | SAVE10 bug |
| E1 | ❌ | | |
| A3 | ⚠️ writes run; WMS steps being fixed | hub `flows/a3-pick-pack-ship.spec.js` | needs `data-testid`s for stability |
| A5 | ⚠️ writes run; refund passes, payment status stays PAID (finding) | hub `flows/a5-refund.spec.js` | |
| A6 | ⚠️ writes run; shipping step being fixed | hub `flows/a6-return-rma.spec.js` | |
| B2 | ❌ | | convert Checkout + Payments |
| A4 | ⚠️ writes run; WMS confirm step being fixed | hub `flows/a4-short-pick-cancel-refund.spec.js` | |
| A7 | ⚠️ writes run; cancel-before-pick passes (UX findings only) | hub `flows/a7-cancel.spec.js` | decline = eBay only |
| B4 | ⚠️ written (read part) | `flows/b4-my-orders.spec.js` | needs ODB_BUYER_LOGIN=1 |
| B0 | ⚠️ written | `flows/b0-account.spec.js` | guest cases; signed-in cases need ODB_BUYER_LOGIN=1 |
| B1 | ⚠️ written | `flows/b1-browse.spec.js` | local storefront + dev API |
| B5 | ⚠️ written | `flows/b5-mobile.spec.js` | |
| A8 | ⚠️ written; needs a low-permission user | hub `flows/a8-permissions.spec.js` | needs a low-permission user |
| B6 | ❌ | | needs a B2B test org |
| S1 | ❌ | | needs a test seller; replaces 6 FAKE specs |
| C1 | ⚠️ writes run; grids have no search box (fixed in spec) | hub `flows/c1-crm.spec.js` | tickets = Help Center |

| Clean-up item | Status |
|---|---|
| Delete the 11 FAKE/WEAK items (§ 3 rows 32–42) | ❌ needs the owner's OK |
| `data-testid` PR for the 1CA order popups (list in `HANDOFF.md` § 3) | ❌ |
| Fill Expected Result for all P0 rows (108/344 done) | ❌ |
| Retest the 64 `Tester_Fails` rows | ❌ |

### Order of work
1. Prove A1 and A2.
2. The `data-testid` PR.
3. E1.
4. A3, A5, A6, B2.
5. Convert ProductDetail, AutoPartsFitment and Checkout (the most tester fails).
6. A4, A7, B4.
7. B0, B1, B5, A8.
8. B6, S1, C1.
9. Delete the FAKE specs.
