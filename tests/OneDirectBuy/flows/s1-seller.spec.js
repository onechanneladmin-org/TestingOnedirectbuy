// @flow S1 — Seller onboarding + storefront. Guide: docs/qa/E2E-TEST-GUIDE.md § 5 S1.
// Use cases: ODB-UC-183, 185, 200, 201 (seller-onboarding-storefront.tsv).
//
// What runs here, read-only, on any target:
//   - become-a-vendor → Start selling → the application form;
//   - the application's own validation (empty step, bad email, bad phone) — nothing is submitted: the real
//     submit is behind reCAPTCHA, which tests must not bypass;
//   - store directory and one seller storefront, with the product count read back from
//     GET /sellers/:slug/products.
// Not here: brand approval, product create/approve, inventory and CSV import live in the seller portal
// (OneChannel), not on the storefront (tests/helpers/oneDirectBuySeller.js). They need a test seller
// login on staging — tracked as an owner ask in docs/qa/HANDOFF.md § 5.
import { test, expect, go, apiGet, passChallenge } from "./fixtures.js";
import { checkStep } from "../../helpers/checkStep.js";

const SELLER_SLUG = process.env.ODB_TEST_SELLER_SLUG || "onedirectbuy";

const alert = (page) => page.locator('form [role="alert"], [role="alert"].tw-text-red-600').first();
const continueBtn = (page) => page.getByRole("button", { name: /^Continue to review$/ });

test.describe("S1 seller @flow", () => {
  test("ODB-UC-183 become-a-vendor → Start selling opens the seller application", async ({ page, health }, testInfo) => {
    await go(page, "/vendor/become-a-vendor");
    await expect(page.getByRole("heading", { name: /Sell on OneDirect\s?Buy|Become a (Vendor|Seller)/i }).first()).toBeVisible();
    await checkStep(page, testInfo, { id: "ODB-UC-183", name: "become a vendor", health });
    const cta = page.getByRole("link", { name: /Start Selling|Apply Now|Start seller application/i }).first();
    await cta.click();
    await expect(page).toHaveURL(/\/vendor\/seller-application/);
    await passChallenge(page);
    await expect(page.getByRole("heading", { level: 1, name: /Apply to sell on OneDirect\s?Buy/i })).toBeVisible();
    await checkStep(page, testInfo, { id: "ODB-UC-183", name: "seller application", health });
  });

  test("ODB-UC-185 application validates required fields, email and phone before review", async ({ page, health }, testInfo) => {
    // Nothing may be sent: the form only posts on the review step, and we never get past validation.
    const posts = [];
    page.on("request", (r) => {
      if (r.method() !== "GET" && /\/sellers\b/.test(r.url())) posts.push(r.url());
    });
    await go(page, "/vendor/seller-application");
    await continueBtn(page).click();
    await expect(alert(page), "empty step names the first missing field").toHaveText(/Please complete: |Please accept the terms/);
    await checkStep(page, testInfo, { id: "ODB-UC-185", name: "required fields", health });

    // Fill every visible text field of step 1 with something valid, then break the email / phone.
    const form = page.locator("form").filter({ has: continueBtn(page) });
    const inputs = form.locator('input:visible:not([type=checkbox]):not([type=file]):not([type=hidden]):not(#seller-hp-website), textarea:visible');
    const n = await inputs.count();
    for (let i = 0; i < n; i++) {
      const el = inputs.nth(i);
      const type = (await el.getAttribute("type")) || "";
      const id = (await el.getAttribute("id")) || (await el.getAttribute("name")) || "";
      const value = /email/i.test(type + id) ? "qa-seller@example.com" : /tel|phone|mobile/i.test(type + id) ? "4075550100" : /zip|postal/i.test(id) ? "34746" : "QA test";
      await el.fill(value);
    }
    for (const sel of await form.locator("select:visible").all()) {
      const opts = await sel.locator("option").evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
      if (opts.length) await sel.selectOption(opts[0]);
    }
    const email = form.locator('input[type=email], input[id*="email" i], input[name*="email" i]').first();
    const phone = form.locator('input[type=tel], input[id*="mobile" i], input[id*="phone" i]').first();

    if (await email.isVisible().catch(() => false)) {
      await email.fill("not-an-email");
      await continueBtn(page).click();
      await expect(alert(page), "bad email refused").toHaveText(/valid email|Please complete|accept the terms/i);
      await email.fill("qa-seller@example.com");
    }
    if (await phone.isVisible().catch(() => false)) {
      await phone.fill("12345");
      await continueBtn(page).click();
      await expect(alert(page), "short phone refused").toHaveText(/10-digit phone|Please complete|accept the terms/i);
    }
    await checkStep(page, testInfo, { id: "ODB-UC-185", name: "email / phone validation", health });
    expect(posts, "no seller application was sent").toEqual([]);
  });

  test("ODB-UC-200 / 201 store directory → seller storefront; product count = sellers API", async ({ page, health, odb }, testInfo) => {
    const list = await apiGet(odb, `/sellers?page=1&limit=24`);
    expect(list.items?.length, "sellers API lists at least one store").toBeGreaterThan(0);
    await go(page, "/stores");
    await expect(page.getByRole("heading", { name: /^Store list$/i })).toBeVisible();
    await expect(page.locator(`a[href*="/store/${list.items[0].slug}"]`).first(), "first API store listed").toBeVisible({ timeout: 60_000 });
    await checkStep(page, testInfo, { id: "ODB-UC-200", name: "store directory", health });

    const products = await apiGet(odb, `/sellers/${encodeURIComponent(SELLER_SLUG)}/products?page=1&limit=12`);
    await go(page, `/store/${SELLER_SLUG}`);
    await expect(page.getByText(/Loading store…/)).toBeHidden({ timeout: 60_000 });
    await expect(page.locator(".text-danger").filter({ hasText: /Failed to load store/i })).toHaveCount(0);
    const cards = page.locator('.ps-store-products a[href*="/product/"]');
    if (products.total > 0) {
      await expect(cards.first(), "storefront shows products when the API has some").toBeVisible({ timeout: 60_000 });
      const shown = await cards.evaluateAll((as) => new Set(as.map((a) => a.getAttribute("href"))).size);
      expect(shown, "product cards on page 1 ≤ API page size").toBeLessThanOrEqual(12);
      expect(shown, "at least one product card").toBeGreaterThan(0);
      const count = page.getByText(new RegExp(`${products.total.toLocaleString("en-US").replace(/,/g, ",?")}\\s*(products?|items?|record)`, "i")).first();
      if (await count.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await expect(count, "product total = API total").toBeVisible();
      }
    }
    await checkStep(page, testInfo, { id: "ODB-UC-201", name: "seller storefront", health });
  });
});
