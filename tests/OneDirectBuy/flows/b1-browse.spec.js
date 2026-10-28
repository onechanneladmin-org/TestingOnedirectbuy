// @flow B1 — Browse → search → product → cart. Guide: docs/qa/E2E-TEST-GUIDE.md § 5 B1.
// Use cases: ODB-UC-026, 027, 028, 030, 031, 037, 038, 040, 056, 058, 113, 114, 115, 116, 117, 121.
// Replaces the SOFT specs Homepage, Navigation, Search, ProductDetail (part), Cart (part), LegalPages.
//
// Every screen gets checkStep (screenshot, axe, layout, console, 5xx); every count, title and price is
// read back from the storefront API. Cart tests write a guest cart, so they run only on a dev/local
// target (odb.writable); on production (ALLOW_PROD=1) they skip.
import { test, expect, go, productHrefs, apiGet, centsFromText, cents } from "./fixtures.js";
import { checkStep } from "../../helpers/checkStep.js";

const KEYWORD = process.env.ODB_SEARCH_KEYWORD || "wheel";
const NO_RESULTS = "zzqqxxnotapart";

const searchBox = (page) => page.locator('input[name="header-search-input"]').or(page.getByRole("combobox", { name: /Search products/i })).first();
const resultCount = (page) => page.getByText(/\d+ record\(s\) found/i).first();
const cartBadge = (page) => page.getByRole("link", { name: /\d+\s*Cart/i }).first();
const pdpAddToCart = (page) => page.getByRole("link", { name: "Add to cart", exact: true }).or(page.getByRole("button", { name: "Add to cart", exact: true })).first();
const cartQty = (page) => page.getByRole("spinbutton", { name: /Quantity/i }).or(page.locator('input[type="number"][name="Quantity"]')).first();

async function cartId(page) {
  return page.evaluate(() => localStorage.getItem("cartId") || localStorage.getItem("guestCartId"));
}

/** Open a product that the API says is in stock with a price, via the search page (as a shopper would). */
async function openInStockProduct(page, odb) {
  const api = await apiGet(odb, `/search/products?q=${encodeURIComponent(KEYWORD)}&page=1&limit=12`);
  const item = api.items.find((p) => p.aggregate && p.aggregate.totalQty > 0 && p.topOffer && p.topOffer.price > 0);
  expect(item, `an in-stock "${KEYWORD}" product with a price exists on the API`).toBeTruthy();
  await go(page, `/product/${item.slug}`);
  await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText(item.title, { ignoreCase: true });
  return item;
}

test.describe("B1 browse @flow", () => {
  test("ODB-UC-026 homepage: header search, nav, hero heading and footer", async ({ page, health }, testInfo) => {
    await go(page, "/");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(searchBox(page), "header search box").toBeVisible();
    await expect(page.getByRole("link", { name: /All products/i }).first()).toBeVisible();
    await expect(page.locator("footer").getByRole("link", { name: "Privacy Policy" })).toBeVisible();
    await checkStep(page, testInfo, { id: "ODB-UC-026", name: "homepage", health });
  });

  test("ODB-UC-027 header links open their page", async ({ page, health }, testInfo) => {
    for (const [name, url] of [[/All products/i, /\/shop/], [/Track your order/i, /track/i], [/Sell on OneDirectBuy/i, /sell|seller/i]]) {
      await go(page, "/");
      await page.getByRole("link", { name }).first().click();
      await expect(page, `${name} opens its page`).toHaveURL(url);
      await expect(page.getByRole("heading").first()).toBeVisible();
    }
    await checkStep(page, testInfo, { id: "ODB-UC-027", name: "header link target", health });
  });

  test("ODB-UC-028 footer help and legal pages have a heading and a working breadcrumb", async ({ page, health }, testInfo) => {
    await go(page, "/");
    const links = await page.locator("footer a[href^='/info/']").evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
    expect(links.length, "footer lists the help and legal pages").toBeGreaterThan(5);
    const broken = [];
    for (const href of links) {
      await go(page, href);
      const h = await page.getByRole("heading", { level: 1 }).first().innerText().catch(() => "");
      if (!h.trim()) broken.push(`${href}: no h1`);
      if (/not found|404/i.test(h)) broken.push(`${href}: ${h}`);
    }
    expect(broken, "every footer page renders a heading").toEqual([]);
    // Testers reported broken breadcrumbs on the legal pages: Home must go home.
    await go(page, "/info/privacy-policy");
    await page.getByRole("link", { name: /^Home$/ }).first().click();
    await expect(page).toHaveURL(/\/$/);
    await checkStep(page, testInfo, { id: "ODB-UC-028", name: "footer pages", health });
  });

  test("ODB-UC-030 keyword search: count and first results = search API", async ({ page, health, odb }, testInfo) => {
    const api = await apiGet(odb, `/search/products?q=${encodeURIComponent(KEYWORD)}&page=1&limit=12`);
    expect(api.total, `API has results for "${KEYWORD}"`).toBeGreaterThan(0);
    await go(page, "/");
    await searchBox(page).fill(KEYWORD);
    await searchBox(page).press("Enter");
    await expect(page).toHaveURL(new RegExp(`/search\\?.*${KEYWORD}`));
    await expect(page.getByRole("heading", { name: new RegExp(`Search result for: "${KEYWORD}"`, "i") })).toBeVisible();
    await expect(resultCount(page), "result count = API total").toHaveText(new RegExp(`^${api.total} record`));
    const hrefs = await productHrefs(page);
    expect(hrefs.slice(0, 3), "first results = API order").toEqual(api.items.slice(0, 3).map((p) => `/product/${p.slug}`));
    await checkStep(page, testInfo, { id: "ODB-UC-030", name: "search results", health });
  });

  test("ODB-UC-031 a search with no match shows an empty state, not an error", async ({ page, health }, testInfo) => {
    await go(page, `/search?keyword=${NO_RESULTS}`);
    await expect(page.getByRole("heading", { name: /Search result for/i })).toBeVisible();
    await expect(page.getByText(/Unable to load search results/i), "no load error").toHaveCount(0);
    await expect(page.getByText(/0 record\(s\) found|no (products|results)/i).first(), "empty-state message").toBeVisible();
    expect(await productHrefs(page), "no product cards").toEqual([]);
    await checkStep(page, testInfo, { id: "ODB-UC-031", name: "no results", health });
  });

  test("ODB-UC-037 / 056 / 058 open a result: product page title and price = product API", async ({ page, health, odb }, testInfo) => {
    await go(page, `/search?keyword=${KEYWORD}`);
    await expect(resultCount(page)).toBeVisible();
    const href = (await productHrefs(page))[0];
    await page.locator(`a[href="${href}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    const product = await apiGet(odb, `/products/${href.split("/").pop()}`);
    await expect(page.getByRole("heading", { level: 1 }).first(), "title = API").toHaveText(product.title, { ignoreCase: true });
    const price = product.aggregate && product.aggregate.lowestPrice;
    await expect(page.getByText(new RegExp(`\\$${Number(price).toFixed(2).replace(".", "\\.")}`)).first(), `price $${price} = API lowest offer`).toBeVisible();
    await expect(pdpAddToCart(page), "Add to cart shown for an in-stock product").toBeVisible();
    await checkStep(page, testInfo, { id: "ODB-UC-056", name: "product page", health });
  });

  test("ODB-UC-038 / 040 logo and breadcrumb Home go to the homepage", async ({ page, health }, testInfo) => {
    await go(page, `/search?keyword=${KEYWORD}`);
    await page.getByRole("link", { name: /^Home$/ }).first().click();
    await expect(page, "breadcrumb Home").toHaveURL(/\/$/);
    await go(page, `/search?keyword=${KEYWORD}`);
    await page.locator("header a[href='/']").first().click();
    await expect(page, "logo").toHaveURL(/\/$/);
    await checkStep(page, testInfo, { id: "ODB-UC-038", name: "back home", health });
  });

  test.describe("cart (guest, dev/local only)", () => {
    test.beforeEach(({ odb }) => test.skip(!odb.writable, "cart writes run only on a dev/local target"));

    test("ODB-UC-113 / 114 / 121 add to cart: badge, cart line and subtotal = cart API", async ({ page, health, odb }, testInfo) => {
      const item = await openInStockProduct(page, odb);
      await pdpAddToCart(page).click();
      await expect(page.getByText(/added to your cart/i).first(), "confirmation shown").toBeVisible();
      await expect(cartBadge(page)).toContainText("1");
      await checkStep(page, testInfo, { id: "ODB-UC-113", name: "added to cart", health });

      await go(page, "/account/shopping-cart");
      await expect(page.getByRole("heading", { name: "Cart" })).toBeVisible();
      await expect(page.getByText(item.title, { exact: false }).first(), "line shows the product").toBeVisible();
      await expect(cartQty(page)).toHaveValue("1");
      const id = await cartId(page);
      expect(id, "guest cart id stored").toBeTruthy();
      const cart = await apiGet(odb, `/user/cart/${id}`);
      const c = cart.cart || cart.data || cart;
      const lines = c.items || c.lines || [];
      expect(lines.length, "cart API: one line").toBe(1);
      const summary = page.getByRole("heading", { name: "Order summary" }).locator("..");
      const subtotalCents = cents(c.subtotal ?? c.totals?.subtotal ?? item.topOffer.price);
      await expect(summary.getByText(new RegExp(`\\$${(subtotalCents / 100).toFixed(2).replace(".", "\\.")}`)).first(), "subtotal = cart API").toBeVisible();
      await checkStep(page, testInfo, { id: "ODB-UC-114", name: "cart", health });
    });

    test("ODB-UC-115 / 117 / 116 update qty recalculates; cart survives a reload; remove empties it", async ({ page, health, odb }, testInfo) => {
      const item = await openInStockProduct(page, odb);
      await pdpAddToCart(page).click();
      await expect(cartBadge(page)).toContainText("1");
      await go(page, "/account/shopping-cart");
      await page.getByRole("button", { name: "+" }).first().click();
      await expect(cartQty(page)).toHaveValue("2");
      const unit = cents(item.topOffer.price);
      await expect(page.getByText(new RegExp(`\\$${((unit * 2) / 100).toFixed(2).replace(".", "\\.")}`)).first(), "line/subtotal = 2 × unit price").toBeVisible();
      const cart = await apiGet(odb, `/user/cart/${await cartId(page)}`);
      const lines = (cart.cart || cart.data || cart).items || [];
      expect(lines.reduce((s, l) => s + Number(l.quantity || l.qty || 0), 0), "cart API qty = 2").toBe(2);
      await checkStep(page, testInfo, { id: "ODB-UC-115", name: "qty 2", health });

      await page.reload();
      await expect(cartQty(page), "cart persists after refresh").toHaveValue("2");

      await page.getByRole("button", { name: /remove|delete/i }).or(page.locator("[aria-label*='remove' i]")).first().click();
      await expect(page.getByText(/cart is empty|no items/i).first(), "empty cart message").toBeVisible();
      await checkStep(page, testInfo, { id: "ODB-UC-116", name: "cart emptied", health });
    });
  });
});
