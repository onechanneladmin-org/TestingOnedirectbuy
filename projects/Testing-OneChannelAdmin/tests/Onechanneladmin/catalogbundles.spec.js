import { test, expect } from "@playwright/test";
import { loginOneChannelAdmin } from "./loginSteps.js";

function generateRandomSKU() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `BND-SKU-${timestamp}-${random}`;
}

function generateRandomMPN() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `BND-MPN-${timestamp}-${random}`;
}

test("create catalog bundle with unique SKU and MPN", async ({ page }) => {
  const sku = generateRandomSKU();
  const mpn = generateRandomMPN();

  await loginOneChannelAdmin(page);
  await page.getByRole("button", { name: "Catalog" }).click();
  await page.getByRole("link", { name: "Bundles" }).click();
  await page.getByRole("button", { name: " Add New" }).click();

  await page.getByRole("textbox", { name: "Enter SKU" }).fill(sku);
  await page.getByRole("textbox", { name: "MPN*" }).fill(mpn);

  await page.getByRole("button", { name: " Create" }).click();
  await page
    .locator("span")
    .filter({ hasText: /^Brand$/ })
    .click();
  await page.getByRole("option", { name: "1CA", exact: true }).click();
  await page.getByRole("button", { name: " Create" }).click();
  // Category (or first) multiselect — same pattern as add-product.spec.js
  await page
    .locator("div")
    .filter({ hasText: /^empty$/ })
    .nth(1)
    .click();
  await page.getByText("Amazon Us A3STI84ZSLQ1Z7").click();

  // Channels: scope to the Channels field; .first() on triggers was opening the wrong multiselect
  const channelsField = page
    .locator("label, span.p-float-label")
    .filter({ hasText: /^Channels$/ })
    .locator("xpath=ancestor::div[contains(@class,'p-field')][1]");
  await channelsField.locator(".p-multiselect-trigger").click();
  const channelsPanel = page.locator(".p-multiselect-panel").last();
  await channelsPanel
    .locator(".p-multiselect-item")
    .filter({ hasText: "Amazon Us A3STI84ZSLQ1Z7" })
    .click();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: " Save" }).click();

  await expect(page.getByText("Update Success")).toBeVisible();
});
