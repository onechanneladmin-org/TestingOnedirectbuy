# 1CA (OneChannelAdmin): audit of the test scripts and the new E2E flows

**2026-10-23.** Applies [`E2E-TEST-GUIDE.md`](./E2E-TEST-GUIDE.md) to the 1CA project in this hub (`projects/Testing-OneChannelAdmin`). The ODB storefront audit (§ 3 of the guide) is the next step and is not covered here.

## 1. Summary

- **Old scripts:** 143 spec files. **None** meets the guide's rules (§ 2.2):
  - no test-org guard;
  - no `checkStep`;
  - no use-case IDs in the titles;
  - none reads data back through the API.
- **New flows:** 9 specs with 46 tests in `tests/Onechanneladmin/flows/`, covering A1–A8 and C1.
  - They are built on helpers ported from `onechanneladmin-latest/apps/web/e2e/support`: guard, `checkStep`, page health, TOTP and menu.
  - Two helpers are new: API read-back and money in cents.
- **Run read-only on the live admin, test org only (§ 5a).**
  - All functional asserts pass. The 23 failures are real UX and console findings.
  - Still to run: the write flows and A8.
- **E1** (ODB order → 1CA → refund → return) starts on the storefront, so it moves to the ODB phase. A3–A6 already cover its 1CA half on an order the test creates itself.

## 2. Audit of the existing 1CA scripts

Verdict legend as in guide § 3:
- **FAKE:** checks nothing real.
- **SOFT:** failures are hidden.
- **WEAK:** drives the UI but asserts little.
- **OK:** real pass/fail.

Rows marked **UNSAFE** write to the live admin without any org guard.

| # | Spec (`tests/Onechanneladmin/`) | Verdict | Problems found | Replaced by |
|---|---|---|---|---|
| 1 | `login.spec.js` + `loginSteps.js` | WEAK | No assert at all. Hard-codes the live URL and `admin@onechanneladmin.com`. | A1-01 |
| 2 | `CompleteOrderFlow.spec.js` | WEAK, **UNSAFE** | Codegen recording. 0 real asserts. Hard-coded order `2026-000453`, SKU `AIR_LIFT24544` and a real user `anurag@…`. Creates live orders and ships them in whatever org is current. | A3 |
| 3 | `FulfillmentSOB2BOrderFlow.spec.js` (1,831 lines) | WEAK, **UNSAFE** | 50 `waitForTimeout`, 15 `.nth()`. Asserts are only "visible". Hard-coded SKU and user. Writes on live. | A3 (B2B variant still to do) |
| 4 | `FulfillmentSOD2COrderFlow.spec.js`, `Fulfillmentflowsod2corder.spec.js` | WEAK, **UNSAFE** | 15 `waitForTimeout`. Visibility-only asserts. No API read-back. | A3 |
| 5 | `Fulfillmentflowreturn.spec.js` | WEAK, **UNSAFE** | Codegen. 0 outcome asserts. `nth-child` selectors. | A6 |
| 6 | `RentalsOrderFlow.spec.js` | WEAK, **UNSAFE** | 46 `waitForTimeout`. Creates live rental orders. | not covered by the guide's 18 flows (keep until a rental flow exists) |
| 7 | `CompleteCRMFlow.spec.js` | SOFT | Its own try/catch "step" wrapper swallows failures. The only assert is "at least 1 step passed". Leaves `TestCompany_*` records behind. | C1 |
| 8 | `CRMDashboard.spec.js`, `crm-accounts.spec.js`, `crm-accountdetails.spec.js`, `addcontacttest.spec.js` | WEAK | 0–2 asserts. Fixed waits. | C1 |
| 9 | `CompleteProductFlow.spec.js` | WEAK, **UNSAFE** | 29 `waitForTimeout`, 12 `.nth()`, 1 assert. Creates products on live. | S1 (later) |
| 10 | `add-product.spec.js`, `catalogbundles.spec.js`, `catalogvariation.spec.js` (empty file) | WEAK / FAKE | 0–2 asserts. The empty file runs nothing. | S1 (later). Delete the empty file. |
| 11 | `CatalogFitmentFlow.spec.js`, `CatalogVariationflow.spec.js` | WEAK → near OK | Real asserts. No guard, no `checkStep`, no IDs. | Keep. Add the guard fixture and `checkStep` when S1 is done. |
| 12 | `emaimarketingflow.spec.js` (39 tests) | OK-ish | Real UI asserts. No IDs, no `checkStep`, no guard. | Keep. Convert to the flows fixtures (cheap). |
| 13 | `advanced/demoDatatable.spec.js` (19 tests) + page object | OK | Real asserts plus API waits. 17 `waitForTimeout` in the page object. | Keep. Remove the fixed waits. |
| 14 | `advanced/_discoverFilters.spec.js` | FAKE | Discovery helper, 0 asserts. | Move to `scripts/`. |
| 15 | `NexusD2Cborderflow.spec.js`, `Nexusb2borderflow.spec.js` | **Wrong project** | They drive `http://localhost:3000` (a storefront), not 1CA. The name says "Nexus" (the paying client). | Delete or move to the ODB project. Never point at Nexus. |
| 16 | `HomeDashboardUxAudit.spec.js` + `ux-flows/*.spec.js` (113 files) + `ux-audit-batch.spec.js` | WEAK → **fixed (§ 7)** | Generated per-page audits. `flowStep` re-throws, so a finding does fail the test (not soft, as first written here). Before § 7: no guard, signed in as the Windows user name, one failing user action aborted the whole page, and form controls (inputs, dropdowns, date pickers …) were not audited at all. | Kept and extended (§ 7). A1-02/A1-03…12 add the hard menu and `checkStep` checks. |
| 17 | Missing specs `CatalogDashboardCards.spec.js`, `AccountingDashboardCards.spec.js` | — | Listed in `onechanneladmin.flows.json` but not on disk, so flows 11 and 12 can never run. | Remove the entries or add the specs. |

**Actions**
- **Delete** (after the owner's OK, in one PR titled "Remove non-product tests (audit § 3)"): rows 10 (empty file), 14 and 15.
- **Retire once the flows pass three times:** rows 1–5 and 7–8. Until then they still run from the hub's old flow entries.
- **Keep and convert:** rows 11–13.
- **Fix in the flows config:** row 17.

## 3. The new flows

Run from `projects/Testing-OneChannelAdmin`. The hub UI also lists them under the group **e2e-flows**.

```bash
npm run test:flows:unit          # 18 pure helper tests, no browser
npm run test:flows:readonly      # A1, A2, A8 and the validation parts of A3–A7 / C1 (saves nothing)
npm run test:flows               # adds the write flows when writes are allowed (see below)
npm run test:flows:ux-report     # → test-results/.ux/UX-REPORT.md (per-step axe / layout / health)
```

| Flow | Spec | Tests | Writes? | What it proves |
|---|---|---|---|---|
| A1 | `a1-login-menu.spec.js` | 13 | no | Login lands on the test org. Every visible menu leaf opens with no error screen, console error or 5xx. `checkStep` on the 10 main pages. A permission-hidden item is not in the nav. |
| A2 | `a2-order-details-ux.spec.js` | 5 | no (needs `E2E_READ_ONLY=1`) | List shows only the test org's orders. Search narrows it. Details total and payment status match the API. 10 popups each open, pass `checkStep` and the keyboard check, close with ×, and make **0** `modifyOrder` calls. Run at 1440 and 390 px. |
| A3 | `a3-pick-pack-ship.spec.js` | 7 | own order | Stock hold equals the ordered qty. Over-pick is clamped. Pick and pack completed qty are read back. Show Rates requires dimensions. Manual tracking is saved. In-transit status. Fulfilled qty. Batch assign. |
| A4 | `a4-short-pick-cancel-refund.spec.js` | 1 | own order | Pick 1 of 2 keeps the rest open. Cancelling the remaining 1 releases the hold. Cancelled Amount equals one unit. |
| A5 | `a5-refund.spec.js` | 4 | own order for 2 of the 4 | Empty reason makes 0 API calls. Over-refund is clamped to `amountLeftToRefund`. A double click makes **one** refund call, with an idempotency key. Refund ≤ paid. Refund Details equals the API. No second full refund. |
| A6 | `a6-return-rma.spec.js` | 3 | own order | No return before delivery. Reason and label are required. The generated RMA is `<org>_RMA_<id>` and is stored. Return Details equals the API. WMS receive Good + restock. |
| A7 | `a7-cancel.spec.js` | 3 | own order for 1 | Reason is required. Answering No to "Cancel Confirmation" saves nothing. Cancel releases the hold and marks the order cancelled. Decline requires ship date and tracking (eBay only). |
| A8 | `a8-permissions.spec.js` | 3 | no | Ship and Refund are hidden or reduced without `write:order` / `write:refund`. A typed CRM URL shows "You don't have access". No other org's data. |
| C1 | `c1-crm.spec.js` | 5 | own lead, account and ticket | Required fields block the API call. Create, then find, then delete a tagged lead. Create and delete an account. Ticket: create, set processing, close. Partial-CRM view. |

**Data created:** every write flow tags what it creates `qa-e2e-<runId>-<caseId>`, then cancels or deletes it afterwards (`afterAll` → `cancelIfOpen`, which only touches tagged orders).

**Exception to the guide:** the test order itself is created through `POST inventory/orders/createOrder`, the call the create screen makes, not by clicking the screen.
- Test orgs get the new React Native Web create page (`shared-ui/NewRentalOrder.tsx`, 26k lines). Its product picker has no stable selectors.
- Covering create-order in the UI needs `data-testid`s on that page.

**Safety, as in the 1CA repo's suite:**
- The org must be allow-listed. Nexus `1p0248qcm3j1k401` is always refused.
- `E2E_READ_ONLY=1` aborts every save.
- Write flows skip unless `writable.ok`: a dev host, or live with `E2E_ALLOW_PROD_WRITES=1` on the test org.
- API reads use the session's own token. API writes are only for arrange and cleanup, and only when writes are allowed.

**One guard change versus the 1CA repo:** 1CA loads lists with POST (`inventory/orders/allOrders`, `getallusers` …). The original read-only mode blocked those, so the A2 walk would have seen empty lists. Read-only now lets through POSTs to `all*`, `get*`, `list*`, `search*`, `headers` and `filter(s)`, and still blocks `modifyOrder`, `save*`, `create*`, `update*` and `delete*` (unit-tested).

## 4. Use-case IDs

The guide's `1CA-UC-001…028` come from its § 5 and are used as-is. A1 and C1 have no sheet IDs in this repo, so they use provisional IDs. **Replace them with the sheet IDs once the sheet is synced:**

| Provisional | Meaning | Sheet ID |
|---|---|---|
| 1CA-A1-01 | login lands on the test org | Main_v2 Flow=A1 — ? |
| 1CA-A1-02 | every visible menu leaf opens cleanly | ? |
| 1CA-A1-03…12 | `checkStep` on the fulfillment dashboard, orders, returns, catalog products, inventory, WMS orders, pick/pack, accounting, CRM dashboard, CRM leads | ? |
| 1CA-A1-13 | permission-hidden menu item not shown | ? |
| 1CA-C1-01…05 | add-lead validation, lead create/delete, account, ticket, partial-CRM | CRM tab — ? |

The A2 popup IDs 1CA-UC-022 (mark as paid), 024 (purchase details), 025 (refund details) and 026 (return details) are a best fit to the guide's list. Check them against the sheet's `1CA_Admin_Orders` tab.

## 5. To run them: what's needed

Put these in `projects/Testing-OneChannelAdmin/.env` (gitignored; see `.env.example`):
- `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` (and `E2E_USER_TOTP_SECRET` if the user has MFA): a QA user that is a member of the test org only.
- `E2E_BASE_URL`: devadmin (default) or the live admin.
- `E2E_ORG_ID=3at1mrm65w3g`.
- **A8:** `E2E_LOWPERM_EMAIL` / `_PASSWORD`, a user without `write:order` / `write:refund`.
- **Write flows:**
  - `E2E_TEST_SKUS` with real bin stock (guide § 7). Check it before running.
  - `E2E_WAREHOUSE`.
  - `E2E_ALLOW_PROD_WRITES=1` (live only).

The first run will need selector fixes. Labels were taken from the 1CA source, but nothing has run against the real page yet. A2 is the cheapest place to start.

## 5a. First live run (2026-10-23, read-only)

**Setup**
- Target: `admin.onechanneladmin.com` → `backend.onechanneladmin.com`, test org `3at1mrm65w3g`, with `E2E_READ_ONLY=1`.
- devadmin was not usable: its backend `dev.onechanneladmin.com` returned 502 on every path.
- Login with the QA user passed, and the guard pinned the session to the test org.

**Result:** 46 tests, of which 2 passed, 23 failed and 21 skipped.
- The 21 skips are the write tests (read-only mode) and A8 (no low-permission user yet).
- **Every remaining failure is an app finding, not a test bug.** All functional asserts pass:
  - list = API;
  - search narrows the list;
  - details total and payment status = API;
  - opening and closing each popup makes no `modifyOrder` call;
  - empty refund reason makes 0 calls;
  - over-refund is clamped;
  - Cancel asks for confirmation first;
  - CRM required fields block the API call.
- The test fixes made during the run are in `git diff` (API base host, list paging, nav-vs-content buttons, panel close, scope CSS, CRM button names, read-only `showcount` lists).

**Findings to raise (evidence: `test-results/.ux/UX-REPORT.md`, screenshots per step)**

| # | Where | Finding | Guide § 2.4 class |
|---|---|---|---|
| 1 | Refund, Cancel and Fulfillment panels (order details) | No focus trap; Esc does not close them. | UX (popup) |
| 2 | Every page checked (34 steps) | axe serious/critical issues: buttons with no accessible name (icon-only), unlabeled form fields, ARIA toggles with no name, colour contrast, no `<title>`. 150 axe issues in total. | UX |
| 3 | Orders, catalog and WMS grids | Column-filter buttons are off-screen at 1440 px (63 instances); clipped text in headers (53); tap targets under 24 px (85). | UX |
| 4 | `/channel/facebook-products` | `500 GET marketplace/facebook/getAllProducts` | 5xx |
| 5 | `/fulfill/orders/dashboard` | 404 on one of its data calls | console |
| 6 | `/marketplaceseller` | 400 on load | console |
| 7 | `/analytics/analytics-reports` | "Failed to create chart: can't acquire context" | console |
| 8 | `/fulfill/orders/sendgrid-messages` | "No active SendGrid API settings found" logged as an error. Expected when the integration isn't set up, so it should be an empty state, not an error. | console |

**Still to run**
- A8: needs `E2E_LOWPERM_EMAIL` / `_PASSWORD`.
- Write flows A3–A7 and the C1 writes: need `E2E_ALLOW_PROD_WRITES=1` and `E2E_TEST_SKUS` with real bin stock. They create tagged orders, leads and tickets on the live backend in the test org, so this is the owner's go-ahead.

## 6. Findings from reading the 1CA source (to raise with the owner)

1. **Cancel Order has no client-side permission check** (`OrderHeader.tsx`, `CancelDialog.js`): only the backend flag gates it. A8 records it as a finding when the button shows for a user without `write:order`.
2. **Reply popup is unreachable** (`ReplyDialog.js`): nothing opens it, and its Send button does nothing. A2 skips it.
3. **Cancel-request decline may send no `cancelState` on the first click** (`CancelDialog.js`: `setCancelStatus("Decline")` runs just before `ModifyOrder()`).
4. **Typos in the UI:**
   - "Buy Shippping Label " (three p's, trailing space)
   - "Massages" (Reply sidebar)
   - "Shippment Method"
   - form id `qunatity-recived`
5. **Popups are mostly Sidebars with `dismissable={false}`.** The guide's "Esc closes the popup" check (§ 6.2) will probably fail for Refund, Return, Cancel and Fulfillment. That is a real UX finding, not a test bug.
6. **Over-pick and over-refund are only blocked on the client** (InputNumber `max`, toasts). The backend rule is not in this repo and needs an API-level check.

## 7. UI/UX audit (`ux-flows/`): fixes, component coverage, results (2026-10-26)

Run: `npm run test:ux-audit` then `npm run test:ux-audit:coverage` (from `projects/Testing-OneChannelAdmin`).
- Per-page reports: `ux-audit-report/<hub>-<page>/` (`components.json`, `component-coverage.json`, `findings.json`).
- Roll-up: `ux-audit-report/COMPONENT_COVERAGE.md`.
- The report folder is gitignored and outside `test-results/`, so partial re-runs merge.

**Engine fixes**
- **Safety and sign-in:**
  - Network guard on every audited page: test org only, read-only unless `UX_ALLOW_WRITES=1`.
  - The org is pinned (with retries; the app's bootstrap sometimes switched to `oneauto`).
  - Fixed signing in as the Windows `USERNAME`.
  - Reuses the `flows-setup` session (`UX_USE_STORAGE_STATE=0` to log in per page).
- **Speed:** a failing user action is now a finding and no longer aborts the page. Side-menu walking is opt-in (`UX_SIDE_MENU=1`). This takes about 2–3 min per page instead of about 7.
- **Redirecting menu paths:**
  - A path that lands on a dashboard, or on a page with its own spec, is **skipped** with the reason (feature off for this org): 10 pages.
  - A path that moved is **audited at its new path:** `/3pl/dashboard`→`/3pl/portal`, `/b2b/dashboard` and `/channel/b2b-products`→`/b2b/vendor-pos`, `/marketing/engage*`→`/crm/engage*`.
- **App chrome** (top bar, AI chat drawer, left nav) is excluded from page audits and audited once in `global-chrome.spec.js`. Before, the org switcher alone raised the same finding on all 96 pages.

**New: `lib/ui-audit/components.js`**
- **Scope:**
  - 26 component kinds are inventoried on the page, inside every dialog or sidebar the audit opens, and inside custom Tailwind modals that have no dialog role. Those modals are now detected and flagged as `overlays.modal-missing-role`.
  - Kinds covered: text/number/password inputs, textarea, dropdown, multiselect, autocomplete, calendar (PrimeReact and native), checkbox, radio, switch, chips, file upload, editor, slider, select button, accordion, sortable header, column filter, paginator, split and menu buttons, icon buttons, tree, breadcrumb.
- **Static checks:** accessible name, placeholder-as-label, required marker, target size, file `accept`, icon-button tooltip. Repeated findings are grouped per page.
- **Probes** (up to `UX_COMPONENT_PROBES`, default 2 per kind per surface; every value is restored):
  - typing accepted, number fields reject letters, password masked, focus ring;
  - dropdown, filter and menu panels open, have options or an empty message, have search for long lists, stay in the viewport, and close on Esc;
  - date picker opens, has named nav buttons and a dismiss that leaves the value unchanged; native date fields step with the arrow keys;
  - chips add on Enter, sliders move with arrow keys, accordions toggle `aria-expanded`, sorting updates `aria-sort`, the paginator changes page and rows, tooltips show on hover.
- **Empty-submit form probe** (dialogs only, read-only only): with required fields empty, Save/Submit must show errors and must not send a request. The guard aborts the request either way.

**Full run on live, test org, read-only (114 pages + chrome):** 97 failed, 17 skipped, 1 passed in 1.8 h. Every failure is a UI/UX finding; there were no harness errors.
- **Components seen and probed:**

  | Kind | Pages | Probed |
  |---|---:|---:|
  | text-input | 67 | 179 |
  | dropdown | 52 | 76 |
  | paginator | 45 | 45 |
  | checkbox | 42 | 34 |
  | sortable header | 22 | 43 |
  | column filter | 20 | 38 |
  | calendar | 10 | 14 |

  Also seen: textarea, switch, accordion, menu/split buttons, autocomplete, chips, password, number input, multiselect, editor and file upload. Radio, slider and tree do not occur on this org.
- **Top real issues to raise:**
  - **Accessible names:** unnamed controls in large numbers (checkboxes 975, column-filter buttons 279, dropdowns 132, icon buttons 102, text inputs 70).
  - **Column-filter menus:** Esc does not close them (19 pages).
  - **No focus ring** on text inputs (41 pages).
  - **Placeholder used as the only label** (56 pages).
  - **Sorting:** clicking a header doesn't update `aria-sort` (9 pages).
  - **Custom modals without `role="dialog"`** (8 pages: New Bill, New Payment …).
  - **Accordion** in "Create Label" doesn't toggle `aria-expanded`.
  - **Password not masked** in a "Add New" sidebar.
  - **Critical:** the "Create Label" form sends a save request with a required field empty.
