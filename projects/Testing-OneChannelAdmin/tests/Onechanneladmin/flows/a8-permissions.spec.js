// @flow A8 — Permissions. Guide: docs/qa/E2E-TEST-GUIDE.md § 5 A8 and § 6.6. Use case: 1CA-UC-028.
// Needs a low-permission user in the test org (E2E_LOWPERM_EMAIL / _PASSWORD; ask the owner).
// Read-only. Rules from the 1CA source:
//   - "Fulfillment" (ship) needs write:order or superadmin; "Refund" becomes "Request Refund" without
//     write:refund; "Cancel Order" has NO client permission check (backend flag only — reported, not failed).
//   - CRM pages show data-testid="no-access" "You don't have access"; WMS soft-redirects instead.
const fs = require("fs");
const { test, expect, expectTestOrg } = require("../../support/fixtures");
const { LOWPERM_AUTH_FILE } = require("../../support/env");
const { parseStoredList } = require("../../support/menu");
const { checkStep } = require("../../support/check-step");
const { findErrorScreen, settle } = require("../../support/page-health");
const O = require("../../support/orders");

test.use({ storageState: fs.existsSync(LOWPERM_AUTH_FILE) ? LOWPERM_AUTH_FILE : undefined });

async function permsOf(page) {
  return parseStoredList(await page.evaluate(() => localStorage.getItem("permissions")));
}

test.describe("A8 permissions (low-permission user) @flow", () => {
  test.beforeEach(async ({ settings }) => {
    test.skip(!settings.lowPermEmail || !fs.existsSync(LOWPERM_AUTH_FILE), "No low-permission user (E2E_LOWPERM_EMAIL / _PASSWORD) — ask the owner for one.");
  });

  test("1CA-UC-028 order actions are hidden or reduced without write permissions", async ({ page, settings, health, api }, testInfo) => {
    await O.openOrdersList(page);
    await expectTestOrg(page, settings);
    const perms = await permsOf(page);
    expect(perms.includes("superadmin"), "the A8 user must not be superadmin").toBe(false);
    const order = await O.findOrder(api, (o) => o.canShipCompleteOrder || o.canRefundCompleteOrder || o.canCancelCompleteOrder);
    test.skip(!order, "No order with actions in the test org.");
    await O.openOrder(page, order.orderId);
    if (!perms.includes("write:order")) {
      await expect(O.action(page, O.BUTTONS.fulfillment), "Fulfillment (ship) hidden without write:order").toHaveCount(0);
    }
    if (!perms.includes("write:refund") && order.canRefundCompleteOrder) {
      const refundBtns = page.getByRole("button", { name: /^\s*Refund\s*$/ });
      await expect(refundBtns, "direct Refund hidden without write:refund (only Request Refund)").toHaveCount(0);
    }
    if (await O.action(page, O.BUTTONS.cancel).count()) {
      testInfo.annotations.push({ type: "finding", description: "Cancel Order is shown to a user without write:order (no client permission check in CancelDialog / OrderHeader)" });
    }
    await checkStep(page, testInfo, { id: "1CA-UC-028", name: "order details as low-permission user", health });
  });

  test("1CA-UC-028 typed URL to a restricted page shows no access, not a crash or 5xx", async ({ page, settings, health }, testInfo) => {
    await page.goto("/");
    await settle(page);
    await expectTestOrg(page, settings);
    const perms = await permsOf(page);
    const crmAllowed = ["read:crm", "read:partialcrm", "superadmin"].some((p) => perms.includes(p));
    const wmsAllowed = ["read:warehouse", "read:cyclecount", "read:3pl", "superadmin"].some((p) => perms.includes(p));
    test.skip(crmAllowed && wmsAllowed, "the A8 user can open both CRM and WMS — give it a role without one of them");

    if (!crmAllowed) {
      health.reset();
      const res = await page.goto("/crm/leads");
      await settle(page);
      expect(res && res.status(), "document status").toBeLessThan(500);
      await expect(page.getByTestId("no-access").or(page.getByText("You don't have access")).first(), "CRM shows the no-access notice").toBeVisible();
      expect(findErrorScreen(await page.locator("body").innerText())).toBeNull();
      await checkStep(page, testInfo, { id: "1CA-UC-028", name: "CRM no access", health });
    }
    if (!wmsAllowed) {
      health.reset();
      const res = await page.goto("/wms/pickpack");
      await settle(page);
      expect(res && res.status(), "document status").toBeLessThan(500);
      expect(findErrorScreen(await page.locator("body").innerText())).toBeNull();
      // WMS has no notice screen: it must not render pick/pack data for this user.
      await expect(page.locator(".p-datatable tbody tr").filter({ hasText: /Pick|Pack/ }), "no pick/pack rows for a user without WMS access").toHaveCount(0);
      await checkStep(page, testInfo, { id: "1CA-UC-028", name: "WMS no access", health });
    }
  });

  test("1CA-UC-028 no data from another org in the user's API responses", async ({ page, settings, api }) => {
    await O.openOrdersList(page);
    await expectTestOrg(page, settings);
    await api.ready();
    expect(api.state.headers.clientname, "every backend call is for the test org").toBe(settings.orgId);
    const { rows, status } = await api.listOrders({ limit: 25 });
    expect(status, "orders list is not a 5xx").toBeLessThan(500);
    const foreign = rows.filter((r) => r.clientname && r.clientname !== settings.orgId);
    expect(foreign.map((r) => r.orderId), "orders of another org").toEqual([]);
  });
});
