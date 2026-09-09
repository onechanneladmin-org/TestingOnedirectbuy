import { expect } from "@playwright/test";
import {
  ensureApiRewrite,
  ONE_PRODUCT_HUB_V2_BASE_URL,
} from "./oneProductHubV2Auth.js";
import { capturePageOrModal } from "./oneProductHubV2Capture.js";

export const STEP_TIMEOUT = 20_000;

/**
 * Navigate to a hash route via full page load (session restores from localStorage).
 * @param {import('@playwright/test').Page} page
 * @param {string} hash
 */
export async function navigateToHash(page, hash) {
  await ensureApiRewrite(page);
  const clean = hash.replace(/^#\/?/, "");
  await page.goto(`${ONE_PRODUCT_HUB_V2_BASE_URL}#/${clean}`);
  await page.waitForLoadState("domcontentloaded");
  await waitForAppShell(page);
  await capturePageOrModal(page, `Opened page #/${clean}`);
}

/**
 * Click a sidebar navigation item by label (partial match on accessible name).
 * @param {import('@playwright/test').Page} page
 * @param {string | RegExp} label
 */
export async function clickSidebarNav(page, label) {
  const pattern = typeof label === "string" ? new RegExp(label, "i") : label;
  const navButton = page
    .locator("nav")
    .getByRole("button", { name: pattern })
    .first();
  await expect(navButton).toBeVisible({ timeout: STEP_TIMEOUT });
  await navButton.click();
  await waitForAppShell(page);
  const labelText = typeof label === "string" ? label : String(label);
  await capturePageOrModal(page, `Sidebar — ${labelText}`);
}

/** Wait until the app finishes restoring an authenticated session. */
export async function waitForAppShell(page) {
  await page
    .getByText(/Restoring session|Checking sign-in/i)
    .waitFor({ state: "hidden", timeout: STEP_TIMEOUT })
    .catch(() => {});
}

/** Sign out from the authenticated shell and return to the public home page. */
export async function signOut(page) {
  await page.getByRole("button", { name: "Sign Out" }).click();
  await expect(
    page.getByRole("heading", { name: "Find Product Information" })
  ).toBeVisible({
    timeout: STEP_TIMEOUT,
  });
  await capturePageOrModal(page, "Public home after sign-out");
}

/**
 * Assert a page heading is visible after navigation.
 * @param {import('@playwright/test').Page} page
 * @param {string | RegExp} name
 */
export async function expectHeading(page, name) {
  await expect(page.getByRole("heading", { name }).first()).toBeVisible({
    timeout: STEP_TIMEOUT,
  });
}
