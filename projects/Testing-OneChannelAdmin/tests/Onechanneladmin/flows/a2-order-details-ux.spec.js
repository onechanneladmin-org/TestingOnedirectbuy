// @flow A2 — Orders list → details → popups (READ-ONLY). Guide: docs/qa/E2E-TEST-GUIDE.md § 5 A2.
// Use cases: 1CA-UC-001, 003, 019, 020, 022–026 (+ the popup rows 008, 009, 011, 014, 017, 023).
// Run with E2E_READ_ONLY=1: the netGuard then aborts every write, so opening a popup can never save.
// Popups are opened and closed only; the walk also proves no modifyOrder call was made.
const { test, expect, expectTestOrg } = require("../../support/fixtures");
const { settle } = require("../../support/page-health");
const { checkStep, checkPopupKeyboard } = require("../../support/check-step");
const { cents } = require("../../support/money");
const O = require("../../support/orders");

/** id, name, opener button, and how the panel is found (sidebar <h6> title or dialog header). */
const POPUPS = [
  { id: "1CA-UC-011", name: "refund panel", button: O.BUTTONS.refund, panel: (p) => O.sidebar(p, "Refund Order") },
  { id: "1CA-UC-014", name: "approve return panel", button: O.BUTTONS.approveReturn, panel: (p) => O.sidebar(p, /Approve (Return|Pickup)/) },
  { id: "1CA-UC-017", name: "cancel order panel", button: O.BUTTONS.cancel, panel: (p) => O.sidebar(p, "Cancel Order") },
  { id: "1CA-UC-008", name: "fulfillment / shipping panel", button: O.BUTTONS.fulfillment, panel: (p) => O.sidebar(p, /Order Fulfillment|Work Order Details/) },
  { id: "1CA-UC-022", name: "mark as paid popup", button: O.BUTTONS.markAsPaid, panel: (p) => O.dialog(p, /Mark as Paid/) },
  { id: "1CA-UC-023", name: "email logs popup", button: O.BUTTONS.emailLogs, panel: (p) => O.dialog(p, "Email Logs") },
  { id: "1CA-UC-024", name: "purchase details popup", button: O.BUTTONS.orderCost, panel: (p) => O.dialog(p, "Purchase Details") },
  { id: "1CA-UC-025", name: "refund details popup", button: O.BUTTONS.refundDetails, panel: (p) => O.dialog(p, "Refund Details") },
  { id: "1CA-UC-026", name: "return details popup", button: O.BUTTONS.returnDetails, panel: (p) => O.dialog(p, /Return Details|Pickup Details/) },
  { id: "1CA-UC-009", name: "fulfilled qty popup", button: O.BUTTONS.fulfilledSources, panel: (p) => O.dialog(p, /Fulfilled Qty/) },
];

const VIEWPORTS = [
  { name: "desktop", viewport: { width: 1440, height: 900 } },
  { name: "phone", viewport: { width: 390, height: 844 } },
];

/** An order of the test org that shows as many action buttons as possible (or E2E_ORDER_ID). */
async function pickOrder(api, settings) {
  if (settings.orderId) return settings.orderId;
  const rich = await O.findOrder(api, (o) => o.canRefundCompleteOrder && o.canCancelCompleteOrder);
  const any = rich || (await O.findOrder(api, (o) => o.canRefundCompleteOrder || o.canCancelCompleteOrder || o.canShipCompleteOrder));
  return any ? any.orderId : null;
}

test.describe("A2 orders list → details → popups @flow", () => {
  test.beforeEach(async ({ settings }) => {
    test.skip(!settings.readOnly, "A2 is a read-only walk: run it with E2E_READ_ONLY=1.");
  });

  test("1CA-UC-001 orders list loads with test-org orders only", async ({ page, settings, health, api }, testInfo) => {
    await O.openOrdersList(page);
    await expectTestOrg(page, settings);
    await api.ready();
    expect(api.state.headers.clientname, "list is requested for the test org").toBe(settings.orgId);
    // The screen shows up to 50 rows; read a wider API page so every visible id can be found.
    const { rows, total, status } = await api.listOrders({ limit: 200 });
    expect(status, "orders list API").toBeLessThan(400);
    expect(total, "the test org has orders to test with").toBeGreaterThan(0);
    const ids = await O.orderIdsOnList(page);
    expect(ids.length, "the table links to order details").toBeGreaterThan(0);
    // Every id on screen is an id the API returns for this org (no other org's data).
    const apiIds = new Set(rows.map((r) => String(r.orderId)));
    expect(ids.filter((id) => !apiIds.has(id)), "ids on screen that the org's API list does not return").toEqual([]);
    await checkStep(page, testInfo, { id: "1CA-UC-001", name: "orders list", health });
  });

  test("1CA-UC-019 search narrows the list to the searched order", async ({ page, settings, health, api }, testInfo) => {
    await O.openOrdersList(page);
    await expectTestOrg(page, settings);
    const [target] = await O.orderIdsOnList(page);
    test.skip(!target, "no orders on the list");
    const all = await api.listOrders({ limit: 5 });
    await O.openOrdersList(page, { search: target });
    const ids = await O.orderIdsOnList(page);
    expect(ids, "the searched order is listed").toContain(target);
    expect(ids.every((id) => id.includes(target) || target.includes(id)), `only matching orders: ${ids.join(", ")}`).toBe(true);
    const narrowed = await api.listOrders({ searchText: target, limit: 5 });
    expect(narrowed.total, "API: search total ≤ unfiltered total").toBeLessThanOrEqual(all.total);
    expect(narrowed.rows.map((r) => String(r.orderId)), "API returns the searched order").toContain(target);
    await checkStep(page, testInfo, { id: "1CA-UC-019", name: "orders list searched", health });
  });

  test("1CA-UC-003 / 1CA-UC-020 order details match the API (totals, payment status)", async ({ page, settings, health, api }, testInfo) => {
    await O.openOrdersList(page);
    await expectTestOrg(page, settings);
    const orderId = await pickOrder(api, settings);
    test.skip(!orderId, "No suitable order in the test org and E2E_ORDER_ID not set.");
    await O.openOrder(page, orderId);
    const order = await api.readOrder(orderId);
    expect(order, `API returns order ${orderId}`).toBeTruthy();
    const body = await page.locator("body").innerText();
    const shown = (body.match(/[$€£]\s?\d[\d,]*\.\d{2}/g) || []).map(cents);
    expect(shown, `order total ${order.orderTotal} is shown on the page`).toContain(cents(order.orderTotal));
    if (order.orderPaymentStatus) {
      const words = String(order.orderPaymentStatus).replace(/_/g, " ").toLowerCase();
      expect(body.toLowerCase(), `payment status "${order.orderPaymentStatus}" shown`).toMatch(
        new RegExp(words.split(" ")[0])
      );
    }
    await checkStep(page, testInfo, { id: "1CA-UC-003", name: "order details", health });
  });

  for (const vp of VIEWPORTS) {
    test.describe(`popups @ ${vp.name}`, () => {
      test.use({ viewport: vp.viewport });

      test(`1CA-UC-020 each order popup opens, passes checkStep, keeps focus, closes, saves nothing @ ${vp.name}`, async ({ page, settings, health, api }, testInfo) => {
        await O.openOrdersList(page);
        await expectTestOrg(page, settings);
        const orderId = await pickOrder(api, settings);
        test.skip(!orderId, "No suitable order in the test org and E2E_ORDER_ID not set.");
        await O.openOrder(page, orderId);
        await checkStep(page, testInfo, { id: "1CA-UC-020", name: `order details ${vp.name}`, health });

        let opened = 0;
        for (const p of POPUPS) {
          await test.step(`${p.id} ${p.name}`, async () => {
            const btn = O.action(page, p.button).first();
            if (!(await btn.isVisible().catch(() => false))) {
              testInfo.annotations.push({ type: "skipped-step", description: `${p.id} ${p.name}: button not shown for order ${orderId}` });
              return;
            }
            const writes = await O.countModifyCalls(page, async () => {
              await btn.click();
              const panel = p.panel(page);
              await expect(panel, `${p.id}: panel opens with its title`).toBeVisible();
              opened++;
              await checkStep(page, testInfo, { id: p.id, name: `${p.name} ${vp.name}`, health, scope: ".p-sidebar, .p-dialog" });
              await checkPopupKeyboard(page, panel, { id: p.id, name: p.name });
              await O.closePanel(page, panel, testInfo, p.id);
            });
            expect(writes, `${p.id}: opening/closing the panel must not save`).toBe(0);
            await settle(page);
          });
        }
        expect(opened, `order ${orderId} showed no action buttons at all — set E2E_ORDER_ID`).toBeGreaterThan(0);
      });
    });
  }
});
