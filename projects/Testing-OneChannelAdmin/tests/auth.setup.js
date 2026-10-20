const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "https://admin.onechanneladmin.com";
const EMAIL = process.env.TEST_LOGIN_EMAIL || "admin@onechanneladmin.com";
const PASSWORD = process.env.TEST_LOGIN_PASSWORD || "";
const AUTH_FILE = path.join(__dirname, "../playwright/.auth/admin.json");

test("authenticate admin once", async ({ page }) => {
  if (!PASSWORD) throw new Error("TEST_LOGIN_PASSWORD is empty");
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.goto(`${BASE_URL}/signin?returnUrl=%2Fhome%2Fdashboard`, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await page.getByRole("textbox", { name: "Email address" }).fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForURL((url) => !/signin|\/v2\/login|\/login/i.test(url.href), {
    timeout: 45000,
  });
  await expect(page.locator("body")).toBeVisible();
  await page.context().storageState({ path: AUTH_FILE });
});
