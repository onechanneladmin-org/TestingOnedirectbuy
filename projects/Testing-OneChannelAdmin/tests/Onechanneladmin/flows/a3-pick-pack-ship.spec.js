// @flow A3 — Pick → pack → ship. Guide: docs/qa/E2E-TEST-GUIDE.md § 5 A3 and § 6.5.
// Use cases: 1CA-UC-004, 005, 007, 008, 010, 021, 027.
// Writes: creates its own tagged order (2 × first E2E_TEST_SKUS), picks, packs, adds manual tracking,
// marks in transit, and reads every step back through the API. Needs writable (E2E_ALLOW_PROD_WRITES=1
// on the test org, or a dev host). The read-only validation steps (over-pick clamp, Show Rates
// required fields) run on the same order before anything is saved.
const { test, expect, expectTestOrg } = require("../../support/fixtures");
const { checkStep } = require("../../support/check-step");
const { qaTag, runIdNow } = require("../../support/guard");
const { pollUntil } = require("../../support/api");
const O = require("../../support/orders");
const F = require("../../support/fulfil");
const { createTestOrder, markPaidCash, cancelIfOpen, holdFor } = require("../../support/testOrder");

test.describe("A3 pick → pack → ship @flow", () => {
  test.describe.configure({ mode: "serial" });
  const QTY = 2;
  let created;

  test.beforeEach(async ({ writable }) => {
    test.skip(!writable.ok, `writes disabled: ${writable.reason}`);
  });

  test.afterAll(async ({ browser }) => {
    if (created) await cancelIfOpen(browser, created.orderId).catch(() => {});
  });

  test("1CA-UC-004 fulfillment panel: open lines, qty ≤ ordered, source suggestions", async ({ page, settings, health, api }, testInfo) => {
    const tag = qaTag(runIdNow(), "1CA-UC-004");
    await O.openOrdersList(page);
    await expectTestOrg(page, settings);
    created = await createTestOrder(page, api, settings, { tag, qty: QTY });
    await markPaidCash(page, api, created.orderId, { tag });
    const order = await api.readOrder(created.orderId);
    expect(O.linesOf(order)[0].quantity ?? O.linesOf(order)[0].cartCount, "API: ordered qty").toBe(QTY);
    const hold = await holdFor(api, created.sku, created.orderId);
    if (hold != null) expect(hold, "stock hold created for the ordered qty").toBe(QTY);

    await O.openOrder(page, created.orderId);
    const panel = await F.openFulfillmentPanel(page, created.orderId);
    await expect(panel.getByText(created.sku).first(), "panel lists the SKU").toBeVisible();
    const qtyCell = panel.locator("td").filter({ hasText: new RegExp(`^\\s*${QTY}\\s*$`) });
    await expect(qtyCell.first(), "panel shows the ordered qty").toBeVisible();
    await panel.locator(".p-dropdown").filter({ hasText: /Quantity:|Select|Source/ }).first().click();
    const sources = page.locator(".p-dropdown-panel:visible").getByRole("option");
    await expect(sources.first(), "source warehouses suggested with quantities").toContainText(/Quantity:\s*\d+/);
    await page.keyboard.press("Escape");
    await checkStep(page, testInfo, { id: "1CA-UC-004", name: "fulfillment panel", health, scope: ".p-sidebar" });
    await panel.locator(".p-sidebar-close").click();
  });

  test("1CA-UC-005 pick: assign, over-pick clamped, confirm qty 2 → task completed", async ({ page, settings, health, api }, testInfo) => {
    test.skip(!created, "needs the order from 1CA-UC-004");
    await F.openWmsOrder(page, created.orderId, settings.warehouse);
    await expectTestOrg(page, settings);
    await expect(page.locator(".status-unassigned").filter({ hasText: /pick/i }).first(), "pick is Unassigned before assign").toBeVisible();
    await F.assignTask(page, { kind: "pick", location: `${created.tag}-PICK`, email: settings.email, qty: QTY });
    let order = await api.readOrder(created.orderId);
    expect(F.sumQty(F.wmsJobs(order, "pick"), "assignedQuantity"), "API: pick assigned qty").toBe(QTY);
    await checkStep(page, testInfo, { id: "1CA-UC-005", name: "pick assigned", health });

    // Over-pick: the PICKED QTY. input is clamped to the assigned qty (max), so 5 becomes 2.
    const { body } = await F.confirmTask(page, { kind: "pick", qty: QTY + 3 });
    const sent = (body.forms || []).flatMap((f) => f.jobsAssigned || []);
    expect(F.sumQty(sent, "completedQuantity"), "over-pick blocked: completed qty sent ≤ assigned").toBeLessThanOrEqual(QTY);
    order = await pollUntil(() => api.readOrder(created.orderId), (o) => F.sumQty(F.wmsJobs(o, "pick"), "completedQuantity") === QTY, {
      message: "WMS pick task completed qty = 2",
    });
    expect(F.wmsJobs(order, "pick").every((j) => j.isComplete), "pick job marked complete").toBe(true);
    await checkStep(page, testInfo, { id: "1CA-UC-005", name: "pick confirmed", health });
  });

  test("1CA-UC-007 pack: assign and confirm → pack task done", async ({ page, settings, health, api }, testInfo) => {
    test.skip(!created, "needs the picked order");
    await F.openWmsOrder(page, created.orderId, settings.warehouse);
    await F.assignTask(page, { kind: "pack", location: `${created.tag}-PACK`, email: settings.email, qty: QTY });
    await F.confirmTask(page, { kind: "pack", qty: QTY });
    const order = await pollUntil(() => api.readOrder(created.orderId), (o) => F.sumQty(F.wmsJobs(o, "pack"), "completedQuantity") === QTY, {
      message: "WMS pack task completed qty = 2",
    });
    expect(F.wmsJobs(order, "pack").every((j) => j.isComplete), "pack job marked complete").toBe(true);
    await checkStep(page, testInfo, { id: "1CA-UC-007", name: "pack confirmed", health });
  });

  test("1CA-UC-008 shipping: Show Rates needs dimensions; manual tracking saved to the order", async ({ page, settings, health, api }, testInfo) => {
    test.skip(!created, "needs the packed order");
    await O.openOrder(page, created.orderId);
    await expectTestOrg(page, settings);
    const panel = await F.openFulfillmentPanel(page, created.orderId);
    await F.startShipping(page, panel, { warehouse: settings.warehouse });

    // Buy-label dialog: Show Rates without dimensions is refused before any rate call.
    const buy = panel.getByRole("button", { name: /Buy Shipp+ing Label/ });
    if (await buy.isVisible().catch(() => false)) {
      await buy.click();
      const label = O.dialog(page, "Shipping Label");
      await expect(label).toBeVisible();
      await label.getByRole("button", { name: "Show Rates" }).click();
      await expect(O.toasts(page).filter({ hasText: /cannot be empty or 0/ }).first(), "dimensions required").toBeVisible();
      await checkStep(page, testInfo, { id: "1CA-UC-008", name: "shipping label dialog", health, scope: ".p-dialog" });
      await label.locator(".p-dialog-header-close").click();
    } else {
      testInfo.annotations.push({ type: "note", description: "Buy Shipping Label not offered (no carrier integration) — manual tracking only" });
    }

    const trackingNumber = `QA${Date.now()}`;
    const sent = await F.saveManualTracking(page, panel, { trackingNumber, carrier: "UPS" });
    expect((sent.tracking || []).map((t) => t.trackingNumber), "tracking sent with Save Shipping").toContain(trackingNumber);
    const order = await pollUntil(() => api.readOrder(created.orderId), (o) =>
      JSON.stringify(O.linesOf(o).map((l) => l.tracking || [])).includes(trackingNumber), { message: "tracking saved on the order" });
    expect(order).toBeTruthy();
    created.trackingNumber = trackingNumber;
    await checkStep(page, testInfo, { id: "1CA-UC-008", name: "tracking saved", health, scope: ".p-sidebar" });
  });

  test("1CA-UC-010 mark in transit: confirmation, status changes, tracking shown", async ({ page, settings, health, api }, testInfo) => {
    test.skip(!created || !created.trackingNumber, "needs the order with tracking");
    await O.openOrder(page, created.orderId);
    const panel = await F.openFulfillmentPanel(page, created.orderId);
    const body = await F.markInTransit(page, panel);
    expect(body.orderId).toBe(created.orderId);
    const order = await pollUntil(() => api.readOrder(created.orderId), (o) =>
      /transit|shipped/i.test(JSON.stringify(O.linesOf(o).map((l) => l.status || (l.attributes && l.attributes.status)))), { message: "line status = in transit / shipped" });
    expect(order.canShipCompleteOrder, "nothing left to ship").toBeFalsy();
    await O.openOrder(page, created.orderId);
    await expect(page.getByText(created.trackingNumber).first(), "tracking number shown on details").toBeVisible();
    await checkStep(page, testInfo, { id: "1CA-UC-010", name: "in transit", health });
  });

  test("1CA-UC-021 fulfilled qty popup: totals = fulfilled qty", async ({ page, health }, testInfo) => {
    test.skip(!created || !created.trackingNumber, "needs the shipped order");
    await O.openOrder(page, created.orderId);
    const btn = O.action(page, O.BUTTONS.fulfilledSources).first();
    await btn.click();
    const dlg = O.dialog(page, /Fulfilled Qty/);
    await expect(dlg).toBeVisible();
    const qtys = ((await dlg.innerText()).match(/\b\d+\b/g) || []).map(Number);
    expect(qtys, `fulfilled qty ${QTY} shown`).toContain(QTY);
    await checkStep(page, testInfo, { id: "1CA-UC-021", name: "fulfilled qty popup", health, scope: ".p-dialog" });
  });

  test("1CA-UC-027 WMS batch assign: selected orders get a pick task", async ({ page, settings, health, api, writable }, testInfo) => {
    test.skip(!writable.ok, writable.reason);
    const tag = qaTag(runIdNow(), "1CA-UC-027");
    await O.openOrdersList(page);
    const batch = await createTestOrder(page, api, settings, { tag, qty: 1 });
    try {
      await F.openWmsOrder(page, batch.orderId, settings.warehouse);
      await page.locator(".p-datatable tbody tr").filter({ hasText: batch.orderId }).locator(".p-checkbox").first().click();
      await page.getByRole("button", { name: /Actions/ }).click();
      await page.getByRole("menuitem", { name: "Batch Assign WMS" }).click();
      const dlg = O.dialog(page, "Batch Assign");
      await expect(dlg).toBeVisible();
      await F.chooseOption(page, dlg, /Pick|Pack|Select/, /^Pick$/);
      await F.pickUser(page, dlg, settings.email);
      await checkStep(page, testInfo, { id: "1CA-UC-027", name: "batch assign dialog", health, scope: ".p-dialog" });
      const [res] = await Promise.all([
        page.waitForResponse((r) => r.url().includes("createBulkWmsOrder")),
        dlg.getByRole("button", { name: "Update" }).click(),
      ]);
      expect(res.status()).toBeLessThan(400);
      await pollUntil(() => api.readOrder(batch.orderId), (o) => F.wmsJobs(o, "pick").length > 0, { message: "pick task in the queue" });
    } finally {
      await cancelIfOpen(page.context().browser(), batch.orderId).catch(() => {});
    }
  });
});
