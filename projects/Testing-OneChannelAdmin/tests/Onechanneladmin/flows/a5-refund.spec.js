// @flow A5 — Refund panel. Guide: docs/qa/E2E-TEST-GUIDE.md § 5 A5 and § 6.2 / § 6.4.
// Use cases: 1CA-UC-011, 1CA-UC-012, 1CA-UC-013.
// Validation cases (empty reason, over-refund) run on an existing refundable order and never save:
// they assert the client blocks the submit, and the netGuard would abort the call anyway in
// E2E_READ_ONLY=1. The write cases create their own tagged order (createTestOrder), mark it paid with
// cash, refund one line and read the refund back through the API.
const { test, expect, expectTestOrg } = require("../../support/fixtures");
const { checkStep, checkPopupKeyboard } = require("../../support/check-step");
const { cents, expectMoney } = require("../../support/money");
const { qaTag, runIdNow } = require("../../support/guard");
const O = require("../../support/orders");
const { createTestOrder, markPaidCash, cancelIfOpen } = require("../../support/testOrder");

const SUBMIT = /^\s*(Refund|Initiate Refund)\s*$/;

async function openRefundPanel(page) {
  await O.action(page, O.BUTTONS.refund).first().click();
  const panel = O.sidebar(page, "Refund Order");
  await expect(panel, "Refund Order panel opens").toBeVisible();
  return panel;
}

/** PrimeReact Dropdown inside the panel, found by its placeholder text, then the option by name. */
async function choose(page, panel, placeholder, option) {
  await panel.locator(".p-dropdown").filter({ hasText: placeholder }).first().click();
  await page.locator(".p-dropdown-panel:visible").getByRole("option", { name: option, exact: true }).click();
}

test.describe("A5 refund panel @flow", () => {
  test("1CA-UC-012 refund panel: reason is required — empty submit makes no API call", async ({ page, settings, health, api }, testInfo) => {
    await O.openOrdersList(page);
    await expectTestOrg(page, settings);
    const order = settings.orderId ? { orderId: settings.orderId } : await O.findOrder(api, (o) => o.canRefundCompleteOrder);
    test.skip(!order, "No refundable order in the test org (set E2E_ORDER_ID).");
    await O.openOrder(page, order.orderId);
    const panel = await openRefundPanel(page);
    await checkStep(page, testInfo, { id: "1CA-UC-011", name: "refund panel open", health, scope: ".p-sidebar" });

    // Required markers and the empty-submit block.
    await expect(panel.getByText(/Reason For Refund/)).toBeVisible();
    await expect(panel.getByText(/Refund Decision/)).toBeVisible();
    const calls = await O.countModifyCalls(page, async () => {
      await panel.getByRole("button", { name: SUBMIT }).click();
      await expect(
        panel.locator(".p-invalid").or(O.toasts(page).filter({ hasText: /required|cannot be 0/i })).first(),
        "empty reason is flagged"
      ).toBeVisible();
    });
    expect(calls, "no refund call with an empty reason").toBe(0);
    await expect(panel, "panel stays open with the input kept").toBeVisible();
    await checkStep(page, testInfo, { id: "1CA-UC-012", name: "refund empty reason blocked", health, scope: ".p-sidebar" });
    await checkPopupKeyboard(page, panel, { id: "1CA-UC-012", name: "refund panel" });
  });

  test("1CA-UC-012 over-refund: partial amount cannot exceed what is left to refund", async ({ page, settings, health, api }, testInfo) => {
    await O.openOrdersList(page);
    await expectTestOrg(page, settings);
    // A single-line order: the decision dropdown is enabled only for line refunds.
    const order = await O.findOrder(api, (o) => o.canRefundCompleteOrder && O.linesOf(o).length === 1 && Number(O.linesOf(o)[0].amountLeftToRefund) > 0);
    test.skip(!order, "No single-line refundable order in the test org.");
    const line = O.linesOf(order)[0];
    await O.openOrder(page, order.orderId);
    const panel = await openRefundPanel(page);
    await choose(page, panel, "Select Reason", "Buyer Cancel");
    await choose(page, panel, /Select Refund|Full Refund/, "Partial Refund");
    const amount = panel.locator(".p-inputnumber").filter({ has: page.locator("input") }).nth(1).locator("input");
    const over = (Number(line.amountLeftToRefund) + 50).toFixed(2);
    await amount.fill(over);
    await amount.blur();
    const shownValue = cents(await amount.inputValue());
    expect(shownValue, `refund amount is clamped to amountLeftToRefund (${line.amountLeftToRefund})`).toBeLessThanOrEqual(cents(line.amountLeftToRefund));
    await checkStep(page, testInfo, { id: "1CA-UC-012", name: "over-refund clamped", health, scope: ".p-sidebar" });
    await panel.locator(".p-sidebar-close").click();
    await expect(panel).toBeHidden();
  });

  test.describe("writes (own tagged order)", () => {
    test.describe.configure({ mode: "serial" });
    let created;

    test.afterAll(async ({ browser }) => {
      if (created) await cancelIfOpen(browser, created.orderId).catch(() => {});
    });

    test("1CA-UC-011 refund one line: amount ≤ paid, success, refund row = API", async ({ page, settings, health, api, writable }, testInfo) => {
      test.skip(!writable.ok, `writes disabled: ${writable.reason}`);
      const tag = qaTag(runIdNow(), "1CA-UC-011");
      await O.openOrdersList(page);
      await expectTestOrg(page, settings);
      created = await createTestOrder(page, api, settings, { tag, qty: 1 });
      await markPaidCash(page, api, created.orderId, { tag });

      await O.openOrder(page, created.orderId);
      const before = await api.readOrder(created.orderId);
      const lineBefore = O.linesOf(before)[0];
      const panel = await openRefundPanel(page);
      await choose(page, panel, "Select Reason", "Buyer Cancel");
      await panel.getByPlaceholder("Notes").fill(tag);
      const decision = panel.locator(".p-dropdown").filter({ hasText: /Select Refund|Full Refund/ }).first();
      if (await decision.isEnabled()) await choose(page, panel, /Select Refund/, "Full Refund");
      await checkStep(page, testInfo, { id: "1CA-UC-011", name: "refund filled", health, scope: ".p-sidebar" });

      // Double click on submit: exactly one refund call (button disabled while saving).
      const submit = panel.getByRole("button", { name: SUBMIT });
      const calls = await O.countModifyCalls(page, async () => {
        const res = O.expectModifyOrder(page, () => submit.dblclick(), { status: "refunded" });
        const { status, body } = await res;
        expect(status, "refund call succeeded").toBeLessThan(400);
        expect(body.refundDetails && body.refundDetails.idempotencyKey, "refund carries an idempotency key").toBeTruthy();
        await O.expectSuccessToast(page, "refund");
      });
      expect(calls, "double click creates ONE refund call").toBe(1);

      const after = await api.readOrder(created.orderId);
      const refunds = after.refundDetails || O.linesOf(after)[0].refundDetails || [];
      expect(refunds.length, "API: a refund row was recorded").toBeGreaterThan(0);
      const refunded = refunds.reduce((s, r) => s + cents(r.refundValue || 0) + cents(r.shippingValue || 0), 0);
      expect(refunded, "refund ≤ amount paid").toBeLessThanOrEqual(cents(before.ActualTotalPaidValue || before.orderTotal));
      expectMoney(refunds[refunds.length - 1].refundValue, lineBefore.amountLeftToRefund ?? before.orderTotal, "refund = line amount left to refund");
      expect(String(after.status || O.linesOf(after)[0].status), "API: order status = refunded").toMatch(/refund/i);
      // Seen 2026-10-26: status "refunded" but orderPaymentStatus stays "PAID" — reported, kept soft.
      expect.soft(String(after.orderPaymentStatus || ""), "payment status shows the refund").toMatch(/REFUND/i);
      await checkStep(page, testInfo, { id: "1CA-UC-011", name: "after refund", health });
    });

    test("1CA-UC-013 refund details popup = API; a second full refund is refused", async ({ page, settings, health, api, writable }, testInfo) => {
      test.skip(!writable.ok, `writes disabled: ${writable.reason}`);
      test.skip(!created, "needs the order refunded by 1CA-UC-011");
      await O.openOrder(page, created.orderId);
      await expectTestOrg(page, settings);
      const order = await api.readOrder(created.orderId);
      const refunds = order.refundDetails || O.linesOf(order)[0].refundDetails || [];

      await O.action(page, O.BUTTONS.refundDetails).first().click();
      const dlg = O.dialog(page, "Refund Details");
      await expect(dlg).toBeVisible();
      const total = refunds.reduce((s, r) => s + cents(r.refundValue || 0), 0);
      const amounts = ((await dlg.innerText()).match(/\d[\d,]*\.\d{2}/g) || []).map(cents);
      expect(amounts, "Total Refunded Amount on screen = API").toContain(total);
      await expect(dlg.getByText(String(created.orderId))).toBeVisible();
      await checkStep(page, testInfo, { id: "1CA-UC-013", name: "refund details popup", health, scope: ".p-dialog" });
      await checkPopupKeyboard(page, dlg, { id: "1CA-UC-013", name: "refund details" });

      // No double refund: the Refund button is gone, or the API refuses a retry.
      const again = O.action(page, O.BUTTONS.refund);
      expect(await again.count(), "fully refunded order offers no further refund").toBe(0);
      expect(order.canRefundCompleteOrder, "API: canRefundCompleteOrder is false after a full refund").toBeFalsy();
    });
  });
});
