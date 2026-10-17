import { expect } from "@playwright/test";
import { CUSTOMER_URL, DELIVERY_POSTAL_CODE, STEP_TIMEOUT } from "./zukaEnv.js";
import { api, listFrom } from "./zukaApi.js";

/**
 * Customer web app (zukaongo.com) actions, written the way a shopper uses the app.
 */

/** Bottom/top tab bar: Home | Orders | Cart, N | Profile */
export async function openTab(page, name) {
  const tab = page.getByRole("tab", { name: new RegExp(`^${name}`) }).first();
  await tab.click();
  return tab;
}

export function locationPickerInput(page) {
  return page.getByRole("textbox", { name: "Postal code or delivery address" });
}

/** Open the "Where should we deliver?" picker from the header (desktop) or body chip (phone). */
export async function openLocationPicker(page) {
  const input = locationPickerInput(page);
  await page.getByRole("tab", { name: /^Home$/ }).first().waitFor({ timeout: 45_000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  if (!(await input.isVisible().catch(() => false))) {
    // Header location chip: the first button after the logo, whatever the saved label is.
    const named = page.getByRole("button", { name: /^(Change delivery location|Set delivery location|Current location)$/ }).first();
    if (await named.isVisible().catch(() => false)) {
      await named.click();
    } else {
      await page.getByRole("link", { name: "Home" }).first()
        .locator("xpath=following::*[@role='button'][1]").click();
    }
  }
  await expect(input).toBeVisible({ timeout: STEP_TIMEOUT });
  return input;
}

/**
 * Doc §3.1 step 1: set a Grand Cayman pin by postal code.
 * Opens the picker (header "Current location" / "Set delivery location" / saved label),
 * types the code, taps Find, confirms "Deliver here".
 * @param {import('@playwright/test').Page} page
 * @param {string} [postal]
 */
export async function setDeliveryLocation(page, postal = DELIVERY_POSTAL_CODE) {
  const input = await openLocationPicker(page);
  await expect(input).toBeVisible({ timeout: STEP_TIMEOUT });
  await input.fill(postal);
  await page.getByRole("button", { name: "Find", exact: true }).click();
  const confirm = page.getByRole("dialog").filter({ hasText: "Deliver to this address?" });
  await expect(confirm).toBeVisible({ timeout: STEP_TIMEOUT });
  await confirm.getByRole("button", { name: "Deliver here" }).click();
  await expect(confirm).toBeHidden({ timeout: STEP_TIMEOUT });
}

/**
 * A customer without a delivery pin gets a blocking "Where should we deliver?"
 * modal after sign-in. Set the Grand Cayman pin when it shows.
 */
export async function ensureDeliveryLocation(page, postal = DELIVERY_POSTAL_CODE) {
  const forced = page.getByRole("dialog").filter({ hasText: "Where should we deliver?" });
  const shown = await forced
    .waitFor({ state: "visible", timeout: 4_000 })
    .then(() => true)
    .catch(() => false);
  if (!shown) return false;
  // It also flashes while a saved pin is still loading; act only if it stays open.
  await page.waitForTimeout(2_500);
  if (!(await forced.isVisible().catch(() => false))) return false;
  await setDeliveryLocation(page, postal);
  return true;
}

/** Restaurant cards are buttons named "Burger House, open, new, …". */
export function vendorCard(page, vendorName) {
  return page.getByRole("button", { name: new RegExp(`^${escapeRe(vendorName)}, (open|closed)`) }).first();
}

export async function openVendor(page, vendorId, vendorName) {
  await page.goto(`${CUSTOMER_URL}/vendor/${vendorId}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: vendorName, level: 1 })).toBeVisible({
    timeout: 45_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
}

/** Menu rows with no options have an "Add: <name>" button. */
export async function quickAdd(page, itemName) {
  const button = page.getByRole("button", { name: `Add: ${itemName}`, exact: true }).first();
  // Right after navigation the menu paints before its handlers are live; retry the tap.
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const added = page
      .waitForResponse(
        (r) => r.url().includes("/api/cart/items") && r.request().method() === "POST",
        { timeout: 8_000 },
      )
      .catch(() => null);
    await button.click();
    const res = await added;
    if (res) {
      expect(res.status(), `add "${itemName}" to cart → ${res.status()}`).toBeLessThan(400);
      return;
    }
  }
  throw new Error(`Tapping "Add: ${itemName}" never sent POST /api/cart/items`);
}

export function cartTab(page) {
  return page.getByRole("tab", { name: /^Cart/ }).first();
}

/** Cart tab is named "Cart" or "Cart, N". */
export async function cartCount(page) {
  const name = (await cartTab(page).getAttribute("aria-label").catch(() => "")) ||
    (await cartTab(page).innerText().catch(() => ""));
  const m = String(name).match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

/**
 * Empty the server-side cart as the signed-in customer so a spec starts clean.
 * Same call as the app's clear-cart action (DELETE /cart).
 */
export async function clearCart(page) {
  await api(page, "DELETE", "/cart");
  const after = await api(page, "GET", "/cart");
  return listFrom(after.json, "lines").length;
}

/** Zuka Credit balance (KYD) from the wallet API the Wallet screen uses. */
export async function walletBalance(page) {
  const res = await api(page, "GET", "/wallet");
  return Number(res.json?.balances?.KYD ?? res.json?.balance ?? 0);
}

/** Customer's orders as the Orders screen sees them. */
export async function customerOrders(page) {
  const res = await api(page, "GET", "/orders");
  return listFrom(res.json, "orders");
}

export async function customerOrder(page, id) {
  const all = await customerOrders(page);
  return all.find((o) => o.id === id) || null;
}

/** Orders screen card (text block) for an order id. */
export function orderCardText(page, id) {
  return page.getByText(id, { exact: false }).first();
}

/** Open Orders → <tab> and return the screen. */
export async function openOrders(page, tab = "Active") {
  await page.goto(`${CUSTOMER_URL}/orders`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Orders", level: 1 })).toBeVisible({ timeout: STEP_TIMEOUT });
  await page.getByRole("tab", { name: tab, exact: true }).click();
}

/** Tracking screen for an order (same route the "Track order" button opens). */
export async function openTracking(page, id) {
  await page.goto(`${CUSTOMER_URL}/orders/track/${encodeURIComponent(encodeURIComponent(id))}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { name: "Track order", level: 1 })).toBeVisible({
    timeout: 45_000,
  });
}

export function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
