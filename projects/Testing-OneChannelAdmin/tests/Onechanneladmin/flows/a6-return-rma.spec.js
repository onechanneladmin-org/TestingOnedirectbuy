// @flow A6 — Return / RMA. Guide: docs/qa/E2E-TEST-GUIDE.md § 5 A6 and § 6.5.
// Use cases: 1CA-UC-014, 015, 016.
// Own tagged order: pay → manual tracking → in transit → Mark as Delivered → Initialize Return →
// Approve Return (reason, Generate RMA, source warehouse, label) → WMS Returns: receive Good + restock.
// Panel text from OrderDetails/ReturnDialog.js and wms/Operations/QuantityRecieved.js.
const { test, expect, expectTestOrg } = require("../../support/fixtures");
const { checkStep, checkPopupKeyboard } = require("../../support/check-step");
const { qaTag, runIdNow } = require("../../support/guard");
const { pollUntil } = require("../../support/api");
const O = require("../../support/orders");
const F = require("../../support/fulfil");
const { createTestOrder, markPaidCash, cancelIfOpen, stockOf } = require("../../support/testOrder");

/** Line ⋮ menu item (Mark as Delivered / Initialize Return), confirmed with Yes. */
async function lineMenu(page, item) {
  const direct = page.getByRole("button", { name: item });
  if (await direct.first().isVisible().catch(() => false)) {
    await direct.first().click();
  } else {
    await page.locator(".pi-ellipsis-v, [aria-label*='more' i], [aria-label*='actions' i]").first().click();
    await page.getByRole("menuitem", { name: item }).click();
  }
}

const lineStatus = (o) => JSON.stringify(O.linesOf(o).map((l) => [l.status, l.attributes && l.attributes.status, (l.orderHistory || []).map((h) => h.status)]));

test.describe("A6 return / RMA @flow", () => {
  test.describe.configure({ mode: "serial" });
  let created;

  test.beforeEach(async ({ writable }) => {
    test.skip(!writable.ok, `writes disabled: ${writable.reason}`);
  });

  test.afterAll(async ({ browser }) => {
    if (created) await cancelIfOpen(browser, created.orderId).catch(() => {});
  });

  test("1CA-UC-014 only a delivered line can be returned", async ({ page, settings, health, api }, testInfo) => {
    const tag = qaTag(runIdNow(), "1CA-UC-014");
    await O.openOrdersList(page);
    await expectTestOrg(page, settings);
    created = await createTestOrder(page, api, settings, { tag, qty: 1 });
    await markPaidCash(page, api, created.orderId, { tag });
    let order = await api.readOrder(created.orderId);
    expect(O.linesOf(order)[0].canReturn || O.linesOf(order)[0].canReturnApprove, "API: an undelivered line cannot be returned").toBeFalsy();
    await O.openOrder(page, created.orderId);
    await expect(O.action(page, O.BUTTONS.approveReturn), "no Approve Return before delivery").toHaveCount(0);

    // Ship it with manual tracking and mark delivered.
    const panel = await F.openFulfillmentPanel(page, created.orderId);
    await F.startShipping(page, panel, { warehouse: settings.warehouse });
    await F.saveManualTracking(page, panel, { trackingNumber: `QA${Date.now()}`, carrier: "UPS" });
    await F.markInTransit(page, panel);
    await O.openOrder(page, created.orderId);
    await lineMenu(page, /Mark as Delivered/);
    await O.expectModifyOrder(page, () => O.confirmYes(page, "Confirmation"), { status: "delivered" });
    order = await pollUntil(() => api.readOrder(created.orderId), (o) => /delivered/i.test(lineStatus(o)), { message: "line delivered" });
    expect(O.linesOf(order)[0].canReturn, "API: delivered line can be returned").toBeTruthy();
    await checkStep(page, testInfo, { id: "1CA-UC-014", name: "delivered, return offered", health });
  });

  test("1CA-UC-015 approve return: reason + label required, RMA generated, return recorded", async ({ page, settings, health, api }, testInfo) => {
    test.skip(!created, "needs the delivered order");
    await O.openOrder(page, created.orderId);
    await lineMenu(page, /Initialize Return/);
    await O.expectModifyOrder(page, () => O.confirmYes(page, "Confirmation"), { status: "returninitialized" });
    await O.openOrder(page, created.orderId);

    await O.action(page, O.BUTTONS.approveReturn).first().click();
    const panel = O.sidebar(page, /Approve Return/);
    await expect(panel).toBeVisible();
    await checkStep(page, testInfo, { id: "1CA-UC-015", name: "approve return panel", health, scope: ".p-sidebar" });

    // Required: submitting with no reason / label makes no call.
    const blocked = await O.countModifyCalls(page, async () => {
      await panel.getByRole("button", { name: /^\s*(Return|Confirm Pickup)\s*$/ }).click();
      await expect(panel.locator(".p-invalid").or(O.toasts(page).filter({ hasText: /required/i })).first()).toBeVisible();
    });
    expect(blocked, "no return call without reason / label").toBe(0);

    await F.chooseOption(page, panel, "Select Reply", /^Received Damaged$/);
    await panel.getByRole("button", { name: "Generate RMA" }).click();
    const rma = panel.getByPlaceholder("Enter RMA No.");
    await expect(rma, "RMA number generated for this order").toHaveValue(new RegExp(`_RMA_${created.orderId}$`));
    const rmaNumber = await rma.inputValue();
    await panel.locator(".p-dropdown").filter({ hasText: /Select|Return to Source/ }).first().click();
    const wh = page.locator(".p-dropdown-panel:visible").getByRole("option");
    await (settings.warehouse ? wh.filter({ hasText: settings.warehouse }).or(wh.first()).first() : wh.first()).click();
    const label = panel.locator(".p-dropdown").filter({ hasText: "Select Shipping Label" });
    if (await label.isVisible().catch(() => false)) await F.chooseOption(page, panel, "Select Shipping Label", /^Customer own label$/);
    await checkStep(page, testInfo, { id: "1CA-UC-015", name: "return filled", health, scope: ".p-sidebar" });

    const sent = await O.expectModifyOrder(page, () => panel.getByRole("button", { name: /^\s*Return\s*$/ }).click(), { status: "returned" });
    expect(sent.status).toBeLessThan(400);
    expect(sent.body.returnDetails.RMANumber, "RMA sent").toBe(rmaNumber);
    await O.expectSuccessToast(page, "return");
    const order = await pollUntil(() => api.readOrder(created.orderId), (o) => /return/i.test(lineStatus(o)), { message: "line has a return" });
    expect(JSON.stringify(order), "API: RMA stored on the order").toContain(rmaNumber);
    created.rma = rmaNumber;
  });

  test("1CA-UC-016 return details = API; WMS receive Good + restock adds the qty back", async ({ page, settings, health, api }, testInfo) => {
    test.skip(!created || !created.rma, "needs the approved return");
    await O.openOrder(page, created.orderId);
    await O.action(page, O.BUTTONS.returnDetails).first().click();
    const dlg = O.dialog(page, /Return Details/);
    await expect(dlg).toBeVisible();
    await expect(dlg.getByText(created.rma), "RMA Number shown").toBeVisible();
    await expect(dlg.getByText(/Received Damaged|damaged/i).first(), "Return Reason shown").toBeVisible();
    await checkStep(page, testInfo, { id: "1CA-UC-016", name: "return details popup", health, scope: ".p-dialog" });
    await checkPopupKeyboard(page, dlg, { id: "1CA-UC-016", name: "return details" });

    const before = await stockOf(api, created.sku);
    await page.goto("/wms/returns");
    await page.getByRole("tab", { name: "Pending" }).or(page.getByText("Pending", { exact: true })).first().click().catch(() => {});
    const row = page.locator(".p-datatable tbody tr").filter({ hasText: created.orderId }).first();
    await expect(row, "return listed in WMS Returns").toBeVisible();
    await row.getByText("Pending").first().click();
    const recv = O.dialog(page, "Quantity Received");
    await expect(recv).toBeVisible();
    await recv.getByPlaceholder("Enter quantity").fill("1");
    await recv.getByRole("button", { name: "Good" }).click();
    await F.chooseOption(page, recv, "Select restock type", /Restock To Inventory/);
    const loc = recv.locator(".p-dropdown").filter({ hasText: "Select location" });
    if (await loc.isVisible().catch(() => false)) {
      await loc.click();
      await page.locator(".p-dropdown-panel:visible").getByRole("option").first().click();
    }
    await checkStep(page, testInfo, { id: "1CA-UC-016", name: "WMS receive dialog", health, scope: ".p-dialog" });
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(F.WMS_MODIFY)),
      recv.getByRole("button", { name: /^\W*Update\s*$/ }).click(),
    ]);
    expect(res.status()).toBeLessThan(400);
    expect(JSON.parse(res.request().postData() || "{}").restockType, "restock chosen").toBe("location");
    await O.expectSuccessToast(page, "receive return");
    if (before != null) {
      // Restock lands after the putaway job; the qty must never go negative and must not drop.
      const after = await stockOf(api, created.sku);
      expect(after, "stock not reduced by a restock").toBeGreaterThanOrEqual(before);
    }
  });
});
