/**
 * Coupon test cases — docs/qa/coupon-test-cases.md
 *
 * Every ID in the doc is registered here:
 *   - automated cases use uc("ID", ...) and are real pass/fail tests;
 *   - the rest are read from coupon-cases.tsv and reported as SKIPPED with the
 *     reason (admin UI, Stripe checkout, mobile app, rule fixtures, manual).
 *
 * These use plain @playwright/test (not the soft wrapper) so a failure is a
 * real failure in the report.
 *
 * Env (see tests/helpers/couponApi.js): ONEDIRECTBUY_API_URL,
 * ONEDIRECTBUY_TEST_COUPON, ONEDIRECTBUY_BUYER_EMAIL/PASSWORD,
 * ONEDIRECTBUY_ADMIN_API_TOKEN, ONEDIRECTBUY_TEST_COUPON_2.
 */
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  API_URL,
  api,
  applyCoupon,
  cents,
  createGuestCart,
  expectedDiscount,
  getCart,
  getTestCoupon,
  listCoupons,
  removeCoupon,
} from "../helpers/couponApi.js";
import {
  dismissCookieBanner,
  dismissAssistantOverlay,
  ONE_DIRECT_BUY_BASE_URL,
} from "../helpers/oneDirectBuyNav.js";
import {
  hasBuyerCredentials,
  loginBuyer,
  ONE_DIRECT_BUY_BUYER_CREDENTIALS,
} from "../helpers/oneDirectBuyAuth.js";

const CART_PATH = "/account/shopping-cart";
const INVALID_MSG = /Invalid or ineligible discount code/i;
const implemented = new Set();

/** Register an automated case; `ui` cases get a `page`, API cases do not. */
function register(ui, id, title, fn, opts = {}) {
  implemented.add(id);
  const run = async (args, testInfo) => {
    testInfo.annotations.push({ type: "usecase", description: id });
    if (opts.needsBuyer) {
      test.skip(!hasBuyerCredentials(), "Set ONEDIRECTBUY_BUYER_EMAIL / ONEDIRECTBUY_BUYER_PASSWORD");
    }
    if (opts.needsAdminToken) {
      test.skip(!process.env.ONEDIRECTBUY_ADMIN_API_TOKEN, "Set ONEDIRECTBUY_ADMIN_API_TOKEN");
    }
    if (opts.needsCoupon2) {
      test.skip(!process.env.ONEDIRECTBUY_TEST_COUPON_2, "Set ONEDIRECTBUY_TEST_COUPON_2 (a second valid coupon)");
    }
    await fn(args);
  };
  if (ui) test(`${id}: ${title}`, async ({ page }, ti) => run({ page }, ti));
  else test(`${id}: ${title}`, async ({}, ti) => run({}, ti));
}
const uc = (...a) => register(false, ...a);
const ucUi = (...a) => register(true, ...a);

// ---------------------------------------------------------------- UI helpers

/** Open the storefront cart page with a freshly seeded guest cart. */
async function openSeededCart(page, { qty = 1, viewport } = {}) {
  const cart = await createGuestCart(qty);
  if (viewport) await page.setViewportSize(viewport);
  else await page.setViewportSize({ width: 1920, height: 1080 });
  await page.context().addInitScript((id) => {
    localStorage.setItem("cartId", id);
    localStorage.setItem("guestCartId", id);
  }, cart._id);
  await gotoCart(page);
  return cart;
}

async function gotoCart(page) {
  await page.goto(`${ONE_DIRECT_BUY_BASE_URL}${CART_PATH}`, { waitUntil: "domcontentloaded" });
  await dismissCookieBanner(page);
  await dismissAssistantOverlay(page);
  await expect(couponInput(page)).toBeVisible({ timeout: 30_000 });
}

const couponInput = (page) => page.getByRole("textbox", { name: /^Coupon$/i });
const applyBtn = (page) => page.getByRole("button", { name: /^Apply$/i });
const removeBtn = (page, code) =>
  page.getByRole("button", { name: code ? new RegExp(`Remove ${code}`, "i") : /^Remove\b.*/i });

async function applyInUi(page, code, { enter = false } = {}) {
  await couponInput(page).fill(code);
  if (enter) await couponInput(page).press("Enter");
  else await applyBtn(page).click();
}

/** Apply the test coupon in the UI and assert it was accepted. */
async function applyValidInUi(page, coupon, opts) {
  const res = page.waitForResponse((r) => /\/coupon$/.test(r.url()) && r.request().method() === "POST");
  await applyInUi(page, coupon.code, opts);
  const status = (await res).status();
  expect(status, `POST /coupon for ${coupon.code} (expected 200, got ${status}: valid coupon was rejected)`).toBe(200);
  await expect(removeBtn(page, coupon.code)).toBeVisible({ timeout: 15_000 });
}

const subtotalOf = async (cartId) => Number((await getCart(cartId)).json?.totals?.subtotal ?? 0);

/** Apply the test coupon through the API and assert it was accepted. */
async function applyValidViaApi(cartId, coupon) {
  const res = await applyCoupon(cartId, { code: coupon.code });
  expect(
    res.status,
    `POST /user/cart/${cartId}/coupon {code:${coupon.code}} -> ${res.status} ${res.text.slice(0, 160)}`,
  ).toBe(200);
  return res.json;
}

// =============================================================================
// 4. Public coupon listing / legacy endpoints (ADM-SEC)
// =============================================================================
test.describe("Coupons — public listing and legacy endpoints", () => {
  uc("ADM-SEC-02", "unauthenticated create is rejected", async () => {
    for (const p of ["/coupons", "/admin/coupons"]) {
      const res = await api("POST", p, { body: { code: "QAX" } });
      expect([401, 403, 405], `POST ${p} -> ${res.status}`).toContain(res.status);
    }
  });

  uc("ADM-SEC-04", "legacy POST /admin/coupons and /coupons are retired (405)", async () => {
    const t = process.env.ONEDIRECTBUY_ADMIN_API_TOKEN;
    for (const p of ["/admin/coupons", "/coupons"]) {
      const res = await api("POST", p, { token: t, body: { code: "QAX" } });
      expect(res.status, `POST ${p}`).toBe(405);
      expect(res.json?.code).toBe("COUPONS_RETIRED");
    }
  }, { needsAdminToken: true });

  uc("ADM-SEC-05", "legacy PATCH/DELETE /admin/coupons/:id are retired (405)", async () => {
    const t = process.env.ONEDIRECTBUY_ADMIN_API_TOKEN;
    const id = "000000000000000000000000";
    for (const m of ["PATCH", "DELETE"]) {
      const res = await api(m, `/admin/coupons/${id}`, { token: t, body: {} });
      expect(res.status, `${m} /admin/coupons/${id}`).toBe(405);
      expect(res.json?.code).toBe("COUPONS_RETIRED");
    }
  }, { needsAdminToken: true });

  uc("ADM-SEC-06", "GET /coupons returns the active coupon list shape", async () => {
    const res = await api("GET", "/coupons");
    expect(res.status).toBe(200);
    for (const k of ["items", "page", "limit", "total"]) expect(res.json, k).toHaveProperty(k);
    expect(res.json.source).toBe("discountCampaigns");
    const now = Date.now();
    for (const c of res.json.items) {
      for (const k of ["code", "title", "discountType", "value", "minOrderAmount", "validFrom", "validUntil", "isActive", "firstOrderOnly"]) {
        expect(c, `${c.code}.${k}`).toHaveProperty(k);
      }
      expect(c.isActive).toBe(true);
      if (c.validUntil) expect(Date.parse(c.validUntil)).toBeGreaterThan(now);
    }
  });

  uc("ADM-SEC-07", "GET /coupons?active=false returns only inactive coupons", async () => {
    const res = await api("GET", "/coupons?active=false");
    expect(res.status).toBe(200);
    for (const c of res.json.items) expect(c.isActive, c.code).toBe(false);
  });

  uc("ADM-SEC-08", "GET /coupons?code= is case-insensitive", async () => {
    const coupon = await getTestCoupon();
    const lower = await listCoupons(`?code=${encodeURIComponent(coupon.code.toLowerCase())}`);
    expect(lower.items.map((c) => c.code)).toContain(coupon.code);
  });

  uc("ADM-SEC-09", "GET /coupons/not-an-id -> 400 Invalid id", async () => {
    const res = await api("GET", "/coupons/not-an-id");
    expect(res.status).toBe(400);
    expect(res.json?.error).toMatch(/Invalid (coupon )?id/i);
  });

  uc("ADM-SEC-11", "expired coupons are not listed", async () => {
    const { items } = await listCoupons();
    for (const c of items) {
      if (c.validUntil) expect(Date.parse(c.validUntil), `${c.code} validUntil`).toBeGreaterThan(Date.now());
    }
  });

  uc("CPN-ELG-05", "expired coupon is not offered (not listed by GET /coupons)", async () => {
    const { items } = await listCoupons();
    expect(items.filter((c) => c.validUntil && Date.parse(c.validUntil) <= Date.now())).toHaveLength(0);
  });
});

// =============================================================================
// 9. Cart coupon API (API-CPN)
// =============================================================================
test.describe("Coupons — cart API", () => {
  uc("API-CPN-01", "apply valid code returns populated cart", async () => {
    const coupon = await getTestCoupon();
    const cart = await createGuestCart();
    const body = await applyValidViaApi(cart._id, coupon);
    expect(body.couponCode).toBe(coupon.code);
    expect(body.discountAmount).toBeGreaterThan(0);
    expect(body.appliedDiscountCampaigns.some((c) => c.campaignMethod === "coupon" && c.code === coupon.code)).toBe(true);
  });

  uc("API-CPN-02", "code is trimmed and upper-cased", async () => {
    const coupon = await getTestCoupon();
    const cart = await createGuestCart();
    const res = await applyCoupon(cart._id, { code: `  ${coupon.code.toLowerCase()} ` });
    expect(res.status, res.text.slice(0, 160)).toBe(200);
    expect(res.json.couponCode).toBe(coupon.code);
  });

  uc("API-CPN-03", "missing/empty code -> 400 Discount code is required", async () => {
    const cart = await createGuestCart();
    for (const body of [{}, { code: "" }]) {
      const res = await applyCoupon(cart._id, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.json?.error).toBe("Discount code is required");
    }
  });

  uc("API-CPN-04", "unknown code -> 400 DISCOUNT_CODE_INVALID and cart has no coupon", async () => {
    const cart = await createGuestCart();
    const res = await applyCoupon(cart._id, { code: "NOPE" });
    expect(res.status).toBe(400);
    expect(res.json?.code).toBe("DISCOUNT_CODE_INVALID");
    expect(res.json?.error).toMatch(INVALID_MSG);
    expect((await getCart(cart._id)).json.couponCode ?? null).toBeNull();
  });

  uc("API-CPN-05", "malformed cart id -> 400 Invalid cartId", async () => {
    const res = await applyCoupon("not-an-id", { code: "X" });
    expect(res.status).toBe(400);
    expect(res.json?.error).toBe("Invalid cartId");
  });

  uc("API-CPN-06", "unknown cart id -> 404 Cart not found", async () => {
    const res = await applyCoupon("000000000000000000000000", { code: "X" });
    expect(res.status).toBe(404);
    expect(res.json?.error).toBe("Cart not found");
  });

  uc("API-CPN-10", "cart/new as a guest with no items (record actual response)", async () => {
    const res = await applyCoupon("new", { code: "NOPE" });
    test.info().annotations.push({ type: "recorded", description: `${res.status} ${res.text.slice(0, 120)}` });
    expect(res.status).toBeLessThan(500);
    expect(res.status).toBe(400);
  });

  uc("API-CPN-11", "DELETE coupon clears couponCode and discount", async () => {
    const coupon = await getTestCoupon();
    const cart = await createGuestCart();
    await applyValidViaApi(cart._id, coupon);
    const res = await removeCoupon(cart._id);
    expect(res.status).toBe(200);
    expect(res.json.couponCode ?? null).toBeNull();
    expect(res.json.discountAmount ?? 0).toBe(0);
    expect((res.json.appliedDiscountCampaigns || []).filter((c) => c.campaignMethod === "coupon")).toHaveLength(0);
  });

  uc("API-CPN-12", "DELETE with invalid / unknown cart id", async () => {
    expect((await removeCoupon("not-an-id")).status).toBe(400);
    expect((await removeCoupon("000000000000000000000000")).status).toBe(404);
  });

  uc("API-CPN-13", "DELETE with no coupon applied is idempotent", async () => {
    const cart = await createGuestCart();
    const res = await removeCoupon(cart._id);
    expect(res.status).toBe(200);
    expect(res.json.couponCode ?? null).toBeNull();
    expect(cents(res.json.totals.total)).toBe(cents(cart.totals.total));
  });

  uc("API-CPN-14", "applying the same code twice does not double the discount", async () => {
    const coupon = await getTestCoupon();
    const cart = await createGuestCart();
    const first = await applyValidViaApi(cart._id, coupon);
    const second = await applyValidViaApi(cart._id, coupon);
    expect(second.discountAmount).toBe(first.discountAmount);
  });

  uc("API-CPN-15", "NoSQL-injection style payloads are rejected, no 500", async () => {
    const cart = await createGuestCart();
    for (const code of [{ $ne: null }, ["X"], { $gt: "" }]) {
      const res = await applyCoupon(cart._id, { code });
      expect(res.status, JSON.stringify(code)).toBeLessThan(500);
      expect([400, 422]).toContain(res.status);
      expect(res.json?.couponCode ?? null).toBeNull();
    }
  });

  uc("API-CPN-16", "oversized / emoji / script codes give a clean 4xx", async () => {
    const cart = await createGuestCart();
    for (const code of ["A".repeat(10_000), "🎟️🎟️", "<script>alert(1)</script>"]) {
      const res = await applyCoupon(cart._id, { code });
      expect(res.status, code.slice(0, 20)).toBeLessThan(500);
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });

  uc("API-CPN-17", "30 random-code attempts: no 5xx (records whether rate limited)", async () => {
    const cart = await createGuestCart();
    const statuses = [];
    for (let i = 0; i < 30; i++) {
      statuses.push((await applyCoupon(cart._id, { code: `RAND${Math.random().toString(36).slice(2, 8)}` })).status);
    }
    const limited = statuses.includes(429);
    test.info().annotations.push({
      type: "recorded",
      description: limited ? "rate limited (429 seen)" : "NOT rate limited — codes can be guessed (doc section 10)",
    });
    expect(statuses.filter((s) => s >= 500)).toHaveLength(0);
  });

  uc("API-CPN-18", "GET cart after apply matches the apply response totals", async () => {
    const coupon = await getTestCoupon();
    const cart = await createGuestCart();
    const applied = await applyValidViaApi(cart._id, coupon);
    const fresh = (await getCart(cart._id)).json;
    expect(fresh.totals).toEqual(applied.totals);
    expect(fresh.couponCode).toBe(coupon.code);
  });

  uc("CPN-AMT-01", "percent coupon discount = value% of the subtotal (rounded to cents)", async () => {
    const coupon = await getTestCoupon();
    test.skip(coupon.discountType !== "percent", `test coupon is ${coupon.discountType}, not percent`);
    const cart = await createGuestCart(2);
    const applied = await applyValidViaApi(cart._id, coupon);
    expect(cents(applied.discountAmount)).toBe(cents(expectedDiscount(coupon, applied.totals.subtotal)));
    expect(cents(applied.totals.total)).toBe(
      cents(applied.totals.subtotal - applied.discountAmount + applied.totals.shipping + applied.totals.tax),
    );
  });

  uc("CPN-AMT-02", "fixed coupon discounts exactly its value", async () => {
    const coupon = await getTestCoupon();
    test.skip(coupon.discountType !== "fixed" && coupon.discountType !== "amount", `test coupon is ${coupon.discountType}, not fixed`);
    const cart = await createGuestCart(2);
    const applied = await applyValidViaApi(cart._id, coupon);
    expect(cents(applied.discountAmount)).toBe(cents(expectedDiscount(coupon, applied.totals.subtotal)));
  });

  uc("CPN-MIN-06", "discount never exceeds the subtotal; total never negative", async () => {
    const coupon = await getTestCoupon();
    const cart = await createGuestCart();
    const applied = await applyValidViaApi(cart._id, coupon);
    expect(applied.discountAmount).toBeLessThanOrEqual(applied.totals.subtotal);
    expect(applied.totals.total).toBeGreaterThanOrEqual(0);
  });

  uc("CPN-FLR-07", "cart API never exposes pricing.cost", async () => {
    const cart = await createGuestCart();
    const res = await getCart(cart._id);
    expect(JSON.stringify(res.json)).not.toMatch(/"cost"\s*:/);
  });

  uc("CPN-ELG-01", "an active coupon from the list can be applied", async () => {
    const coupon = await getTestCoupon();
    const cart = await createGuestCart();
    await applyValidViaApi(cart._id, coupon);
  });

  ucUi("CPN-APL-14", "server state wins: remove in one session, reload in another", async ({ page }) => {
    const coupon = await getTestCoupon();
    const cart = await openSeededCart(page);
    await applyValidInUi(page, coupon);
    await removeCoupon(cart._id); // "other tab"
    await page.reload();
    await expect(couponInput(page)).toBeVisible({ timeout: 30_000 });
    await expect(removeBtn(page, coupon.code)).toHaveCount(0);
  });

  uc("CPN-EDGE-01", "a failed apply must not silently drop an applied coupon (record)", async () => {
    const coupon = await getTestCoupon();
    const cart = await createGuestCart();
    await applyValidViaApi(cart._id, coupon);
    const bad = await applyCoupon(cart._id, { code: "NOPE" });
    expect(bad.status).toBe(400);
    const after = (await getCart(cart._id)).json;
    test.info().annotations.push({ type: "recorded", description: `couponCode after failed apply: ${after.couponCode}` });
    expect(after.couponCode, "coupon A disappeared after an invalid code B").toBe(coupon.code);
  });
});

// =============================================================================
// 5. Storefront cart page (CPN-APL)
// =============================================================================
test.describe("Coupons — storefront cart page (guest)", () => {
  test.describe.configure({ timeout: 120_000 });

  ucUi("CPN-APL-01", "apply valid code shows discount line and Remove <CODE>", async ({ page }) => {
    const coupon = await getTestCoupon();
    const cart = await openSeededCart(page);
    const subtotal = await subtotalOf(cart._id);
    await applyValidInUi(page, coupon);
    const discount = expectedDiscount(coupon, subtotal);
    await expect(page.getByText(new RegExp(`Discount.*${coupon.code}`, "i")).first()).toBeVisible();
    await expect(page.getByText(discount.toFixed(2)).first()).toBeVisible();
  });

  ucUi("CPN-APL-02", "Enter key applies the coupon", async ({ page }) => {
    const coupon = await getTestCoupon();
    await openSeededCart(page);
    await applyValidInUi(page, coupon, { enter: true });
  });

  ucUi("CPN-APL-03", "lower-case with spaces is accepted", async ({ page }) => {
    const coupon = await getTestCoupon();
    await openSeededCart(page);
    await applyValidInUi(page, { code: ` ${coupon.code.toLowerCase()} ` });
  });

  ucUi("CPN-APL-04", "coupon survives reload and the input is pre-filled", async ({ page }) => {
    const coupon = await getTestCoupon();
    await openSeededCart(page);
    await applyValidInUi(page, coupon);
    await page.reload();
    await expect(couponInput(page)).toBeVisible({ timeout: 30_000 });
    await expect(removeBtn(page, coupon.code)).toBeVisible();
    await expect(couponInput(page)).toHaveValue(coupon.code);
  });

  ucUi("CPN-APL-05", "Remove clears the coupon and the discount line", async ({ page }) => {
    const coupon = await getTestCoupon();
    const cart = await openSeededCart(page);
    const subtotal = await subtotalOf(cart._id);
    await applyValidInUi(page, coupon);
    await removeBtn(page, coupon.code).click();
    await expect(removeBtn(page, coupon.code)).toHaveCount(0, { timeout: 15_000 });
    await expect(couponInput(page)).toHaveValue("");
    await expect(page.getByText(`$${subtotal.toFixed(2)}`).filter({ visible: true }).first()).toBeVisible();
  });

  ucUi("CPN-APL-06", "empty input shows 'Enter a coupon code.' and sends no request", async ({ page }) => {
    await openSeededCart(page);
    let called = false;
    page.on("request", (r) => { if (/\/coupon$/.test(r.url())) called = true; });
    await applyBtn(page).click();
    await expect(page.getByText(/Enter a coupon code\./i)).toBeVisible({ timeout: 10_000 });
    expect(called).toBe(false);
  });

  ucUi("CPN-APL-07", "unknown code shows the rejection message, totals unchanged", async ({ page }) => {
    const cart = await openSeededCart(page);
    const subtotal = await subtotalOf(cart._id);
    await applyInUi(page, "NOPE123");
    await expect(page.getByText(INVALID_MSG).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(`$${subtotal.toFixed(2)}`).filter({ visible: true }).first()).toBeVisible();
    expect((await getCart(cart._id)).json.couponCode ?? null).toBeNull();
  });

  ucUi("CPN-APL-08", "discount recalculates after quantity increases", async ({ page }) => {
    const coupon = await getTestCoupon();
    const cart = await openSeededCart(page);
    await applyValidInUi(page, coupon);
    await page.getByRole("button", { name: /^Increase quantity$/i }).first().click();
    await expect
      .poll(async () => {
        const c = (await getCart(cart._id)).json;
        return cents(c.discountAmount) === cents(expectedDiscount(coupon, c.totals.subtotal));
      }, { timeout: 20_000 })
      .toBe(true);
  });

  ucUi("CPN-APL-09", "removing the last item drops the discount to 0", async ({ page }) => {
    const coupon = await getTestCoupon();
    const cart = await openSeededCart(page);
    await applyValidInUi(page, coupon);
    await page.locator("button.ps-cart-line__remove").or(page.getByRole("button", { name: /^Remove item$/i })).first().click();
    await expect(page.getByText(/Your cart is empty/i)).toBeVisible({ timeout: 20_000 });
    const c = (await getCart(cart._id)).json;
    expect(c.discountAmount ?? 0).toBe(0);
  });

  ucUi("CPN-APL-10", "second coupon replaces or is refused — never both", async ({ page }) => {
    const first = await getTestCoupon();
    const second = process.env.ONEDIRECTBUY_TEST_COUPON_2.toUpperCase();
    const cart = await openSeededCart(page);
    await applyValidInUi(page, first);
    await applyInUi(page, second);
    await page.waitForTimeout(2000);
    const c = (await getCart(cart._id)).json;
    expect(c.appliedDiscountCampaigns.filter((x) => x.campaignMethod === "coupon").length).toBeLessThanOrEqual(1);
  }, { needsCoupon2: true });

  ucUi("CPN-APL-11", "apply/remove x3 leaves no stale discount", async ({ page }) => {
    const coupon = await getTestCoupon();
    const cart = await openSeededCart(page);
    for (let i = 0; i < 3; i++) {
      await applyValidInUi(page, coupon);
      await removeBtn(page, coupon.code).click();
      await expect(removeBtn(page, coupon.code)).toHaveCount(0, { timeout: 15_000 });
    }
    expect((await getCart(cart._id)).json.discountAmount ?? 0).toBe(0);
  });

  ucUi("CPN-APL-12", "offline apply shows an error and the button recovers", async ({ page }) => {
    await openSeededCart(page);
    await page.context().setOffline(true);
    await applyInUi(page, "QAOFFLINE");
    await page.waitForTimeout(2000);
    await page.context().setOffline(false);
    await expect(applyBtn(page)).toBeEnabled({ timeout: 15_000 });
    await expect(page.getByText(/could not apply|failed|network|invalid/i).first()).toBeVisible({ timeout: 10_000 });
  });

  ucUi("CPN-APL-13", "double-click Apply sends a single discount (valid coupon)", async ({ page }) => {
    const coupon = await getTestCoupon();
    const cart = await openSeededCart(page);
    await couponInput(page).fill(coupon.code);
    await applyBtn(page).dblclick();
    await expect(removeBtn(page, coupon.code)).toBeVisible({ timeout: 15_000 });
    const c = (await getCart(cart._id)).json;
    expect(cents(c.discountAmount)).toBe(cents(expectedDiscount(coupon, c.totals.subtotal)));
  });

  ucUi("CPN-APL-15", "signed-in cart lists available coupons with an Apply button", async ({ page }) => {
    await loginBuyer(page, ONE_DIRECT_BUY_BUYER_CREDENTIALS.email, ONE_DIRECT_BUY_BUYER_CREDENTIALS.password);
    const cart = await createGuestCart();
    await page.evaluate((id) => localStorage.setItem("cartId", id), cart._id);
    await gotoCart(page);
    const coupon = await getTestCoupon();
    await expect(page.getByText(coupon.code).first()).toBeVisible({ timeout: 20_000 });
  }, { needsBuyer: true });

  ucUi("CPN-APL-16", "guest does not see the available-coupons list", async ({ page }) => {
    const coupon = await getTestCoupon();
    await openSeededCart(page);
    await expect(page.getByText(/Min\. order|First order only|All orders/i)).toHaveCount(0);
    await expect(page.getByText(new RegExp(`^${coupon.code}$`))).toHaveCount(0);
    await expect(couponInput(page)).toBeVisible();
  });

  ucUi("CPN-APL-17", "guest can apply the code on a guest cart", async ({ page }) => {
    const coupon = await getTestCoupon();
    await openSeededCart(page);
    await applyValidInUi(page, coupon);
  });

  ucUi("CPN-APL-18", "signing in with a guest cart keeps totals valid (record)", async ({ page }) => {
    await openSeededCart(page);
    await loginBuyer(page, ONE_DIRECT_BUY_BUYER_CREDENTIALS.email, ONE_DIRECT_BUY_BUYER_CREDENTIALS.password);
    await page.goto(`${ONE_DIRECT_BUY_BASE_URL}${CART_PATH}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/^Subtotal$/i).first()).toBeVisible({ timeout: 30_000 });
  }, { needsBuyer: true });

  ucUi("CPN-APL-20", "375px layout: coupon box usable, no horizontal scroll", async ({ page }) => {
    await openSeededCart(page, { viewport: { width: 375, height: 800 } });
    await expect(couponInput(page)).toBeVisible();
    await expect(applyBtn(page)).toBeVisible();
    await applyInUi(page, "NOPE123");
    await expect(page.getByText(INVALID_MSG).first()).toBeVisible({ timeout: 15_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow, "horizontal scroll at 375px").toBe(false);
  });

  ucUi("CPN-APL-21", "keyboard only: Tab to the input, type, Enter; label tied to input", async ({ page }) => {
    await openSeededCart(page);
    await expect(page.getByLabel("Coupon")).toHaveCount(1);
    await couponInput(page).focus();
    await expect(couponInput(page)).toBeFocused();
    await page.keyboard.type("NOPE123");
    await page.keyboard.press("Enter");
    await expect(page.getByText(INVALID_MSG).first()).toBeVisible({ timeout: 15_000 });
  });
});

// =============================================================================
// Everything else in the doc: registered, skipped, with the reason (TSV).
// =============================================================================
const catalog = path.join(process.cwd(), "tests", "OneDirectBuy", "coupon-cases.tsv");
const rows = fs.readFileSync(catalog, "utf8").trim().split(/\r?\n/).slice(1).map((l) => l.split("\t"));

test.describe("Coupons — not automated (see reason)", () => {
  for (const [id, , , useCase, , , , reason] of rows) {
    if (implemented.has(id)) continue;
    test(`${id}: ${useCase}`, async ({}, testInfo) => {
      testInfo.annotations.push({ type: "usecase", description: id });
      test.skip(true, reason);
    });
  }
});
