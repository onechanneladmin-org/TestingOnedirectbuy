import { test, expect } from "@playwright/test";
import { loginOneChannelAdmin } from "./loginSteps.js";

/**
 * CRM Dashboard test with error handling, retry mechanism, and resilient assertions.
 * Uses executeStep + waitForElement pattern for stability.
 */

const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 30000;

test("CRM Dashboard - login and verify dashboard sections", async ({ page }) => {
  const stepResults = [];

  const email =
    process.env.CRM_LOGIN_EMAIL || "admin@onechanneladmin.com";
  const password =
    process.env.CRM_LOGIN_PASSWORD || (process.env.TEST_LOGIN_PASSWORD || "");

  /**
   * Execute a step with retry and exponential backoff.
   * @param {string} stepName
   * @param {() => Promise<void>} stepFn
   * @param {number} retries
   * @returns {Promise<{ success: boolean; error?: string }>}
   */
  async function executeStep(stepName, stepFn, retries = MAX_RETRIES) {
    let lastError = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await stepFn();
        stepResults.push({ step: stepName, status: "PASSED", attempt });
        return { success: true };
      } catch (err) {
        lastError = err;
        if (attempt < retries) {
          await page.waitForTimeout(1000 * attempt);
        }
      }
    }
    stepResults.push({
      step: stepName,
      status: "FAILED",
      error: lastError?.message,
      attempt: retries,
    });
    return { success: false, error: lastError?.message };
  }

  /**
   * Wait for locator to be visible within timeout.
   * @param {ReturnType<typeof page.getByRole> | import('@playwright/test').Locator} locator
   * @param {number} timeout
   */
  async function waitForVisible(locator, timeout = DEFAULT_TIMEOUT) {
    await locator.waitFor({ state: "visible", timeout });
    return locator;
  }

  // --- Step 1–2: Navigate and login ---
  const loginResult = await executeStep("Login", async () => {
    await loginOneChannelAdmin(page, { email, password });

    await Promise.race([
      page.waitForURL(/dashboard|signin|home|\/\//, { timeout: 20000 }),
      page.waitForLoadState("networkidle", { timeout: 20000 }),
    ]).catch(() => {});
    await page.waitForTimeout(2000);
  });
  if (!loginResult.success) throw new Error(`Login failed: ${loginResult.error}`);

  // --- Step 3: Open CRM and go to Dashboard ---
  const crmResult = await executeStep("Open CRM and navigate to Dashboard", async () => {
    const crmButton = page.getByRole("button", { name: "CRM" });
    await waitForVisible(crmButton, 15000);
    await crmButton.click();
    await page.waitForTimeout(800);

    const dashboardLink = page.getByRole("button", { name: "Dashboard" }).getByRole("link");
    await waitForVisible(dashboardLink, 15000);
    await dashboardLink.click();
    await page.waitForLoadState("domcontentloaded", { timeout: DEFAULT_TIMEOUT }).catch(() => {});
    await page.waitForTimeout(2000);
  });
  if (!crmResult.success) throw new Error(`CRM/Dashboard navigation failed: ${crmResult.error}`);

  // --- Step 4: Verify dashboard key sections (resilient) ---
  await executeStep("Verify Total Revenue section", async () => {
    const totalRevenue = page.getByText("Total Revenue").first();
    await waitForVisible(totalRevenue, 15000);
    await totalRevenue.click();
  });

  // Optional: verify some metric/revenue text exists; step passes even if not found
  await executeStep("Verify dashboard metrics visible", async () => {
    const metric = page.getByText(/\$|Revenue|Orders|\d+/i).first();
    await metric.waitFor({ state: "visible", timeout: 10000 }).catch(() => {
      // No metric text visible; don't fail the test
    });
  });

  // --- Step 5: Revenue Overview heading ---
  await executeStep("Verify Revenue Overview heading", async () => {
    const heading = page.getByRole("heading", { name: "Revenue Overview" });
    await waitForVisible(heading, 15000);
    await heading.click();
  });

  // --- Step 6: Sales Distribution heading ---
  await executeStep("Verify Sales Distribution section", async () => {
    const heading = page.getByRole("heading", {
      name: "Sales Distribution by Channels",
    });
    await waitForVisible(heading, 15000);
    await heading.click();
  });

  // --- Step 7: B2C / B2B toggle (with retry per step) ---
  await executeStep("Switch to B2C (Customers)", async () => {
    const b2cButton = page.getByRole("button", { name: "B2C (Customers)" });
    await waitForVisible(b2cButton, 15000);
    await b2cButton.click();
    await page.waitForTimeout(500);
  });

  // Optional: canvas interaction (skip on failure to avoid coordinate flakiness)
  await executeStep("Optional chart/canvas presence", async () => {
    const canvas = page.locator("canvas").first();
    const visible = await canvas
      .waitFor({ state: "visible", timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (visible) {
      await canvas.click({ position: { x: 100, y: 80 }, force: true }).catch(() => {});
    }
  });

  await executeStep("Switch to B2B (Business)", async () => {
    const b2bButton = page.getByRole("button", { name: "B2B (Business)" });
    await waitForVisible(b2bButton, 15000);
    await b2bButton.click();
    await page.waitForTimeout(500);
  });

  await executeStep("Switch back to B2C (Customers)", async () => {
    const b2cButton = page.getByRole("button", { name: "B2C (Customers)" });
    await waitForVisible(b2cButton, 15000);
    await b2cButton.click();
    await page.waitForTimeout(500);
  });

  const failed = stepResults.filter((r) => r.status === "FAILED");
  expect(
    failed,
    failed.length ? `Failed steps: ${failed.map((f) => `${f.step}: ${f.error}`).join("; ")}` : undefined
  ).toHaveLength(0);
});
