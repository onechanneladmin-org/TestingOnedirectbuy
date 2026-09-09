import { test, expect } from "@playwright/test";
import { loginOneChannelAdmin } from "./loginSteps.js";

function generateRandomSKU() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `SKU-${timestamp}-${random}`;
}

function generateRandomMPN() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `MPN-${timestamp}-${random}`;
}

test("add product with random SKU and MPN", async ({ page }) => {
  const sku = generateRandomSKU();
  const mpn = generateRandomMPN();

  await loginOneChannelAdmin(page);
  await page.getByRole("button", { name: "Catalog" }).click();
  await page.getByRole("link", { name: "Products" }).click();
  await page.getByRole("button", { name: " Add New" }).click();
  await page.getByRole("textbox", { name: "Enter SKU" }).fill(sku);
  await page.getByRole("textbox", { name: "MPN*" }).fill(mpn);
  await page
    .locator("span")
    .filter({ hasText: /^Brand$/ })
    .click();
  await page.getByRole("option", { name: "1CA", exact: true }).click();
  await page.getByText("Product Type*Product").click();
  await page.getByRole("option", { name: "Single" }).click();
  await page.getByRole("button", { name: " Create" }).click();
  await page
    .locator("div")
    .filter({ hasText: /^empty$/ })
    .nth(1)
    .click();
  await page.getByText("Amazon Us A3STI84ZSLQ1Z7").click();
  await page.getByRole("button", { name: " Save" }).click();
  await expect(page.getByText("Update Success")).toBeVisible();
});
