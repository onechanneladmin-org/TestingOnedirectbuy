/**
 * Catalog > Fitment: select vehicle (year / make / model), apply, then reset.
 *
 * Optional env: PLAYWRIGHT_BASE_URL, TEST_LOGIN_EMAIL, TEST_LOGIN_PASSWORD
 */
import { test, expect } from "@playwright/test";
import { loginOneChannelAdmin } from "./loginSteps.js";

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL || "https://admin.onechanneladmin.com";
const LOGIN_EMAIL =
  process.env.TEST_LOGIN_EMAIL || "admin@onechanneladmin.com";
const LOGIN_PASSWORD =
  process.env.TEST_LOGIN_PASSWORD || (process.env.TEST_LOGIN_PASSWORD || "");

test.describe("Catalog fitment", () => {
  test.beforeEach(async ({ page }) => {
    await loginOneChannelAdmin(page, {
      email: LOGIN_EMAIL,
      password: LOGIN_PASSWORD,
    });
    await expect(page.getByRole("button", { name: "Catalog" })).toBeVisible({
      timeout: 20000,
    });
    await page.getByRole("button", { name: "Catalog" }).click();
    await page.getByRole("link", { name: "Fitment" }).click();
    await expect(page).toHaveURL(/fitment/i, { timeout: 15000 });
  });

  test("selects year, make, model; applies; then resets", async ({ page }) => {
    await page.getByRole("button", { name: /Select fitment/i }).click();

    await page.locator("span").filter({ hasText: "Select Year" }).click();
    await page.getByRole("option", { name: "2031" }).click();

    await page.locator("span").filter({ hasText: "Select Make" }).click();
    await page.getByRole("option", { name: "BMW4" }).click();

    // Close open listboxes so the Model dropdown is reliable (avoids brittle repeated label clicks)
    await page.keyboard.press("Escape");

    await page.locator("span").filter({ hasText: "Select Model" }).click();
    await page.getByRole("option", { name: "M546" }).click();

    await page.getByRole("button", { name: /Apply/i }).click();
    await expect(page.getByRole("button", { name: /Reset/i })).toBeVisible();

    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page.getByRole("button", { name: /Select fitment/i })).toBeVisible();
  });
});
