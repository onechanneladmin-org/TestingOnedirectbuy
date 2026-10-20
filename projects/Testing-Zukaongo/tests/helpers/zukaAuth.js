import { expect } from "@playwright/test";
import { ACCOUNTS, PORTAL_URL, CAYMAN_GEO, STEP_TIMEOUT } from "./zukaEnv.js";
import { ensureDeliveryLocation } from "./zukaCustomer.js";

/**
 * All three ZUKAongo portals are Expo (React Native Web) apps: client-routed,
 * nav items are role=link without href, and everything renders after the JS bundle.
 */

const LOGIN_PATH = { customer: "/login", admin: "/", partner: "/" };

/**
 * The customer app pops "How was your order?" after each load while a delivered
 * order is unrated (doc §3.4, AF-05). It blocks clicks, so dismiss it whenever it shows.
 * Specs that test the popup itself call `page.removeLocatorHandler` first.
 * @param {import('@playwright/test').Page} page
 */
export async function autoDismissRatePrompt(page) {
  const later = page
    .getByRole("dialog")
    .filter({ hasText: /How was your order\?/ })
    .getByRole("button", { name: "Maybe later" });
  await page.addLocatorHandler(later, async (btn) => {
    await btn.click().catch(() => {});
  });
  return later;
}

/** Wait for the Expo bundle to paint something interactive. */
export async function waitForApp(page) {
  await page.waitForLoadState("domcontentloaded");
  await page
    .locator("input, button, [role=button], [role=link], [role=tab]")
    .first()
    .waitFor({ state: "visible", timeout: 45_000 });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {"customer"|"admin"|"partner"} portal
 */
export async function openLogin(page, portal) {
  await page.goto(`${PORTAL_URL[portal]}${LOGIN_PATH[portal]}`, {
    waitUntil: "domcontentloaded",
  });
  await page.locator('input[type="email"]').first().waitFor({ state: "visible", timeout: 45_000 });
}

/**
 * Fill the sign-in form. Does not assert success (negative tests reuse it).
 * @param {import('@playwright/test').Page} page
 * @param {string} email
 * @param {string} password
 */
export async function submitLogin(page, email, password) {
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

/** Landmarks that prove each portal's signed-in shell rendered. */
export function signedInMarker(page, portal) {
  if (portal === "customer") {
    return page.getByRole("tab", { name: /^Profile$/ });
  }
  if (portal === "admin") {
    return page.getByRole("navigation", { name: "Main navigation" });
  }
  return page.getByRole("heading", { name: "Deliveries", level: 1 });
}

/**
 * Sign in through the real login form of the account's portal.
 * @param {import('@playwright/test').Page} page
 * @param {keyof typeof ACCOUNTS} accountKey
 */
export async function signIn(page, accountKey) {
  const account = ACCOUNTS[accountKey];
  if (!account) throw new Error(`Unknown account: ${accountKey}`);
  if (!account.password) {
    throw new Error(
      `[AUTH] No password for ${account.email}. Set ZUKA_ADMIN_PASSWORD / ZUKA_TEST_PASSWORD in projects/Testing-Zukaongo/.env`,
    );
  }
  if (account.portal === "customer") await autoDismissRatePrompt(page);
  await openLogin(page, account.portal);
  await submitLogin(page, account.email, account.password);
  await expect(signedInMarker(page, account.portal)).toBeVisible({ timeout: 45_000 });
  if (account.portal === "customer") await ensureDeliveryLocation(page);
  return account;
}

/**
 * Open a separate browser context signed in as another role (multi-actor flows).
 * @param {import('@playwright/test').Browser} browser
 * @param {keyof typeof ACCOUNTS} accountKey
 * @param {{ viewport?: { width: number; height: number } }} [opts]
 */
export async function newRolePage(browser, accountKey, opts = {}) {
  const context = await browser.newContext({
    viewport: opts.viewport || { width: 1366, height: 900 },
    geolocation: CAYMAN_GEO,
    permissions: ["geolocation"],
    timezoneId: "America/Cayman",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(STEP_TIMEOUT);
  await signIn(page, accountKey);
  return { context, page };
}

/** Sign out from admin or partner (icon button with accessible name "Sign out"). */
export async function signOutStaff(page) {
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await page.getByRole("button", { name: /^Sign out$|^Confirm$|^Yes/ }).last().click({ timeout: 3_000 }).catch(() => {});
  await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: STEP_TIMEOUT });
}

/** Customer sign out lives at the bottom of Profile. */
export async function signOutCustomer(page) {
  await page.getByRole("tab", { name: /^Profile$/ }).click();
  await page.getByRole("button", { name: "Log out" }).click();
  await page.getByRole("button", { name: /^Log out$|^Confirm$|^Yes/ }).last().click({ timeout: 3_000 }).catch(() => {});
}
