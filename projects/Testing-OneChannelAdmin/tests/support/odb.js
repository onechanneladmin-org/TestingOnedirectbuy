// ODB storefront steps for E1 (ODB order → 1CA). A small CommonJS copy of the root suite's buyer helpers
// (tests/helpers/*.js): those are ESM and load the root @playwright/test, and Playwright refuses a second
// copy in one run, so E1 cannot import them.
//
// Safety (guide § 2.1): the ODB target must be non-production (staging / dev / local), orders need
// ODB_ALLOW_ORDERS=1, every Stripe frame must carry a pk_test_ key and the card is Stripe's 4242 test card.
// Credentials come only from the gitignored .env (ONEDIRECTBUY_BUYER_EMAIL / _PASSWORD), never printed.
const { expect } = require("@playwright/test");

const PROD_HOSTS = /(^|\.)onedirectbuy\.com$/;
const NON_PROD = /^(localhost|127\.0\.0\.1|\[::1\])$|^(staging|staging-api|dev)\.onedirectbuy\.com$/;
const TEST_CARD = "4242424242424242";

function odbSettings(env = process.env) {
  const baseURL = (env.E2E_ODB_BASE_URL || env.ONEDIRECTBUY_BASE_URL || "https://staging.onedirectbuy.com").replace(/\/+$/, "");
  const apiURL = (env.E2E_ODB_API_URL || env.ONEDIRECTBUY_API_URL || "https://staging-api.onedirectbuy.com").replace(/\/+$/, "");
  const hosts = [new URL(baseURL).hostname, new URL(apiURL).hostname];
  const nonProd = hosts.every((h) => NON_PROD.test(h) || !PROD_HOSTS.test(h));
  const email = env.ONEDIRECTBUY_BUYER_EMAIL || "";
  const password = env.ONEDIRECTBUY_BUYER_PASSWORD || "";
  let reason = "";
  if (!nonProd) reason = `ODB target ${hosts.join(" / ")} is production: E1 places orders, non-production only`;
  else if (env.ODB_ALLOW_ORDERS !== "1") reason = "set ODB_ALLOW_ORDERS=1 (Stripe test mode) to place the E1 order";
  else if (!email || !password) reason = "ONEDIRECTBUY_BUYER_EMAIL / _PASSWORD not set (test buyer)";
  return { baseURL, apiURL, email, password, ok: !reason, reason };
}

async function dismissOverlays(page) {
  for (const name of [/^Accept( all)?$/i, /^Got it$/i, /^Reject( all)?$/i]) {
    const b = page.getByRole("button", { name }).first();
    if (await b.isVisible({ timeout: 500 }).catch(() => false)) await b.click().catch(() => {});
  }
}

/** Sign in on the storefront; returns { token } from the first API call that carries one. */
async function signInBuyer(page, odb) {
  const auth = { token: null };
  page.on("request", (r) => {
    const h = r.headers().authorization;
    if (!auth.token && h && r.url().startsWith(odb.apiURL)) auth.token = h;
  });
  await page.goto(`${odb.baseURL}/account/login`);
  await dismissOverlays(page);
  await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible({ timeout: 60_000 });
  await page.locator("#username").or(page.getByPlaceholder("you@example.com")).first().fill(odb.email);
  await page.locator("#login-password").or(page.locator("input[type='password']")).first().fill(odb.password);
  await page.getByRole("button", { name: /^Sign in$/i }).first().click();
  await expect(page).not.toHaveURL(/\/account\/login$/, { timeout: 30_000 });
  await page.goto(`${odb.baseURL}/account/my-account`);
  await expect.poll(() => auth.token, { message: "buyer token seen on an API call", timeout: 30_000 }).toBeTruthy();
  return auth;
}

async function odbGet(odb, path, token) {
  const res = await fetch(`${odb.apiURL}${path}`, { headers: { accept: "application/json", ...(token ? { authorization: token } : {}) } });
  const text = await res.text();
  expect(res.status, `ODB GET ${path} → ${res.status} ${text.slice(0, 160)}`).toBe(200);
  return JSON.parse(text);
}

async function buyerOrders(odb, auth) {
  const body = await odbGet(odb, "/user/orders?page=1&limit=20", auth.token);
  return body.orders || body.items || body.data || [];
}
const orderKey = (o) => String(o.orderNumber || o.orderId || o._id);

/** Empty the cart, open the SKU's product page (found through the search API) and add `qty`. */
async function addSkuToCart(page, odb, sku, qty) {
  await page.goto(`${odb.baseURL}/account/shopping-cart`);
  await dismissOverlays(page);
  for (let i = 0; i < 10; i++) {
    const remove = page.getByRole("button", { name: /remove/i }).or(page.locator(".ps-product__remove, [aria-label*='Remove' i]")).first();
    if (!(await remove.isVisible({ timeout: 2_000 }).catch(() => false))) break;
    await remove.click();
    await page.waitForLoadState("networkidle").catch(() => {});
  }
  const found = await odbGet(odb, `/search/products?q=${encodeURIComponent(sku)}&page=1&limit=5`);
  const item = (found.items || []).find((p) => JSON.stringify(p).includes(sku)) || (found.items || [])[0];
  expect(item, `ODB search API finds ${sku}`).toBeTruthy();
  await page.goto(`${odb.baseURL}/product/${item.slug}`);
  await dismissOverlays(page);
  const qtyBox = page.getByRole("spinbutton").first();
  if (await qtyBox.isVisible({ timeout: 5_000 }).catch(() => false)) await qtyBox.fill(String(qty));
  await page.locator("a, button").filter({ hasText: /add\s*to\s*cart/i }).filter({ visible: true }).first().click();
  await page.goto(`${odb.baseURL}/account/shopping-cart`);
  await expect(page.getByRole("heading", { name: "Cart" })).toBeVisible({ timeout: 60_000 });
  return item;
}

/** Refuses unless every Stripe frame on the page uses a pk_test_ key (no key found = refused). */
async function assertStripeTestMode(page) {
  const keys = await page.locator('iframe[src*="stripe"]').evaluateAll((frames) =>
    frames.map((f) => {
      try {
        const u = new URL(f.src);
        const h = new URLSearchParams(u.hash.replace(/^#/, ""));
        return u.searchParams.get("apiKey") || u.searchParams.get("key") || h.get("apiKey") || h.get("key") || "";
      } catch {
        return "";
      }
    }).filter(Boolean)
  );
  if (!keys.length || keys.some((k) => !/^pk_test_/.test(k))) throw new Error("Refusing to pay: Stripe is not in test mode on this page.");
}

/** Checkout with the buyer's saved address and the first rate; pay with 4242. Returns the shown total (cents). */
async function checkoutAndPay(page, odb) {
  await page.goto(`${odb.baseURL}/account/checkout`);
  await dismissOverlays(page);
  await expect(page.getByRole("heading", { name: /^Checkout Information$/i })).toBeVisible({ timeout: 60_000 });
  const saved = page.locator(".ps-checkout, main").getByRole("radio", { name: /ship|address|home|default/i }).first();
  if (await saved.isVisible({ timeout: 5_000 }).catch(() => false)) await saved.check({ force: true });
  const locked = page.getByText(/Select a shipping method above to enable payment/i);
  if (await locked.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.locator(".ps-checkout, main").getByRole("radio").last().check({ force: true });
  }
  const pay = page.getByRole("button", { name: /Place order|Pay now|Complete order|Pay \$/i }).first();
  await expect(pay, "payment unlocked (needs a saved buyer address with rates)").toBeVisible({ timeout: 60_000 });
  const totalText = await page.getByText(/Total due\s*:?\s*\$\s*[\d,]+\.\d{2}/i).first().innerText();
  const shownCents = Math.round(Number(totalText.replace(/,/g, "").match(/\$\s*([\d.]+)/)[1]) * 100);

  const frame = page.frameLocator('iframe[title*="card number" i], iframe[name*="cardnumber" i], iframe[title*="Secure payment input" i]').first();
  const number = frame.locator('input[name="cardnumber"], input[name="number"], input[autocomplete="cc-number"]').first();
  await number.pressSequentially(TEST_CARD, { delay: 30 });
  const exp = page.frameLocator('iframe[title*="expir" i]').locator("input").first();
  if (await exp.isVisible({ timeout: 2_000 }).catch(() => false)) await exp.pressSequentially("1234", { delay: 30 });
  else await frame.locator('input[name="expiry"], input[autocomplete="cc-exp"]').first().pressSequentially("1234", { delay: 30 });
  const cvc = page.frameLocator('iframe[title*="CVC" i]').locator("input").first();
  if (await cvc.isVisible({ timeout: 2_000 }).catch(() => false)) await cvc.pressSequentially("123", { delay: 30 });
  else await frame.locator('input[name="cvc"], input[autocomplete="cc-csc"]').first().pressSequentially("123", { delay: 30 });

  await assertStripeTestMode(page);
  await pay.click();
  await expect(page.getByRole("heading", { name: /Payment success|Thank you|order is confirmed|Order confirmed/i }).first()).toBeVisible({ timeout: 90_000 });
  return shownCents;
}

module.exports = { odbSettings, signInBuyer, odbGet, buyerOrders, orderKey, addSkuToCart, checkoutAndPay, assertStripeTestMode };
