import { test, expect } from "../../fixtures/zukaTest.js";
import { signIn } from "../../helpers/zukaAuth.js";
import { ADMIN_URL, ADMIN_SECTIONS, STEP_TIMEOUT } from "../../helpers/zukaEnv.js";

/** admin.zukaongo.com as superadmin: every section and its main controls. */

const nav = (page) => page.getByRole("navigation", { name: "Main navigation" });

async function openSection(page, section) {
  await nav(page).getByRole("link", { name: section.nav, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${section.path === "/" ? "/$" : section.path}`));
  await expect(page.getByRole("heading", { name: section.heading, exact: true }).first()).toBeVisible({ timeout: STEP_TIMEOUT });
}

test.describe("ZUKAongo — admin console (superadmin)", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "admin");
  });

  test("every left-nav section opens", async ({ page, soft }) => {
    for (const section of ADMIN_SECTIONS) {
      await soft(section.id, `Admin nav: ${section.nav} → ${section.heading}`, async () => {
        await openSection(page, section);
        await expect(page.getByText(/something went wrong|failed to load/i)).toHaveCount(0);
      });
    }
  });

  test("vendors: counts, search, filters and vendor detail", async ({ page, soft }) => {
    await soft("ZUKA-ADM-01", "Vendor stats and Add vendor are shown", async () => {
      await expect(page.getByText("Menu items").first()).toBeVisible();
      await expect(page.getByText("Open now").first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Add vendor" })).toBeVisible();
    });
    await soft("ZUKA-ADM-02", "Searching 'Burger' narrows the list to burger shops", async () => {
      await page.getByRole("textbox", { name: "Search vendors" }).fill("Burger House");
      await expect(page.getByRole("button", { name: "Open Burger House" })).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(page.getByRole("button", { name: "Open Fresh Mart" })).toHaveCount(0);
      await page.getByRole("textbox", { name: "Search vendors" }).fill("");
    });
    await soft("ZUKA-ADM-03", "Type filter 'Store' shows grocery stores", async () => {
      await page.getByRole("tablist", { name: "Vendor type" }).getByRole("tab", { name: "Store" }).click();
      await expect(page.getByRole("button", { name: "Open Fresh Mart" })).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(page.getByRole("button", { name: "Open Burger House" })).toHaveCount(0);
      await page.getByRole("tablist", { name: "Vendor type" }).getByRole("tab", { name: "All" }).click();
    });
    await soft("ZUKA-ADM-04", "Pagination moves to page 2 and back", async () => {
      await page.getByRole("button", { name: "Next" }).click();
      await expect(page.getByText(/Page 2 of \d+/)).toBeVisible();
      await page.getByRole("button", { name: "Previous" }).click();
      await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();
    });
    await soft("ZUKA-ADM-05", "Burger House detail shows Menu / Add-ons / Shop / Orders and menu tools", async () => {
      await page.getByRole("button", { name: "Open Burger House" }).click();
      await expect(page).toHaveURL(/\/vendors\/burger-house/);
      for (const t of ["Menu", "Add-ons", "Shop", "Orders"]) {
        await expect(page.getByRole("tablist", { name: "Vendor sections" }).getByRole("tab", { name: t })).toBeVisible();
      }
      for (const b of ["Template", "Example", "Export", "Import"]) {
        await expect(page.getByRole("button", { name: b, exact: true })).toBeVisible();
      }
      await expect(page.getByRole("button", { name: /^Fries CI\$6\.00/ })).toBeVisible();
    });
    await soft("ZUKA-ADM-06", "Vendor tabs Add-ons, Shop and Orders open", async () => {
      for (const t of ["Add-ons", "Shop", "Orders", "Menu"]) {
        await page.getByRole("tablist", { name: "Vendor sections" }).getByRole("tab", { name: t }).click();
        await page.waitForTimeout(600);
        await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
      }
    });
  });

  test("orders: fulfillment and payment filters, search, refund actions", async ({ page, soft }) => {
    await openSection(page, ADMIN_SECTIONS[1]);
    await soft("ZUKA-ADM-07", "Orders shows status and payment filter tabs from doc §2", async () => {
      const f = page.getByRole("tablist", { name: "Fulfillment status" });
      for (const t of ["All", "Scheduled", "Held", "Placed", "Preparing", "Ready", "Out for delivery", "Delivered", "Cancelled"]) {
        await expect(f.getByRole("tab", { name: t, exact: true })).toBeVisible();
      }
      const p = page.getByRole("tablist", { name: "Payment status" });
      for (const t of ["Paid", "Pending", "Requires action", "Failed", "Expired", "Refunded", "Partially refunded", "Chargeback"]) {
        await expect(p.getByRole("tab", { name: t, exact: true })).toBeVisible();
      }
    });
    await soft("ZUKA-ADM-08", "Delivered + Paid filter lists delivered orders with refund actions", async () => {
      await page.getByRole("tablist", { name: "Fulfillment status" }).getByRole("tab", { name: "Delivered", exact: true }).click();
      await page.getByRole("tablist", { name: "Payment status" }).getByRole("tab", { name: "Paid", exact: true }).click();
      await expect(page.getByText(/#ZMV[A-Z0-9]+ · /).first()).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(page.getByRole("button", { name: "Full refund" }).first()).toBeVisible();
      await expect(page.getByRole("button", { name: "To Zuka Credit" }).first()).toBeVisible();
      await expect(page.getByRole("button", { name: "View proof of delivery" }).first()).toBeVisible();
    });
    await soft("ZUKA-ADM-09", "Search by customer email filters orders", async () => {
      await page.getByRole("textbox", { name: "Search orders" }).fill("test-customer@zuka.test");
      await expect(page.getByText("test-customer@zuka.test").first()).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });

  test("settings: tabs and the order-timeout defaults from the doc", async ({ page, soft }) => {
    await openSection(page, ADMIN_SECTIONS[13]);
    await soft("ZUKA-ADM-10", "Settings sections: General, Fees & cart, Payments, Channels, Notifications, Operations", async () => {
      const tabs = page.getByRole("tablist", { name: "Settings sections" });
      for (const t of ["General", "Fees & cart", "Payments", "Channels", "Notifications", "Operations"]) {
        await tabs.getByRole("tab", { name: t }).click();
        await page.waitForTimeout(500);
        await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
      }
      await tabs.getByRole("tab", { name: "General" }).click();
    });
    await soft("ZUKA-ADM-11", "Order accept timeouts: escalate 5 min, auto-cancel 20 min (config defaults)", async () => {
      await expect(page.getByRole("textbox", { name: "Escalate after (minutes)" })).toHaveValue("5");
      await expect(page.getByRole("textbox", { name: "Auto-cancel after (minutes, 0 = off)" })).toHaveValue("20");
    });
    await soft("ZUKA-ADM-12", "Delivery and pickup are enabled; guest checkout is off", async () => {
      await expect(page.getByRole("switch", { name: "Delivery enabled" })).toBeChecked();
      await expect(page.getByRole("switch", { name: "Pickup enabled" })).toBeChecked();
      await expect(page.getByRole("switch", { name: "Allow guest checkout" })).not.toBeChecked();
    });
  });

  test("people, customers, coupons, meal pass, kitchen, drive and analytics", async ({ page, soft }) => {
    await soft("ZUKA-ADM-13", "People lists every test account with its role", async () => {
      await openSection(page, ADMIN_SECTIONS[3]);
      for (const e of ["test-driver@zuka.test", "test-driver-2@zuka.test", "test-kitchen@zuka.test", "test-grocery@zuka.test", "test-kitchen-multi@zuka.test"]) {
        await expect(page.getByText(e).first()).toBeVisible();
      }
      await expect(page.getByText("Superadmin cannot be edited here.")).toBeVisible();
    });
    await soft("ZUKA-ADM-14", "Customers search finds the test customer with wallet controls", async () => {
      await openSection(page, ADMIN_SECTIONS[4]);
      await page.getByRole("textbox", { name: "Search customers" }).fill("test-customer@zuka.test");
      await expect(page.getByText("test-customer@zuka.test").first()).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(page.getByRole("button", { name: /^Credit/ }).first()).toBeVisible();
      await expect(page.getByRole("button", { name: /^Block/ }).first()).toBeVisible();
    });
    await soft("ZUKA-ADM-15", "Coupons lists SAVE10 and FREESHIP with analytics", async () => {
      await openSection(page, ADMIN_SECTIONS[8]);
      await expect(page.getByRole("button", { name: "Delete SAVE10" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Delete FREESHIP" })).toBeVisible();
      await expect(page.getByText("Coupon analytics")).toBeVisible();
    });
    await soft("ZUKA-ADM-16", "Meal pass lists plans with Edit / Pause", async () => {
      await openSection(page, ADMIN_SECTIONS[7]);
      await expect(page.getByRole("button", { name: "Save plan" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Pause" }).first()).toBeVisible();
    });
    await soft("ZUKA-ADM-17", "Kitchen board explains the flow and has New / Preparing / Ready lanes", async () => {
      await openSection(page, ADMIN_SECTIONS[9]);
      await expect(page.getByText(/Auto-refreshes every 8s/)).toBeVisible();
      await expect(page.getByText(/Preparing\s*\d+/).first()).toBeVisible();
      await expect(page.getByText(/Ready\s*\d+/).first()).toBeVisible();
    });
    await soft("ZUKA-ADM-18", "Drive shows the live drivers map and delivery filters", async () => {
      await openSection(page, ADMIN_SECTIONS[11]);
      await expect(page.getByText("Live drivers")).toBeVisible();
      await expect(page.getByRole("tablist", { name: "Fulfillment status" }).getByRole("tab", { name: "Out for delivery" })).toBeVisible();
    });
    await soft("ZUKA-ADM-19", "Analytics date ranges switch and show orders and money", async () => {
      await openSection(page, ADMIN_SECTIONS[12]);
      for (const r of ["7 days", "30 days", "90 days", "All time"]) {
        await page.getByRole("tablist", { name: "Date range" }).getByRole("tab", { name: r }).click();
        await expect(page.getByText("Gross", { exact: true }).first()).toBeVisible({ timeout: STEP_TIMEOUT });
        await expect(page.getByText("AOV", { exact: true }).first()).toBeVisible();
      }
    });
  });
});
