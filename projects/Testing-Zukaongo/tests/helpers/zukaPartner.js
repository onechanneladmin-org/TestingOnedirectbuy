import { expect } from "@playwright/test";
import { ADMIN_URL, PARTNER_URL, STEP_TIMEOUT } from "./zukaEnv.js";
import { api, listFrom } from "./zukaApi.js";

/**
 * Kitchen board (admin.zukaongo.com/kitchen) and driver app (drivers.zukaongo.com)
 * actions. Tickets are found by order id; the board shows "#ABCDE #ZMV…ABCDE".
 */

/**
 * Innermost element that contains the order id and the given button.
 * @param {import('@playwright/test').Page} page
 * @param {string} orderId "#ZMV…"
 * @param {RegExp|string} buttonName
 */
export function ticket(page, orderId, buttonName) {
  const raw = orderId.replace(/^#/, "");
  return page
    .locator("div")
    .filter({ hasText: raw })
    .filter({ has: page.getByRole("button", { name: buttonName }) })
    .last();
}

export async function openKitchenBoard(page) {
  await page.goto(`${ADMIN_URL}/kitchen`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Kitchen board" })).toBeVisible({ timeout: 45_000 });
}

/** The board auto-refreshes every 8s; reload until the ticket shows. */
export async function waitForTicket(page, orderId, buttonName, timeoutMs = 90_000) {
  const until = Date.now() + timeoutMs;
  const card = ticket(page, orderId, buttonName);
  while (Date.now() < until) {
    if (await card.isVisible().catch(() => false)) return card;
    await page.waitForTimeout(4_000);
    if (!(await card.isVisible().catch(() => false))) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Kitchen board" })).toBeVisible({ timeout: 45_000 });
    }
  }
  await expect(card, `ticket ${orderId} with "${buttonName}" on the kitchen board`).toBeVisible({ timeout: 5_000 });
  return card;
}

/**
 * KI-01: Accept with a prep time. The board asks for 10/15/20/30/45 minutes.
 * @param {import('@playwright/test').Page} page
 * @param {string} orderId
 * @param {number} minutes
 */
export async function acceptOrder(page, orderId, minutes = 15) {
  const card = await waitForTicket(page, orderId, /^Accept$/);
  await card.getByRole("button", { name: /^Accept$/ }).click();
  const short = orderId.slice(-5);
  const modal = page.locator("div").filter({ hasText: `Accept #${short}` })
    .filter({ hasText: "How long until it's ready?" })
    .filter({ has: page.getByRole("button", { name: "Back", exact: true }) }).last();
  await expect(modal).toBeVisible({ timeout: STEP_TIMEOUT });
  await modal.getByText(`${minutes} min`, { exact: true }).click();
  await modal.getByRole("button", { name: new RegExp(`^Accept · ${minutes} min`) }).click();
  await expect(modal).toBeHidden({ timeout: STEP_TIMEOUT });
}

/**
 * KI-02: Decline with a reason chip: "Items out of stock" | "Kitchen too busy" |
 * "Closing soon" | "Other". "Decline & refund" stays disabled until one is picked.
 */
export async function declineOrder(page, orderId, reason = "Kitchen too busy") {
  const card = await waitForTicket(page, orderId, /^Decline$/);
  await card.getByRole("button", { name: /^Decline$/ }).click();
  const modal = page.locator("div").filter({ hasText: `Decline #${orderId.slice(-5)}` })
    .filter({ has: page.getByRole("button", { name: "Back", exact: true }) }).last();
  await expect(modal).toBeVisible({ timeout: STEP_TIMEOUT });
  const confirm = modal.getByRole("button", { name: /Decline & refund/ });
  await expect(confirm).toBeDisabled();
  await modal.getByText(reason, { exact: true }).click();
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(modal).toBeHidden({ timeout: STEP_TIMEOUT });
}

/** preparing → ready ("Bump ready" / "Ready" / "Mark ready"). */
export async function markReady(page, orderId) {
  const name = /^(Bump ready|Mark ready|Ready|Food ready)$/i;
  const card = await waitForTicket(page, orderId, name);
  await card.getByRole("button", { name }).first().click();
}

/**
 * Server view of an order as the signed-in staff user. There is no staff
 * single-order GET, so read the same paged list the Orders/Kitchen screens use.
 */
export async function staffOrder(page, orderId) {
  for (const query of [`search=${encodeURIComponent(orderId)}&`, ""]) {
    const res = await api(page, "GET", `/admin/orders?${query}page=1&pageSize=100`);
    const order = listFrom(res.json, "orders").find((o) => o.id === orderId);
    if (order) return { status: res.status, order };
  }
  return { status: 404, order: null };
}

/** Poll an order (staff API) until `predicate` holds. */
export async function waitForStaffOrder(page, orderId, predicate, timeoutMs = 60_000) {
  const until = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < until) {
    const { order } = await staffOrder(page, orderId);
    last = order;
    if (order && predicate(order)) return order;
    await page.waitForTimeout(2_500);
  }
  throw new Error(`Order ${orderId} never reached the expected state. Last: ${JSON.stringify(last)?.slice(0, 400)}`);
}

/* ---------------------------- Driver app ---------------------------- */

export async function openDeliveries(page) {
  await page.goto(`${PARTNER_URL}/`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Deliveries", level: 1 })).toBeVisible({ timeout: 45_000 });
}

/** Doc §3.3 step 1: go online (location permission is granted by the context). */
export async function goOnline(page) {
  const online = page.getByRole("button", { name: /Go online/ });
  if (await online.isVisible().catch(() => false)) {
    await online.click();
  }
  await expect(page.getByRole("button", { name: /Go offline/ })).toBeVisible({ timeout: STEP_TIMEOUT });
}

export async function goOffline(page) {
  const off = page.getByRole("button", { name: /Go offline/ });
  if (await off.isVisible().catch(() => false)) await off.click();
  await expect(page.getByRole("button", { name: /Go online/ })).toBeVisible({ timeout: STEP_TIMEOUT });
}

/** Wait for a driver-side order card showing a given action button. */
export async function waitForDriverCard(page, orderId, buttonName, timeoutMs = 90_000) {
  const card = ticket(page, orderId, buttonName);
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (await card.isVisible().catch(() => false)) return card;
    await page.waitForTimeout(3_000);
    if (!(await card.isVisible().catch(() => false))) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Deliveries", level: 1 })).toBeVisible({ timeout: 45_000 });
      await page.getByRole("button", { name: "All", exact: true }).click().catch(() => {});
    }
  }
  await expect(card, `driver card ${orderId} with "${buttonName}"`).toBeVisible({ timeout: 5_000 });
  return card;
}

/** 1×1 JPEG used as the proof-of-delivery photo. */
export const POD_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
  "base64",
);

/**
 * DR-06: Capture PoD. The app opens a file chooser (camera on phones).
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} trigger
 */
export async function uploadPod(page, trigger) {
  const chooser = page.waitForEvent("filechooser", { timeout: STEP_TIMEOUT }).catch(() => null);
  await trigger.click();
  const fc = await chooser;
  const file = { name: "pod.jpg", mimeType: "image/jpeg", buffer: POD_JPEG };
  if (fc) {
    await fc.setFiles(file);
  } else {
    await page.locator('input[type="file"]').last().setInputFiles(file);
  }
}

/** Ready-pool orders the driver can see (same call the Deliveries screen makes). */
export async function driverReadyOrders(page) {
  const res = await api(page, "GET", "/admin/orders?fulfillment=ready&page=1&pageSize=100");
  return listFrom(res.json, "orders");
}
