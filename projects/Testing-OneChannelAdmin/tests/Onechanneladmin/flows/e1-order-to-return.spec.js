// @flow E1 — Full end to end: ODB order → 1CA fulfil → refund → return. Guide: docs/qa/E2E-TEST-GUIDE.md § 5 E1.
// Use cases: Main_v2 Flow=E1 (ODB-UC-261…279) + 1CA-UC-002, 1CA-UC-009.
//
// Writes on BOTH systems, so it runs only when:
//   - 1CA writes are allowed on the test org (writable.ok: E2E_ALLOW_PROD_WRITES=1 or a dev/staging host);
//   - the ODB target is non-production, ODB_ALLOW_ORDERS=1 and the test buyer is set (support/odb.js),
//     the buyer has a saved address, and Stripe is in test mode (checked before Pay).
// The ODB order uses the first E2E_TEST_SKUS SKU (bin stock in E2E_WAREHOUSE of the test org).
// Cleanup: the order ends refunded + returned (kept as tagged history, guide § 5 E1); if a step fails
// before the refund, afterAll cancels whatever is still open.
const { test, expect, expectTestOrg } = require("../../support/fixtures");
const { checkStep } = require("../../support/check-step");
const { cents, expectMoney } = require("../../support/money");
const { pollUntil } = require("../../support/api");
const { recordOrder, cancelIfOpen, holdFor } = require("../../support/testOrder");
const O = require("../../support/orders");
const F = require("../../support/fulfil");
const ODB = require("../../support/odb");

const QTY = 2;
const lineStatus = (o) => JSON.stringify(O.linesOf(o).map((l) => [l.status, l.attributes && l.attributes.status]));

async function lineMenu(page, item) {
  const direct = page.getByRole("button", { name: item });
  if (await direct.first().isVisible().catch(() => false)) return direct.first().click();
  await page.locator(".pi-ellipsis-v, [aria-label*='more' i], [aria-label*='actions' i]").first().click();
  await page.getByRole("menuitem", { name: item }).click();
}

test.describe("E1 ODB order → 1CA fulfil → refund → return @flow", () => {
  test.describe.configure({ mode: "serial" });
  const odb = ODB.odbSettings();
  const run = {}; // { sku, odbNumber, shownCents, auth, orderId, tracking, refund }
  let buyer; // { context, page } — the ODB buyer's own browser context (no 1CA session in it)

  test.beforeEach(async ({ writable }) => {
    test.skip(!writable.ok, `1CA writes disabled: ${writable.reason}`);
    test.skip(!odb.ok, odb.reason);
  });

  test.afterAll(async ({ browser }) => {
    if (run.orderId && !run.refund) await cancelIfOpen(browser, run.orderId).catch(() => {});
    if (buyer) await buyer.context.close().catch(() => {});
  });

  test("ODB-UC-261…263 buyer: cart qty 2 → checkout (card 4242) → confirmation; order = buyer API", async ({ browser, settings }, testInfo) => {
    run.sku = settings.testSkus[0];
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    buyer = { context, page: await context.newPage() };
    const { page } = buyer;
    run.auth = await ODB.signInBuyer(page, odb);
    const before = (await ODB.buyerOrders(odb, run.auth)).map(ODB.orderKey);

    await ODB.addSkuToCart(page, odb, run.sku, QTY);
    await expect(page.getByRole("spinbutton").first(), "cart qty").toHaveValue(String(QTY));
    await testInfo.attach("odb-cart.png", { body: await page.screenshot(), contentType: "image/png" });
    run.shownCents = await ODB.checkoutAndPay(page, odb);
    await testInfo.attach("odb-confirmation.png", { body: await page.screenshot(), contentType: "image/png" });

    let fresh = [];
    await expect.poll(async () => {
      fresh = (await ODB.buyerOrders(odb, run.auth)).filter((o) => !before.includes(ODB.orderKey(o)));
      return fresh.length;
    }, { message: "new order on GET /user/orders", timeout: 60_000 }).toBe(1);
    const order = fresh[0];
    run.odbNumber = ODB.orderKey(order);
    testInfo.annotations.push({ type: "odb-order", description: run.odbNumber });
    expectMoney(order.total ?? order.grandTotal ?? order.totals?.total, run.shownCents / 100, "ODB order total = total shown at checkout");
  });

  test("1CA-UC-002 the ODB order reaches 1CA (≤ 60 s) with the same SKU and qty; stock hold created", async ({ page, settings, health, api }, testInfo) => {
    test.skip(!run.odbNumber, "needs the ODB order");
    await O.openOrdersList(page);
    await expectTestOrg(page, settings);
    const hit = await pollUntil(
      () => O.findOrder(api, (o) => JSON.stringify(o).includes(run.odbNumber), { pages: 2, searchText: run.odbNumber }),
      (o) => Boolean(o),
      { timeout: 60_000, interval: 5_000, message: `ODB order ${run.odbNumber} in 1CA` },
    );
    run.orderId = String(hit.orderId);
    recordOrder(run.orderId, `qa-e2e-E1-${run.odbNumber}`);
    const order = await api.readOrder(run.orderId);
    const line = O.linesOf(order).find((l) => JSON.stringify(l).includes(run.sku));
    expect(line, `1CA order has the SKU ${run.sku}`).toBeTruthy();
    expect(Number(line.quantity ?? line.cartCount), "1CA qty = ODB qty").toBe(QTY);
    const hold = await holdFor(api, run.sku, run.orderId);
    if (hold != null) expect(hold, "stock hold = ordered qty").toBe(QTY);

    await O.openOrdersList(page, { search: run.odbNumber });
    await expect(page.getByText(run.orderId).first(), "order row in the list").toBeVisible();
    await checkStep(page, testInfo, { id: "1CA-UC-002", name: "ODB order in 1CA list", health });
    await O.openOrder(page, run.orderId);
    await expect(page.getByText(run.sku).first()).toBeVisible();
    await checkStep(page, testInfo, { id: "ODB-UC-264", name: "1CA order details", health });
  });

  test("ODB-UC-265…268 pick 2 → pack → manual tracking → in transit", async ({ page, settings, health, api }, testInfo) => {
    test.skip(!run.orderId, "needs the 1CA order");
    await F.openWmsOrder(page, run.orderId, settings.warehouse);
    await F.assignTask(page, { kind: "pick", location: `E1-${run.orderId}-PICK`, email: settings.email, qty: QTY });
    await F.confirmTask(page, { kind: "pick", qty: QTY });
    await pollUntil(() => api.readOrder(run.orderId), (o) => F.sumQty(F.wmsJobs(o, "pick"), "completedQuantity") === QTY, { message: "pick qty = 2" });
    await checkStep(page, testInfo, { id: "ODB-UC-265", name: "picked", health });
    await F.assignTask(page, { kind: "pack", location: `E1-${run.orderId}-PACK`, email: settings.email, qty: QTY });
    await F.confirmTask(page, { kind: "pack", qty: QTY });
    await pollUntil(() => api.readOrder(run.orderId), (o) => F.sumQty(F.wmsJobs(o, "pack"), "completedQuantity") === QTY, { message: "pack qty = 2" });
    await checkStep(page, testInfo, { id: "ODB-UC-266", name: "packed", health });

    await O.openOrder(page, run.orderId);
    const panel = await F.openFulfillmentPanel(page, run.orderId);
    await F.startShipping(page, panel, { warehouse: settings.warehouse });
    run.tracking = `QA${Date.now()}`;
    await F.saveManualTracking(page, panel, { trackingNumber: run.tracking, carrier: "UPS" });
    await F.markInTransit(page, panel);
    await pollUntil(() => api.readOrder(run.orderId), (o) => /transit|shipped/i.test(lineStatus(o)), { message: "1CA line in transit" });
    await checkStep(page, testInfo, { id: "ODB-UC-268", name: "in transit", health });
  });

  test("ODB-UC-269 buyer sees Shipped with the same tracking number", async ({}, testInfo) => {
    test.skip(!run.tracking || !buyer, "needs the shipped order");
    const order = await pollUntil(
      async () => (await ODB.buyerOrders(odb, run.auth)).find((o) => ODB.orderKey(o) === run.odbNumber),
      (o) => o && JSON.stringify(o).includes(run.tracking),
      { timeout: 120_000, interval: 10_000, message: "tracking on the ODB buyer API" },
    );
    expect(String(order.status || order.orderStatus), "ODB status").toMatch(/ship|transit/i);
    await buyer.page.goto(`${odb.baseURL}/account/orders`);
    await buyer.page.getByText(run.odbNumber).first().click();
    await expect(buyer.page.getByText(run.tracking).first(), "tracking shown to the buyer").toBeVisible({ timeout: 30_000 });
    await testInfo.attach("odb-shipped.png", { body: await buyer.page.screenshot(), contentType: "image/png" });
  });

  test("1CA-UC-009 / ODB-UC-270…272 refund one line = line amount; buyer sees it; no second refund", async ({ page, settings, health, api }, testInfo) => {
    test.skip(!run.tracking, "needs the shipped order");
    await O.openOrder(page, run.orderId);
    await expectTestOrg(page, settings);
    const before = await api.readOrder(run.orderId);
    const line = O.linesOf(before)[0];
    await O.action(page, O.BUTTONS.refund).first().click();
    const panel = O.sidebar(page, "Refund Order");
    await expect(panel).toBeVisible();
    await panel.locator(".p-dropdown").filter({ hasText: "Select Reason" }).first().click();
    await page.locator(".p-dropdown-panel:visible").getByRole("option", { name: "Buyer Cancel", exact: true }).click();
    await panel.getByPlaceholder("Notes").fill(`qa-e2e-E1-${run.odbNumber}`);
    const decision = panel.locator(".p-dropdown").filter({ hasText: /Select Refund|Full Refund/ }).first();
    if (await decision.isEnabled()) {
      await decision.click();
      await page.locator(".p-dropdown-panel:visible").getByRole("option", { name: "Full Refund", exact: true }).click();
    }
    await checkStep(page, testInfo, { id: "1CA-UC-009", name: "refund filled", health, scope: ".p-sidebar" });
    const sent = await O.expectModifyOrder(page, () => panel.getByRole("button", { name: /^\s*(Refund|Initiate Refund)\s*$/ }).click(), { status: "refunded" });
    expect(sent.status, "refund call").toBeLessThan(400);
    await O.expectSuccessToast(page, "refund");
    const after = await api.readOrder(run.orderId);
    const refunds = after.refundDetails || O.linesOf(after)[0].refundDetails || [];
    expect(refunds.length, "refund row recorded").toBeGreaterThan(0);
    expectMoney(refunds[refunds.length - 1].refundValue, line.amountLeftToRefund ?? before.orderTotal, "refund = line amount (incl. tax share)");
    expect(after.canRefundCompleteOrder, "no second refund offered").toBeFalsy();
    run.refund = refunds[refunds.length - 1].refundValue;

    const odbOrder = await pollUntil(
      async () => (await ODB.buyerOrders(odb, run.auth)).find((o) => ODB.orderKey(o) === run.odbNumber),
      (o) => o && /refund/i.test(JSON.stringify(o)),
      { timeout: 120_000, interval: 10_000, message: "refund on the ODB buyer API" },
    );
    expect(odbOrder).toBeTruthy();
    if (buyer) {
      await buyer.page.reload();
      await expect(buyer.page.getByText(/refund/i).first(), "buyer sees the refund").toBeVisible({ timeout: 30_000 });
      const amounts = ((await buyer.page.locator("body").innerText()).match(/\$\s*[\d,]+\.\d{2}/g) || []).map((t) => cents(t.replace(/[$,\s]/g, "")));
      expect(amounts, "refund amount shown to the buyer").toContain(cents(run.refund));
      await testInfo.attach("odb-refund.png", { body: await buyer.page.screenshot(), contentType: "image/png" });
    }
  });

  test("ODB-UC-273…279 delivered → return with RMA → WMS receive + restock", async ({ page, settings, health, api }, testInfo) => {
    test.skip(!run.refund, "needs the refunded order");
    await O.openOrder(page, run.orderId);
    await lineMenu(page, /Mark as Delivered/);
    await O.expectModifyOrder(page, () => O.confirmYes(page, "Confirmation"), { status: "delivered" });
    await pollUntil(() => api.readOrder(run.orderId), (o) => /delivered/i.test(lineStatus(o)), { message: "delivered" });
    await O.openOrder(page, run.orderId);
    await lineMenu(page, /Initialize Return/);
    await O.expectModifyOrder(page, () => O.confirmYes(page, "Confirmation"), { status: "returninitialized" });
    await O.openOrder(page, run.orderId);
    await O.action(page, O.BUTTONS.approveReturn).first().click();
    const panel = O.sidebar(page, /Approve Return/);
    await expect(panel).toBeVisible();
    await F.chooseOption(page, panel, "Select Reply", /^Received Damaged$/);
    await panel.getByRole("button", { name: "Generate RMA" }).click();
    const rma = await panel.getByPlaceholder("Enter RMA No.").inputValue();
    expect(rma, "RMA generated").toMatch(new RegExp(`_RMA_${run.orderId}$`));
    await panel.locator(".p-dropdown").filter({ hasText: /Select|Return to Source/ }).first().click();
    await page.locator(".p-dropdown-panel:visible").getByRole("option").first().click();
    const label = panel.locator(".p-dropdown").filter({ hasText: "Select Shipping Label" });
    if (await label.isVisible().catch(() => false)) await F.chooseOption(page, panel, "Select Shipping Label", /^Customer own label$/);
    await O.expectModifyOrder(page, () => panel.getByRole("button", { name: /^\s*Return\s*$/ }).click(), { status: "returned" });
    await checkStep(page, testInfo, { id: "ODB-UC-275", name: "return approved", health });

    const { stockOf } = require("../../support/testOrder");
    const stockBefore = await stockOf(api, run.sku);
    await page.goto("/wms/returns");
    const row = page.locator(".p-datatable tbody tr").filter({ hasText: run.orderId }).first();
    await expect(row, "return listed in WMS Returns").toBeVisible();
    await row.getByText("Pending").first().click();
    const recv = O.dialog(page, "Quantity Received");
    await recv.getByPlaceholder("Enter quantity").fill(String(QTY));
    await recv.getByRole("button", { name: "Good" }).click();
    await F.chooseOption(page, recv, "Select restock type", /Restock To Inventory/);
    const loc = recv.locator(".p-dropdown").filter({ hasText: "Select location" });
    if (await loc.isVisible().catch(() => false)) {
      await loc.click();
      await page.locator(".p-dropdown-panel:visible").getByRole("option").first().click();
    }
    const [res] = await Promise.all([page.waitForResponse((r) => r.url().includes(F.WMS_MODIFY)), recv.getByRole("button", { name: /^\W*Update\s*$/ }).click()]);
    expect(res.status()).toBeLessThan(400);
    await checkStep(page, testInfo, { id: "ODB-UC-279", name: "return received + restocked", health });
    if (stockBefore != null) {
      const stockAfter = await stockOf(api, run.sku);
      expect(stockAfter, "stock not reduced by a restock, never negative").toBeGreaterThanOrEqual(Math.max(0, stockBefore));
    }
  });
});
