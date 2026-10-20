import { test, expect } from "../../fixtures/zukaTest.js";
import { signIn } from "../../helpers/zukaAuth.js";
import { api, listFrom } from "../../helpers/zukaApi.js";
import { ACCOUNTS, ADMIN_URL, RECEPTION_NAV, SUPERADMIN_ONLY_NAV, STEP_TIMEOUT } from "../../helpers/zukaEnv.js";

/**
 * Restaurant (reception) logins are scoped to their restaurant(s) (doc §1, KI-06, KI-08, PA-10).
 */
const PAID_STATES = ["paid", "partially_refunded", "refunded", "chargeback"];

test.describe("ZUKAongo — restaurant login scope", () => {
  for (const key of ["kitchen", "grocery", "kitchenMulti"]) {
    const account = ACCOUNTS[key];
    test(`${account.label}: nav, vendors and orders are scoped`, async ({ page, soft }) => {
      await signIn(page, key);
      const nav = page.getByRole("navigation", { name: "Main navigation" });
      await soft(`ZUKA-STAFF-01-${key}`, "Reception nav shows only restaurant sections", async () => {
        for (const item of RECEPTION_NAV) await expect(nav.getByRole("link", { name: item, exact: true })).toBeVisible();
        for (const item of SUPERADMIN_ONLY_NAV) await expect(nav.getByRole("link", { name: item, exact: true })).toHaveCount(0);
      });
      await soft(`ZUKA-STAFF-02-${key}`, `Vendors list only ${account.vendors.join(" + ")}`, async () => {
        await expect(page.getByText(`Showing 1–${account.vendors.length} of ${account.vendors.length}`)).toBeVisible({ timeout: STEP_TIMEOUT });
        for (const v of account.vendors) await expect(page.getByRole("button", { name: `Open ${v}` })).toBeVisible();
      });
      await soft(`ZUKA-STAFF-03-${key}`, "KI-08: the order list only has paid tickets, from own restaurants", async () => {
        const res = await api(page, "GET", "/admin/orders?page=1&pageSize=100");
        const orders = listFrom(res.json, "orders");
        const vendors = account.vendors.map((v) => v.toLowerCase());
        for (const o of orders) {
          expect(PAID_STATES, `${o.id} paymentStatus`).toContain(o.paymentStatus);
          expect(vendors, `${o.id} vendor`).toContain(String(o.vendorName).toLowerCase());
        }
      });
      await soft(`ZUKA-STAFF-04-${key}`, "Kitchen board only shows own-restaurant tickets", async () => {
        await nav.getByRole("link", { name: "Kitchen", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Kitchen board" })).toBeVisible({ timeout: STEP_TIMEOUT });
        const others = ["Burger House", "Fresh Mart", "Mama's Pizza", "Tokyo Ramen"].filter((v) => !account.vendors.includes(v));
        for (const v of others) {
          await expect(page.getByRole("button", { name: "Accept" }).locator("xpath=ancestor::div[1]").filter({ hasText: v })).toHaveCount(0);
        }
      });
      for (const path of ["/settings", "/people", "/partners", "/customers"]) {
        await soft(`ZUKA-STAFF-05-${key}${path.replace("/", "-")}`, `PA-10: ${path} is not available to reception`, async () => {
          await page.goto(`${ADMIN_URL}${path}`, { waitUntil: "domcontentloaded" });
          await expect(nav).toBeVisible({ timeout: 45_000 });
          await page.waitForTimeout(1500);
          const heading = { "/settings": "Marketplace settings", "/people": "Add staff", "/partners": "No new applications", "/customers": "Wallet adjustment reason" }[path];
          await expect(page.getByText(heading)).toHaveCount(0);
        });
      }
    });
  }

  test("KI-06: a restaurant login cannot act on another restaurant's order", async ({ page, soft, rolePage }) => {
    let foreign;
    await soft("ZUKA-STAFF-06", "Grocery (Fresh Mart) has an order id to probe with", async () => {
      const grocery = await rolePage("grocery");
      const res = await api(grocery, "GET", "/admin/orders?page=1&pageSize=20");
      foreign = listFrom(res.json, "orders")[0];
      expect(foreign, "Fresh Mart has at least one order").toBeTruthy();
    });
    await soft("ZUKA-STAFF-07", "Burger House kitchen accepting a Fresh Mart order is refused (403)", async () => {
      await signIn(page, "kitchen");
      const res = await api(page, "POST", `/admin/orders/${encodeURIComponent(foreign.id)}/accept`, { prepMins: 15 });
      expect([403, 404], `${res.status} ${res.text}`).toContain(res.status);
    });
  });
});
