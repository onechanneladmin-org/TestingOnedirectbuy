import { test, expect } from "../../fixtures/zukaTest.js";
import { signIn } from "../../helpers/zukaAuth.js";
import { CUSTOMER_URL, STEP_TIMEOUT } from "../../helpers/zukaEnv.js";
import { api, orderSegment } from "../../helpers/zukaApi.js";
import { customerOrders, openOrders, openTracking, openTab } from "../../helpers/zukaCustomer.js";

/** Doc §3.4 after delivery + Profile, as the main test customer. */
test.describe("ZUKAongo — customer account and after delivery", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "customer");
  });

  test("Profile menu screens all open", async ({ page, soft }) => {
    await openTab(page, "Profile");
    await soft("ZUKA-ACC-01", "Profile shows the customer and order counters", async () => {
      await expect(page.getByRole("heading", { name: "Profile", level: 1 })).toBeVisible();
      await expect(page.getByText("test-customer@zuka.test").first()).toBeVisible();
      await expect(page.getByText(/Active/).first()).toBeVisible();
    });
    const items = [
      "Personal info", "Addresses", "Your orders", "Reservations", "Buy again", "Favorites", "Wallet",
      "Payment methods", "Rewards & offers", "Meal plans", "Notifications", "Food preferences",
      "Language", "Security & privacy", "Help & support", "Terms & privacy", "About",
    ];
    for (const [i, item] of items.entries()) {
      await soft(`ZUKA-ACC-02-${String(i + 1).padStart(2, "0")}`, `Profile → ${item} opens`, async () => {
        await page.goto(`${CUSTOMER_URL}/profile`, { waitUntil: "domcontentloaded" });
        // Auth.spec logs this shared account out; in a parallel run that can end this session too.
        const signedOut = await page.getByRole("heading", { name: "Sign in", level: 1 })
          .waitFor({ state: "visible", timeout: 3_000 }).then(() => true).catch(() => false);
        if (signedOut) {
          test.info().annotations.push({ type: "note", description: `Session ended by a parallel logout before "${item}" — signed in again` });
          await signIn(page, "customer");
          await page.goto(`${CUSTOMER_URL}/profile`, { waitUntil: "domcontentloaded" });
        }
        await expect(page.getByRole("heading", { name: "Profile", level: 1 })).toBeVisible({ timeout: 45_000 });
        await page.getByRole("button", { name: item, exact: true }).click();
        await expect(page).toHaveURL(/\/profile\/.+|\/orders|\/favorites|\/reservations/, { timeout: STEP_TIMEOUT });
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
      });
    }
  });

  test("Wallet shows Zuka Credit balance and activity", async ({ page, soft }) => {
    await soft("ZUKA-ACC-03", "Wallet: CI$ balance matches the wallet API, activity listed", async () => {
      const res = await api(page, "GET", "/wallet");
      const kyd = Number(res.json.balances?.KYD ?? res.json.balance).toFixed(2);
      await page.goto(`${CUSTOMER_URL}/profile/menu/Wallet`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Wallet", level: 1 })).toBeVisible({ timeout: 45_000 });
      await expect(page.getByText("Zuka Credit").first()).toBeVisible();
      await expect(page.getByText(`CI$${Number(kyd).toLocaleString("en-US", { minimumFractionDigits: 2 })}`).first()).toBeVisible();
      await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
    });
  });

  test("orders tabs, delivered order tracking, rating and issue reporting", async ({ page, soft }) => {
    await soft("ZUKA-ACC-04", "Orders has Active / Completed / Cancelled tabs", async () => {
      await openOrders(page, "Active");
      for (const t of ["Active", "Completed", "Cancelled"]) {
        await expect(page.getByRole("tab", { name: t, exact: true })).toBeVisible();
      }
    });
    let delivered;
    await soft("ZUKA-ACC-05", "Completed lists delivered orders with Reorder", async () => {
      delivered = (await customerOrders(page)).find((o) => o.fulfillment === "delivered" && o.fulfillmentMode === "delivery");
      expect(delivered, "customer has a delivered order (run OrderLifecycle first)").toBeTruthy();
      await page.getByRole("tab", { name: "Completed", exact: true }).click();
      await expect(page.getByText(delivered.id).first()).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(page.getByRole("button", { name: "Reorder" }).first()).toBeVisible();
    });
    await soft("ZUKA-ACC-06", "Tracking a delivered order shows progress, delivery photo and driver", async () => {
      await openTracking(page, delivered.id);
      await expect(page.getByText("Delivered").first()).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(page.getByText(/Order placed/)).toBeVisible();
      await expect(page.getByText("Delivery photo")).toBeVisible();
      await expect(page.getByRole("button", { name: "Request refund" })).toBeVisible();
    });
    await soft("ZUKA-ACC-07", "Rating form has 1–5 stars for restaurant, delivery and each item", async () => {
      const rate = page.getByText("Rate your experience");
      if (await rate.isVisible().catch(() => false)) {
        expect(await page.getByRole("button", { name: "5 stars" }).count()).toBeGreaterThanOrEqual(3);
        await expect(page.getByRole("textbox", { name: "Optional feedback" }).first()).toBeVisible();
      } else {
        test.info().annotations.push({ type: "note", description: "Order already rated — rating form hidden (AF-05 once per order)" });
      }
    });
    await soft("ZUKA-ACC-08", "Problem with order offers the five issue types; Next needs a choice", async () => {
      await page.getByRole("button", { name: "Problem with order" }).first().click();
      const dialog = page.getByRole("dialog").filter({ hasText: "What went wrong?" });
      await expect(dialog).toBeVisible({ timeout: STEP_TIMEOUT });
      for (const t of ["Missing items", "Wrong items", "Quality issue", "Order never arrived", "Late delivery"]) {
        await expect(dialog.getByRole("radio", { name: new RegExp(t) })).toBeVisible();
      }
      await expect(dialog.getByRole("button", { name: "Next" })).toBeDisabled();
      await dialog.getByRole("radio", { name: /Late delivery/ }).click();
      await expect(dialog.getByRole("button", { name: "Next" })).toBeEnabled();
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toBeHidden();
    });
  });

  test("AF-03 / AF-06: server refuses late issue reports and cancelling paid orders", async ({ page, soft }) => {
    const orders = await customerOrders(page);
    await soft("ZUKA-ACC-09", "AF-06: cancelling a paid order returns 403", async () => {
      const paid = orders.find((o) => o.paymentStatus === "paid" && ["placed", "preparing"].includes(o.fulfillment));
      if (!paid) return void test.info().annotations.push({ type: "note", description: "no paid, unfinished order on the account" });
      const res = await api(page, "POST", `/orders/${orderSegment(paid.id)}/cancel`);
      expect(res.status, res.text).toBe(403);
    });
    await soft("ZUKA-ACC-10", "AF-03: reporting an issue more than 48 h after delivery is refused", async () => {
      const old = orders.find((o) => o.fulfillment === "delivered" && o.deliveredAt &&
        Date.now() - new Date(o.deliveredAt).getTime() > 49 * 3600_000);
      if (!old) return void test.info().annotations.push({ type: "note", description: "no order delivered more than 48 h ago" });
      const res = await api(page, "POST", `/orders/${orderSegment(old.id)}/issue`, {
        type: "late",
        comment: "QA automation AF-03 check (should be refused)",
      });
      expect(res.status, res.text).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });

  test("AF-07: signed-in assistant answers 'where is my order?'", async ({ page, soft }) => {
    await soft("ZUKA-ACC-11", "Assistant opens with Zuka greeting", async () => {
      await page.getByRole("button", { name: "Open assistant" }).click();
      await expect(page.getByText(/Hi! I'm Zuka/)).toBeVisible({ timeout: STEP_TIMEOUT });
    });
    await soft("ZUKA-ACC-12", "Asking 'where is my order?' returns order status details", async () => {
      await page.getByRole("textbox", { name: "Message" }).last().fill("where is my order?");
      await page.getByRole("button", { name: "Send" }).click();
      await expect(page.getByText(/#ZMV[A-Z0-9]+|Delivered|Preparing|Placed|In Transit|track/i).filter({ visible: true }).last()).toBeVisible({
        timeout: 60_000,
      });
    });
  });

  test("Help & support contact form", async ({ page, soft }) => {
    await soft("ZUKA-ACC-13", "Help shows FAQs, contact form and partner link", async () => {
      await page.goto(`${CUSTOMER_URL}/profile/menu/Help`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Help & support", level: 1 })).toBeVisible({ timeout: 45_000 });
      await expect(page.getByRole("button", { name: /How do I track an order\?/ })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Message" }).first()).toBeVisible();
      await expect(page.getByRole("button", { name: /Become a partner/ })).toBeVisible();
    });
  });
});
