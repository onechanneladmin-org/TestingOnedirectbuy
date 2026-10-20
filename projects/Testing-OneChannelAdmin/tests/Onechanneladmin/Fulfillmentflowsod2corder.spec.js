import { test, expect } from "@playwright/test";
import { loginOneChannelAdmin } from "./loginSteps.js";

/**
 * Fulfillment Flow — SO D2C Order Test Suite
 * Covers login, navigating to Fulfillment Orders, expanding an order,
 * continuing shipping, and adding manual tracking (e.g. FedEx).
 */

// Test configuration
const BASE_URL = "https://admin.onechanneladmin.com";
const FULFILL_ORDERS_URL = `${BASE_URL}/fulfill/orders/fulfill-orders`;

const TRACKING = {
  trackingNumber: "1234",
  carrier: "Fedex",
};

// Helpers
const helpers = {
  /**
   * Log in to the admin application.
   * @param {import('@playwright/test').Page} page
   */
  async login(page) {
    await loginOneChannelAdmin(page);
    await page.waitForURL(/\/(dashboard|home|fulfill)/, { timeout: 15000 });
    await page.waitForLoadState("domcontentloaded");
  },

  /**
   * Open Fulfillment menu and go to Orders (fulfill-orders).
   * @param {import('@playwright/test').Page} page
   */
  async navigateToFulfillmentOrders(page) {
    const fulfillmentButton = page.getByRole("button", { name: "Fulfillment" });
    await expect(fulfillmentButton).toBeVisible({ timeout: 10000 });
    await fulfillmentButton.click();

    const ordersLink = page.getByRole("link", { name: "Orders", exact: true });
    await expect(ordersLink).toBeVisible({ timeout: 5000 });
    await ordersLink.click();

    await page.waitForURL(/fulfill.*orders/, { timeout: 10000 });
    await page.waitForLoadState("domcontentloaded");
  },

  /**
   * Expand the first order row in the fulfill-orders table.
   * @param {import('@playwright/test').Page} page
   */
  async expandFirstOrderRow(page) {
    const toggler = page.locator(".p-row-toggler-icon").first();
    await expect(toggler).toBeVisible({ timeout: 10000 });
    await toggler.click();
  },

  /**
   * Click Fulfillment in the expanded row, then Continue Shipping.
   * @param {import('@playwright/test').Page} page
   */
  async openFulfillmentAndContinueShipping(page) {
    const expandedContent = page.locator("#pr_id_27_content_0_expanded");
    const fulfillButton = expandedContent.getByRole("button", {
      name: /Fulfillment/,
    });
    await expect(fulfillButton).toBeVisible({ timeout: 10000 });
    await fulfillButton.click();

    const continueShippingButton = page.getByRole("button", {
      name: "Continue Shipping",
    });
    await expect(continueShippingButton).toBeVisible({ timeout: 10000 });
    await continueShippingButton.click();
  },

  /**
   * Select Shipping method, add manual tracking, choose carrier, and save.
   * @param {import('@playwright/test').Page} page
   */
  async addManualTrackingAndSave(page) {
    const methodDropdown = page.locator(
      "div:nth-child(5) > .p-dropdown > .p-dropdown-trigger"
    );
    await expect(methodDropdown).toBeVisible({ timeout: 10000 });
    await methodDropdown.click();

    await page.getByRole("option", { name: "Shipping" }).click();

    const addTrackingButton = page.getByRole("button", {
      name: "Add Manual Tracking",
    });
    await expect(addTrackingButton).toBeVisible({ timeout: 5000 });
    await addTrackingButton.click();

    const trackingInput = page.locator(".p-col-6 > .p-inputtext");
    await expect(trackingInput).toBeVisible({ timeout: 5000 });
    await trackingInput.fill(TRACKING.trackingNumber);

    const carrierDropdown = page
      .locator("div")
      .filter({ hasText: /^empty$/ });
    await expect(carrierDropdown).toBeVisible({ timeout: 5000 });
    await carrierDropdown.click();

    await page.getByRole("option", { name: TRACKING.carrier }).click();

    const saveButton = page.getByRole("button", { name: "Save Shipping" });
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await saveButton.click();
  },
};

test.describe("Fulfillment Flow — SO D2C Order", () => {
  test("should login, open fulfillment orders, and add manual tracking to first order", async ({
    page,
  }) => {
    await helpers.login(page);

    await helpers.navigateToFulfillmentOrders(page);
    await expect(page).toHaveURL(/fulfill-orders/);

    await helpers.expandFirstOrderRow(page);

    const expandedPanel = page.locator("#pr_id_27_content_0_expanded");
    await expect(expandedPanel).toBeVisible({ timeout: 5000 });

    await helpers.openFulfillmentAndContinueShipping(page);

    await helpers.addManualTrackingAndSave(page);

    // Collapse row after save (optional cleanup)
    const toggler = page.locator(".p-row-toggler-icon").first();
    await expect(toggler).toBeVisible({ timeout: 5000 }).catch(() => {});
    await toggler.click().catch(() => {});
  });
});
