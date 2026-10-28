// @flow A4 — Short pick → cancel remaining → refund. Guide: docs/qa/E2E-TEST-GUIDE.md § 5 A4.
// Use case: 1CA-UC-006. Own tagged order of qty 2: pick only 1, cancel the remaining 1, refund it.
const { test, expect, expectTestOrg } = require("../../support/fixtures");
const { checkStep } = require("../../support/check-step");
const { qaTag, runIdNow } = require("../../support/guard");
const { pollUntil } = require("../../support/api");
const { cents } = require("../../support/money");
const O = require("../../support/orders");
const F = require("../../support/fulfil");
const { createTestOrder, markPaidCash, cancelIfOpen, holdFor } = require("../../support/testOrder");

test.describe("A4 short pick → cancel line → refund @flow", () => {
  let created;

  test.afterAll(async ({ browser }) => {
    if (created) await cancelIfOpen(browser, created.orderId).catch(() => {});
  });

  test("1CA-UC-006 partial pick keeps the rest open; cancelling it releases the hold and refunds its value", async ({ page, settings, health, api, writable }, testInfo) => {
    test.skip(!writable.ok, `writes disabled: ${writable.reason}`);
    const tag = qaTag(runIdNow(), "1CA-UC-006");
    await O.openOrdersList(page);
    await expectTestOrg(page, settings);
    created = await createTestOrder(page, api, settings, { tag, qty: 2 });
    const paid = await markPaidCash(page, api, created.orderId, { tag });
    const unit = cents(O.linesOf(paid)[0].price ?? O.linesOf(paid)[0].salePrice ?? Number(paid.subTotal) / 2);

    // 1. Short pick: assign 2, pick 1.
    await F.openWmsOrder(page, created.orderId, settings.warehouse);
    await F.assignTask(page, { kind: "pick", location: `${tag}-PICK`, email: settings.email, qty: 2 });
    await F.confirmTask(page, { kind: "pick", qty: 1 });
    let order = await pollUntil(() => api.readOrder(created.orderId), (o) => F.sumQty(F.wmsJobs(o, "pick"), "completedQuantity") === 1, {
      message: "partial pick saved (completed 1 of 2)",
    });
    expect(F.wmsJobs(order, "pick").every((j) => j.isComplete), "pick stays open with 1 remaining").toBe(false);
    await checkStep(page, testInfo, { id: "1CA-UC-006", name: "short pick saved", health });

    // 2. Cancel the remaining 1 on the line (Quantity To Cancel).
    await O.openOrder(page, created.orderId);
    await O.action(page, O.BUTTONS.cancel).last().click();
    const panel = O.sidebar(page, "Cancel Order");
    await expect(panel).toBeVisible();
    await F.chooseOption(page, panel, "Select Reason", /^Out of Stock or damaged$/);
    const qtyToCancel = panel.locator("div").filter({ hasText: "Quantity To Cancel" }).locator(".p-inputnumber input").last();
    test.skip(!(await qtyToCancel.isVisible().catch(() => false)), "partial cancel (Quantity To Cancel) not offered for this order (canCancelPartialOrder false)");
    await qtyToCancel.fill("1");
    await checkStep(page, testInfo, { id: "1CA-UC-006", name: "cancel remaining qty", health, scope: ".p-sidebar" });
    await panel.getByRole("button", { name: /^\s*Cancel Order\s*$/ }).click();
    const sent = await O.expectModifyOrder(page, () => O.confirmYes(page, "Cancel Confirmation"), { status: "cancelled" });
    expect(sent.body.cancelDetails.modifyCancelReduceQty ?? sent.body.modifyCancelReduceQty, "1 unit cancelled").toBe(1);

    order = await pollUntil(() => api.readOrder(created.orderId), (o) => Number(O.linesOf(o)[0].modifyCancelReduceQty) === 1, {
      message: "line shows 1 cancelled",
    });
    const hold = await holdFor(api, created.sku, created.orderId);
    if (hold != null) expect(hold, "hold for the cancelled unit released").toBeLessThanOrEqual(1);

    // 3. Refund = the cancelled line's value (shown as Cancelled Amount, refunded on cancel or via Refund).
    expect(cents(order.CancelledAmount), "Cancelled Amount = 1 unit").toBe(unit);
    await O.openOrder(page, created.orderId);
    await expect(page.getByText(/Cancelled Amount/).first()).toBeVisible();
    await checkStep(page, testInfo, { id: "1CA-UC-006", name: "after partial cancel", health });
  });
});
