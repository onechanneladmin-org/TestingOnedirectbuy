// The flow's OWN test order (guide § 2.2: each test creates its own data, tags it, cleans it up).
//
// Arrange is done through the API the create screen itself calls (POST inventory/orders/createOrder):
// test orgs get the React Native Web create page (shared-ui NewRentalOrder, 26k lines) whose product
// picker has no stable selectors yet, and the order screens — not order creation — are what A3–A7
// test. Creation through the UI is covered separately once that page gets data-testids.
//
// Every created order carries the tag `qa-e2e-<runId>-<caseId>` in notes / deliveryNotes / e2eTag.
const { expect } = require("@playwright/test");
const { settle } = require("./page-health");
const { cents } = require("./money");
const O = require("./orders");

/**
 * Ledger of the orders THIS checkout created (gitignored, next to the auth state). Other suites use the
 * same "QA qa-e2e-…" naming on the shared test org, so scripts/qa-cleanup-orders.js cancels only these ids.
 */
const LEDGER = require("path").join(require("./env").PROJECT_ROOT, "playwright", ".auth", "qa-orders.jsonl");
function recordOrder(orderId, tag) {
  const fs = require("fs");
  fs.mkdirSync(require("path").dirname(LEDGER), { recursive: true });
  fs.appendFileSync(LEDGER, JSON.stringify({ orderId: String(orderId), tag, at: new Date().toISOString() }) + "\n");
}

/** Catalog record for a SKU (GET inventory/catalog?sku=…) — used as the order line. */
async function catalogItem(api, sku) {
  const res = await api.get(`/inventory/catalog`, { params: { sku, is3pl: "false", threeplClientId: "" } });
  if (res.status >= 400 || !res.json) throw new Error(`catalog ${sku}: HTTP ${res.status}`);
  const d = res.json.data;
  return Array.isArray(d) ? d[0] : d;
}

/** Held qty of one onHoldQtys entry: { source, location: "OnHold", orderId, value: -n } (value is negative). */
const holdQty = (h) => Math.abs(Number(h.value != null ? h.value : h.quantity || h.qty || 0) || 0);

/**
 * Available quantity of a SKU in one warehouse (default: all). alltotalqtyUI is already net of the
 * holds (seen: wh1 2 → 0 after two 1-qty orders), so holds are not subtracted again.
 * null when the backend does not return the field (the stock asserts are then skipped, not faked).
 */
async function stockOf(api, sku, wh) {
  const item = await catalogItem(api, sku).catch(() => null);
  if (!item || item.alltotalqtyUI == null) return null;
  const qty = (v) => Number(v && v.quantity != null ? v.quantity : v) || 0;
  if (wh) return qty(item.alltotalqtyUI[wh]);
  return Object.values(item.alltotalqtyUI).reduce((s, v) => s + qty(v), 0);
}

/** Held qty for one order on a SKU (onHoldQtys entries reference the order id). */
async function holdFor(api, sku, orderId) {
  const item = await catalogItem(api, sku).catch(() => null);
  if (!item || item.onHoldQtys == null) return null;
  const list = Array.isArray(item.onHoldQtys) ? item.onHoldQtys : Object.entries(item.onHoldQtys).map(([k, v]) => ({ orderId: k, quantity: v }));
  return list.filter((h) => String(h.orderId || h.orderid || "") === String(orderId)).reduce((s, h) => s + holdQty(h), 0);
}

/**
 * Create a D2C "Pay Later" order for `qty` of `sku` (default: first E2E_TEST_SKUS), tagged with `tag`.
 * Returns { orderId, sku, qty, tag }.
 */
/**
 * First E2E_TEST_SKUS entry with at least `qty` in the flow warehouse. The test org is shared with
 * other suites that hold stock too, so a fixed first SKU runs dry ("kept is more than available").
 */
async function pickSku(api, settings, qty = 1) {
  for (const sku of settings.testSkus) {
    const q = await stockOf(api, sku, settings.warehouse);
    if (q == null || q >= qty) return sku;
  }
  return settings.testSkus[0];
}

async function createTestOrder(page, api, settings, { tag, qty = 1, sku } = {}) {
  sku = sku || (await pickSku(api, settings, qty));
  if (!tag) throw new Error("createTestOrder needs a qa tag");
  if (!page.url().startsWith("http")) await O.openOrdersList(page);
  const product = await catalogItem(api, sku);
  expect(product, `test SKU ${sku} exists in the test org catalog`).toBeTruthy();
  const email = settings.customer || settings.email;
  const address = { firstName: "QA", lastName: tag, name: `QA ${tag}`, email, address1: "1 Test St", city: "Orlando", state: "FL", zip: "32801", country: "US" };
  const body = {
    id: "order",
    isB2b: false,
    // The backend refuses a line without a source warehouse ("Warehouse missing for Item").
    items: [{ ...product, sku, quantity: qty, cartCount: qty, warehouseToProcess: { [settings.warehouse]: qty }, sourcewarehouseToProcess: settings.warehouse }],
    warehouseToProcess: { [settings.warehouse]: qty },
    sourcewarehouseToProcess: [settings.warehouse],
    email,
    firstName: "QA",
    lastName: tag,
    billing: address,
    shipping: address,
    notes: tag,
    deliveryNotes: tag,
    e2eTag: tag,
    paymentDetails: "paylater",
    paymentTiming: "Pay Later",
  };
  const res = await api.write("/inventory/orders/createOrder", body);
  expect(res.status, `createOrder: ${res.text.slice(0, 200)}`).toBeLessThan(400);
  expect(res.json && res.json.error, `createOrder error: ${res.json && res.json.message}`).not.toBe(true);

  // The response shape varies (data.orderId / orderId / data[0]); fall back to finding the tagged order.
  const d = res.json && (res.json.data || res.json);
  let orderId = d && (d.orderId || (Array.isArray(d) && d[0] && d[0].orderId));
  if (!orderId) {
    const found = await O.findOrder(api, (o) => JSON.stringify(o).includes(tag), { searchText: sku, pages: 2 });
    orderId = found && found.orderId;
  }
  expect(orderId, `created order tagged ${tag} is listed`).toBeTruthy();
  recordOrder(orderId, tag);
  return { orderId: String(orderId), sku, qty, tag };
}

/**
 * Mark the order paid with cash through the order details "Mark as paid" dialog
 * (OrderDetailsNew/components/MarkAsPaidDialog.tsx): Choose Method → "Pay with cash", Amount, Update.
 */
async function markPaidCash(page, api, orderId, { tag } = {}) {
  await O.openOrder(page, orderId);
  const before = await api.readOrder(orderId);
  const due = Number(before.AmountToTakeOrGive || before.orderTotal || 0);
  if (!(due > 0)) return before;
  await O.action(page, O.BUTTONS.markAsPaid).first().click();
  const dlg = O.dialog(page, /Mark as Paid/);
  await expect(dlg).toBeVisible();
  await dlg.locator(".p-dropdown").first().click();
  await page.locator(".p-dropdown-panel:visible").getByRole("option", { name: /Pay with cash/i }).click();
  const amountBox = dlg.getByPlaceholder(due.toFixed(2)).or(dlg.locator(".p-inputnumber input")).first();
  if (await amountBox.isVisible().catch(() => false)) await amountBox.fill(due.toFixed(2));
  const note = dlg.getByPlaceholder("Add note");
  if (tag && (await note.isVisible().catch(() => false))) await note.fill(tag);
  await O.expectModifyOrder(page, () => dlg.getByRole("button", { name: /^\W*(Update|Save)\s*$/ }).click());
  await O.expectSuccessToast(page, "mark as paid");
  await settle(page);
  const after = await api.readOrder(orderId);
  expect(cents(after.AmountToTakeOrGive || 0), "API: nothing left to pay after cash payment").toBe(0);
  return after;
}

/** Cleanup: cancel the flow's order if it is still open (afterAll). Never touches untagged orders. */
async function cancelIfOpen(browser, orderId, { storageState } = {}) {
  const { AUTH_FILE } = require("./env");
  const { trackBackend } = require("./api");
  const context = await browser.newContext({ storageState: storageState || AUTH_FILE });
  const page = await context.newPage();
  try {
    const api = trackBackend(page);
    await page.goto(O.LIST_PATH);
    const order = await api.readOrder(orderId);
    if (!order || !/qa-e2e-/.test(JSON.stringify(order))) return;
    if (!order.canCancelCompleteOrder) return;
    await api.write(O.MODIFY_ORDER, {
      orderId,
      status: "cancelled",
      marketplace: order.marketplace,
      cancelState: "Approve",
      reason: "qa-e2e cleanup",
      cancelDetails: { cancelReason: "custom", customReason: "qa-e2e cleanup" },
    });
  } finally {
    await context.close();
  }
}

module.exports = { LEDGER, recordOrder, pickSku, catalogItem, stockOf, holdFor, createTestOrder, markPaidCash, cancelIfOpen };
