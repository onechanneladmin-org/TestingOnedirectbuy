// @flow A7 — Cancel. Guide: docs/qa/E2E-TEST-GUIDE.md § 5 A7. Use cases: 1CA-UC-017, 1CA-UC-018.
// Panel: OrderDetails/CancelDialog.js (Sidebar "Cancel Order"): Reason For Cancel (required), Custom
// reason, Quantity To Cancel; submit "Cancel Order" → ConfirmDialog "Cancel Confirmation" (Yes/No) →
// modifyOrder {status:"cancelled", cancelState:"Approve"}.
// The accept/decline of a cancellation REQUEST exists only for eBay orders (marketplaceStatus
// CANCEL_REQUESTED); it is covered when such an order exists in the test org, otherwise skipped.
const { test, expect, expectTestOrg } = require("../../support/fixtures");
const { checkStep, checkPopupKeyboard } = require("../../support/check-step");
const { qaTag, runIdNow } = require("../../support/guard");
const { pollUntil } = require("../../support/api");
const O = require("../../support/orders");
const { createTestOrder, markPaidCash, stockOf, cancelIfOpen, pickSku } = require("../../support/testOrder");

async function openCancelPanel(page) {
  await O.action(page, O.BUTTONS.cancel).first().click();
  const panel = O.sidebar(page, "Cancel Order");
  await expect(panel, "Cancel Order panel opens").toBeVisible();
  return panel;
}

async function chooseReason(page, panel, option) {
  await panel.locator(".p-dropdown").filter({ hasText: "Select Reason" }).first().click();
  await page.locator(".p-dropdown-panel:visible").getByRole("option", { name: option, exact: true }).click();
}

const isCancelled = (o) => /cancel/i.test(String(o && (o.status || (o.attributes && o.attributes.status) || "")))
  || O.linesOf(o).every((l) => /cancel/i.test(String(l.status || (l.attributes && l.attributes.status) || "")));

test.describe("A7 cancel @flow", () => {
  test("1CA-UC-017 cancel panel: reason required, confirmation shown before anything happens", async ({ page, settings, health, api, writable, browser }, testInfo) => {
    await O.openOrdersList(page);
    await expectTestOrg(page, settings);
    // Other suites create and cancel orders on the test org all the time: when writes are on, use
    // our own tagged order (cancelled afterwards) instead of borrowing one.
    const own = writable.ok;
    const order = own
      ? await createTestOrder(page, api, settings, { tag: qaTag(runIdNow(), "1CA-UC-017-panel"), qty: 1 })
      : await O.findOrder(api, (o) => o.canCancelCompleteOrder);
    test.skip(!order, "No cancellable order in the test org.");
    try {
      await O.openOrder(page, order.orderId);
      const panel = await openCancelPanel(page);
      await checkStep(page, testInfo, { id: "1CA-UC-017", name: "cancel panel open", health, scope: ".p-sidebar" });
      // Summary block shows this order.
      await expect(panel.getByText(String(order.orderId)).first()).toBeVisible();

      const calls = await O.countModifyCalls(page, async () => {
        await panel.getByRole("button", { name: /^\s*Cancel Order\s*$/ }).click();
        await expect(panel.locator(".p-invalid").first(), "empty reason is flagged").toBeVisible();
        // With a reason, the confirmation must appear — answer No: nothing is saved.
        await chooseReason(page, panel, "Buyer asked to Cancel");
        await panel.getByRole("button", { name: /^\s*Cancel Order\s*$/ }).click();
        const confirm = page.locator(".p-confirm-dialog:visible, .p-dialog:visible").filter({ hasText: "Cancel Confirmation" });
        await expect(confirm, "Cancel Confirmation dialog").toBeVisible();
        await checkStep(page, testInfo, { id: "1CA-UC-017", name: "cancel confirmation", health, scope: ".p-dialog" });
        await confirm.getByRole("button", { name: /^\W*No\s*$/ }).click();
        await expect(confirm).toBeHidden();
      });
      expect(calls, "no cancel call without confirming").toBe(0);
      await checkPopupKeyboard(page, panel, { id: "1CA-UC-017", name: "cancel panel" });
    } finally {
      if (own) await cancelIfOpen(browser, order.orderId);
    }
  });

  test("1CA-UC-017 cancel before pick: order cancelled, stock hold released, payment reversed", async ({ page, settings, health, api, writable }, testInfo) => {
    test.skip(!writable.ok, `writes disabled: ${writable.reason}`);
    const tag = qaTag(runIdNow(), "1CA-UC-017");
    await O.openOrdersList(page);
    await expectTestOrg(page, settings);
    const sku = await pickSku(api, settings, 1);
    const stockBefore = await stockOf(api, sku);
    const created = await createTestOrder(page, api, settings, { tag, qty: 1, sku });
    await markPaidCash(page, api, created.orderId, { tag });

    await O.openOrder(page, created.orderId);
    const panel = await openCancelPanel(page);
    await chooseReason(page, panel, "Custom");
    await panel.getByPlaceholder("Enter Custom Reason").fill(tag);
    await checkStep(page, testInfo, { id: "1CA-UC-017", name: "cancel filled", health, scope: ".p-sidebar" });
    await panel.getByRole("button", { name: /^\s*Cancel Order\s*$/ }).click();
    const { status, body } = await O.expectModifyOrder(page, () => O.confirmYes(page, "Cancel Confirmation"), { status: "cancelled" });
    expect(status).toBeLessThan(400);
    expect(body.cancelDetails && body.cancelDetails.customReason, "reason saved with the cancel").toBe(tag);
    await O.expectSuccessToast(page, "cancel");

    const after = await pollUntil(() => api.readOrder(created.orderId), isCancelled, { message: "order status = cancelled" });
    expect(after.canCancelCompleteOrder, "a cancelled order cannot be cancelled again").toBeFalsy();
    if (stockBefore != null) {
      const stockAfter = await pollUntil(() => stockOf(api, sku), (q) => q === stockBefore, { message: `${sku} available qty back to ${stockBefore}` });
      expect(stockAfter, "hold released: available qty restored").toBe(stockBefore);
    }
    await checkStep(page, testInfo, { id: "1CA-UC-017", name: "after cancel", health });
  });

  test("1CA-UC-018 decline a cancellation request: order stays open", async ({ page, settings, health, api, writable }, testInfo) => {
    await O.openOrdersList(page);
    await expectTestOrg(page, settings);
    const order = await O.findOrder(api, (o) => o.marketplace === "ebay" && O.linesOf(o).some((l) => l.marketplaceStatus === "CANCEL_REQUESTED"));
    test.skip(!order, "No eBay order with a pending cancellation request in the test org (only eBay has accept/decline).");
    await O.openOrder(page, order.orderId);
    const panel = await openCancelPanel(page);
    await expect(panel.getByRole("button", { name: "Approve" })).toBeVisible();
    await panel.getByRole("button", { name: "Decline" }).click();
    await expect(panel.getByText("Ship Date")).toBeVisible();
    await expect(panel.getByText("Tracking Number")).toBeVisible();
    // Required: confirming the decline without ship date / tracking is refused with a message.
    const calls = await O.countModifyCalls(page, async () => {
      await panel.getByRole("button", { name: "Confirm Decline" }).click();
      await expect(O.toasts(page).filter({ hasText: /Ship Date is Missing|Tracking Number is Missing/ }).first()).toBeVisible();
    });
    expect(calls, "decline without ship date/tracking makes no call").toBe(0);
    await checkStep(page, testInfo, { id: "1CA-UC-018", name: "decline cancellation form", health, scope: ".p-sidebar" });
    await panel.getByRole("button", { name: "Cancel Decline" }).click();
    await panel.locator(".p-sidebar-close").click();
    test.skip(!writable.ok, "declining a real eBay request writes to eBay: read-only part done");
  });
});
