// @flow B4 — My orders (read-only part). Guide: docs/qa/E2E-TEST-GUIDE.md § 5 B4. Use cases: ODB-UC-167, 168.
// Signs in as the fixed test buyer (ODB_BUYER_LOGIN=1) and compares the orders list and one order's
// details with GET /user/orders as that buyer. Cancel / return requests need an order this run placed
// (B2 / E1) and are added there.
import { test, expect, go, centsFromText, cents } from "./fixtures.js";
import { checkStep } from "../../helpers/checkStep.js";
import { fillLoginForm, hasBuyerCredentials, ONE_DIRECT_BUY_BUYER_CREDENTIALS as BUYER } from "../../helpers/oneDirectBuyAuth.js";

test.describe("B4 my orders @flow", () => {
  test.beforeEach(() => {
    test.skip(process.env.ODB_BUYER_LOGIN !== "1", "set ODB_BUYER_LOGIN=1 to sign in as the fixed test buyer");
    test.skip(!hasBuyerCredentials(), "ONEDIRECTBUY_BUYER_EMAIL / _PASSWORD not set");
  });

  test("ODB-UC-167 / 168 orders list and order details = buyer orders API", async ({ page, health, odb }, testInfo) => {
    // The buyer's own token, taken from the storefront's API calls (never logged).
    let token = null;
    page.on("request", (r) => {
      const auth = r.headers().authorization;
      if (!token && auth && r.url().startsWith(odb.apiURL)) token = auth;
    });
    await go(page, "/account/login");
    await fillLoginForm(page, BUYER.email, BUYER.password);
    await page.getByRole("button", { name: /^Sign in$/i }).first().click();
    await go(page, "/account/orders");
    await expect(page).toHaveURL(/\/account\/orders/);
    await expect.poll(() => token, { message: "buyer token seen on an API call" }).toBeTruthy();

    const res = await fetch(`${odb.apiURL}/user/orders?page=1&limit=10`, { headers: { authorization: token } });
    expect(res.status, "GET /user/orders").toBe(200);
    const body = await res.json();
    const orders = body.orders || body.items || body.data || [];
    test.skip(!orders.length, "the test buyer has no orders yet (place one with B2 / E1)");

    const first = orders[0];
    const number = String(first.orderNumber || first.orderId || first._id);
    await expect(page.getByText(number).first(), "newest order listed").toBeVisible();
    await checkStep(page, testInfo, { id: "ODB-UC-167", name: "orders list", health });

    await page.getByText(number).first().click();
    await expect(page.getByText(number).first()).toBeVisible();
    const total = first.total ?? first.grandTotal ?? first.totals?.total;
    if (total != null) {
      const shown = await page.getByText(new RegExp(`\\$${Number(total).toFixed(2).replace(".", "\\.")}`)).first().innerText();
      expect(centsFromText(shown), "order total = API").toBe(cents(total));
    }
    await checkStep(page, testInfo, { id: "ODB-UC-168", name: "order details", health });
  });
});
