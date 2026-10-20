import { expect } from "@playwright/test";

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL || "https://admin.onechanneladmin.com";

export const SIGNIN_URL = `${BASE_URL}/signin?returnUrl=%2F`;

/** Default test account; override with TEST_LOGIN_EMAIL / TEST_LOGIN_PASSWORD. */
export const ONE_CHANNEL_ADMIN_CREDENTIALS = {
  email: process.env.TEST_LOGIN_EMAIL || "admin@onechanneladmin.com",
  password:
    process.env.TEST_LOGIN_PASSWORD || (process.env.TEST_LOGIN_PASSWORD || ""),
};

/**
 * Logs into One Channel Admin and waits until the shell is ready (Fulfillment visible).
 * @param {import('@playwright/test').Page} page
 * @param {{ email?: string; password?: string }} [credentials]
 */
export async function signInToOneChannelAdmin(page, credentials = {}) {
  const { email, password } = {
    ...ONE_CHANNEL_ADMIN_CREDENTIALS,
    ...credentials,
  };

  await page.goto(SIGNIN_URL);
  await page.waitForLoadState("domcontentloaded");

  const emailInput = page.getByRole("textbox", { name: "Email address" });
  await expect(emailInput).toBeVisible({ timeout: 10000 });
  await emailInput.click();
  await emailInput.fill(email);

  const passwordInput = page.locator('input[name="password"]');
  await expect(passwordInput).toBeVisible({ timeout: 10000 });
  await passwordInput.click();
  await passwordInput.fill(password);

  const loginButton = page.getByRole("button", { name: "Login" });
  await expect(loginButton).toBeVisible({ timeout: 10000 });
  await loginButton.click();

  await page.waitForURL(/dashboard|home/, { timeout: 15000 });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);

  const fulfillmentButton = page.getByRole("button", { name: "Fulfillment" });
  await expect(fulfillmentButton).toBeVisible({ timeout: 10000 });
}
