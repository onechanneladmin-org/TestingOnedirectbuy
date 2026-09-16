import { expect } from "@playwright/test";

export const ONE_DIRECT_BUY_BASE_URL =
  process.env.ONEDIRECTBUY_BASE_URL || "https://onedirectbuy.com";

const DEFAULT_TIMEOUT = 15_000;

/** Dismiss cookie consent banner when shown. */
export async function dismissCookieBanner(page) {
  const acceptAll = page.getByRole("button", { name: /Accept all/i }).first();
  const rejectOptional = page
    .getByRole("button", { name: /Reject optional/i })
    .first();

  if (await acceptAll.isVisible({ timeout: 4_000 }).catch(() => false)) {
    await acceptAll.click({ force: true }).catch(() => {});
    await acceptAll.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
    return;
  }
  if (await rejectOptional.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await rejectOptional.click({ force: true }).catch(() => {});
  }
}

/**
 * AI assistant / chat can mount over the page and mark the main tree
 * aria-hidden, which makes getByRole miss Menu/Vehicle/etc.
 */
export async function dismissAssistantOverlay(page) {
  // Prefer explicit conversation closers — avoid generic "Close" which can
  // match unrelated dialogs/toasts.
  const closers = [
    page.getByRole("button", { name: /^Close conversations$/i }),
    page.getByRole("button", { name: /^Dismiss suggestions$/i }),
    page.getByRole("button", { name: /^Close assistant$/i }),
  ];
  for (const btn of closers) {
    const target = btn.first();
    if (await target.isVisible().catch(() => false)) {
      await target.click({ force: true }).catch(() => {});
      await page.waitForTimeout(200);
    }
  }

  const conversations = page.getByRole("heading", { name: /^Conversations$/i });
  if (await conversations.first().isVisible().catch(() => false)) {
    const close = page
      .getByRole("button", { name: /^Close$/i })
      .or(page.getByRole("button", { name: /^Close modal$/i }))
      .or(page.getByRole("button", { name: /^Close conversations$/i }))
      .first();
    if (await close.isVisible().catch(() => false)) {
      await close.click({ force: true }).catch(() => {});
    } else {
      await page.keyboard.press("Escape").catch(() => {});
    }
  }
}

export async function resetDesktopStorefront(page, size = { width: 1920, height: 1080 }) {
  try {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.clearDeviceMetricsOverride");
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [
        { name: "hover", value: "hover" },
        { name: "pointer", value: "fine" },
      ],
    });
  } catch {
    /* ignore */
  }
  await page.setViewportSize(size);
}

/** Force mobile layout: storefront chrome keys off pointer/hover and mobile metrics. */
export async function emulateMobileStorefront(page, size = { width: 390, height: 844 }) {
  await page.setViewportSize(size);
  try {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: size.width,
      height: size.height,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [
        { name: "hover", value: "none" },
        { name: "pointer", value: "coarse" },
      ],
    });
  } catch {
    // headed/CDP session may already exist
  }
  await dismissCookieBanner(page);
  await dismissAssistantOverlay(page);
}

/** Navigate to a OneDirectBuy path and dismiss cookies. */
export async function gotoOneDirectBuy(page, path = "/") {
  const url = path.startsWith("http")
    ? path
    : `${ONE_DIRECT_BUY_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);
    const bodyText = await page.locator("body").innerText().catch(() => "");
    if (!/no healthy upstream|503|502 bad gateway/i.test(bodyText)) {
      break;
    }
    await page.waitForTimeout(2000 * (attempt + 1));
  }

  await page.waitForLoadState("networkidle").catch(() => {});
  await dismissCookieBanner(page);
  await dismissAssistantOverlay(page);
}

/** Wait until the shop listing has loaded products. */
export async function waitForShopProducts(page) {
  await dismissCookieBanner(page);
  const countLabel = page.getByText(/[1-9]\d*\s+Products found/i);
  const productOrAdd = page
    .locator("button.add-to-cart")
    .or(page.getByRole("button", { name: /^Add To Cart$/i }))
    .or(
      page.locator(
        'article a[href*="/product/"], .ps-product a[href*="/product/"], .ps-shop-items a[href*="/product/"], a[href*="/product/"]',
      ),
    )
    .first();

  // Prefer a non-zero count label; fall back to visible product cards/controls.
  const hasCount = await countLabel
    .isVisible({ timeout: 30_000 })
    .catch(() => false);
  if (hasCount) return;
  await expect(productOrAdd).toBeVisible({ timeout: 120_000 });
}

/** Sort control on shop/search listing (not the header Product category combobox). */
export function shopSortSelect(page) {
  return page
    .getByRole("combobox", { name: /Sort items/i })
    .or(page.getByLabel(/Sort items/i))
    .or(page.locator('select[aria-label="Sort items"]'))
    .first();
}

/** Header keyword field (desktop chrome). Live UI is a combobox, not a textbox. */
export function headerSearchInput(page) {
  return page
    .getByRole("combobox", { name: /Search products/i })
    .or(page.getByPlaceholder(/I.?m shopping for/i))
    .or(page.getByRole("textbox", { name: /Search products/i }))
    .first();
}

/** Live autocomplete panel under the header search box. */
export function searchSuggestionPanel(page) {
  return page.locator(
    ".ps-panel--search-result.active, .ps-search-suggestions, a.ps-search-suggestion",
  );
}

/**
 * Type in header search until category/brand/product suggestions appear.
 * Live UI: `.ps-panel--search-result.active` with SUGGESTIONS / CATEGORIES / PRODUCTS.
 */
export async function typeForSearchSuggestions(page, keyword = "bearing") {
  await dismissCookieBanner(page);
  await dismissAssistantOverlay(page);
  const box = headerSearchInput(page);
  await expect(box).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await box.click();
  await box.fill("");
  await box.pressSequentially(keyword, { delay: 35 });
  await expect(searchSuggestionPanel(page).first()).toBeVisible({
    timeout: 12_000,
  });
}

/** Click a category link in the shop/search listing sidebar. */
export async function filterListingByCategory(page, categoryName = "Exterior") {
  await dismissCookieBanner(page);
  const link = page
    .getByRole("heading", { name: /^Categories$/i })
    .locator("..")
    .getByRole("link", { name: new RegExp(`^${categoryName}$`, "i") })
    .or(page.getByRole("link", { name: new RegExp(`^${categoryName}$`, "i") }))
    .first();
  await expect(link).toBeVisible({ timeout: 15_000 });
  await link.click();
  await page.waitForURL(/\/category\/|\/shop|\/search/i, { timeout: 20_000 });
  await dismissCookieBanner(page);
}

/** Breadcrumb Home control on listing pages. */
export function breadcrumbHomeLink(page) {
  return page
    .getByRole("navigation", { name: /Breadcrumb/i })
    .getByRole("link", { name: /^Home$/i })
    .or(page.getByRole("link", { name: /^Home$/i }))
    .first();
}

/** Run a header keyword search like a shopper (type + Search). */
export async function searchProducts(page, keyword) {
  await dismissCookieBanner(page);
  await dismissAssistantOverlay(page);
  const box = headerSearchInput(page);
  await expect(box).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await box.fill(keyword);

  const searchBtn = page.getByRole("button", { name: /^Search$/i }).first();
  try {
    await Promise.all([
      page.waitForURL(/\/search\?/, { timeout: 15_000 }),
      searchBtn.click(),
    ]);
  } catch {
    // Fallback: direct navigation to search URL
    await gotoOneDirectBuy(page, `/search?keyword=${encodeURIComponent(keyword)}`);
  }
  await dismissCookieBanner(page);
}

/** Open the first in-stock product detail page from the shop listing. */
export async function openFirstProductFromShop(page) {
  await gotoOneDirectBuy(page, "/shop");
  await waitForShopProducts(page);
  const productLink = page.locator('a[href*="/product/"]').first();
  await productLink.click();
  await page.waitForURL(/\/product\//, { timeout: DEFAULT_TIMEOUT });
  await dismissCookieBanner(page);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
    timeout: DEFAULT_TIMEOUT,
  });
}

/** Open a known in-stock PDP via search (faster / more stable than shop scan). */
export async function openKnownProductDetail(page, keyword = "bearing") {
  try {
    await gotoOneDirectBuy(page, `/search?keyword=${encodeURIComponent(keyword)}`);
    await dismissCookieBanner(page);
    await expect(
      page.getByRole("heading", { name: /Search result for/i }),
    ).toBeVisible({ timeout: 20_000 });
    const productLink = page
      .locator(
        'article a[href*="/product/"], .ps-product a[href*="/product/"], .ps-shop-items a[href*="/product/"], a[href*="/product/"]',
      )
      .first();
    await expect(productLink).toBeVisible({ timeout: 20_000 });
    await Promise.all([
      page.waitForURL(/\/product\//, { timeout: 20_000, waitUntil: "domcontentloaded" }),
      productLink.click({ force: true }),
    ]);
  } catch {
    // Resilient fallback: directly open known in-stock product detail page
    await gotoOneDirectBuy(page, "/product/bearing-bolt-bearing-to-spinner");
  }
  await dismissCookieBanner(page);
  await dismissAssistantOverlay(page);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
    timeout: 30_000,
  });
}

/** PDP Add to cart control (live site uses a link or button; pick the visible one). */
export function productAddToCartControl(page) {
  return page
    .locator("a, button")
    .filter({ hasText: /add\s*to\s*cart/i })
    .filter({ visible: true })
    .first();
}

async function waitForCartAddSuccess(page) {
  const addedNotice = page
    .locator(".ant-notification-notice, .ant-message-notice, .ant-message")
    .filter({
      hasText: /cart updated|added( to (your )?cart)?|successfully added|item added|added successfully/i,
    })
    .or(page.getByText(/cart updated|added to (your )?cart|item added/i));
  if (
    await addedNotice
      .first()
      .isVisible({ timeout: 8_000 })
      .catch(() => false)
  ) {
    return true;
  }

  if (
    await page
      .getByRole("link", { name: /[1-9]\d*\s*Cart/i })
      .first()
      .isVisible({ timeout: 2_000 })
      .catch(() => false)
  ) {
    return true;
  }

  const badge = page.locator(
    ".ps-cart span, .header-cart .badge, [class*='cart'] .badge, .ps-cart__number",
  );
  if (await badge.first().isVisible({ timeout: 1_000 }).catch(() => false)) {
    const text = ((await badge.first().innerText().catch(() => "")) || "").trim();
    if (/^[1-9]\d*$/.test(text)) return true;
  }

  if (/shopping-cart/i.test(page.url()) && !(await page.getByText(/Your cart is empty/i).isVisible().catch(() => false))) {
    return true;
  }

  return false;
}

async function cartPageHasLines(page) {
  await gotoOneDirectBuy(page, "/account/shopping-cart");
  await waitForCartReady(page);
  if (
    await page
      .getByRole("heading", { name: /Your cart is empty/i })
      .isVisible()
      .catch(() => false)
  ) {
    return false;
  }
  return Boolean(
    await page
      .getByText(/\d+\s+items?/i)
      .or(page.locator(".ps-cart-line"))
      .or(page.getByRole("button", { name: /^Remove item$/i }))
      .first()
      .isVisible()
      .catch(() => false),
  );
}

async function clickVisibleAddToCart(page) {
  await dismissAssistantOverlay(page);
  await page.keyboard.press("Escape").catch(() => {});
  const add = page
    .getByRole("button", { name: /^Add To Cart$/i })
    .or(productAddToCartControl(page))
    .first();
  if (await add.isVisible({ timeout: 12_000 }).catch(() => false)) {
    await add.scrollIntoViewIfNeeded().catch(() => {});
    await add.click({ force: true });
    return true;
  }
  return page.evaluate(() => {
    const el = [...document.querySelectorAll("a, button")].find((node) =>
      /add\s*to\s*cart/i.test((node.textContent || "").replace(/\s+/g, " ")),
    );
    if (!el) return false;
    el.click();
    return true;
  });
}

async function addFromShopGrid(page) {
  await gotoOneDirectBuy(page, "/shop");
  await waitForShopProducts(page);
  if (!(await clickVisibleAddToCart(page))) return false;
  await page.waitForTimeout(2_000);
  if (await waitForCartAddSuccess(page)) return true;
  return cartPageHasLines(page);
}

async function addKnownInStockProduct(page) {
  await openKnownProductDetail(page, "bearing");
  if (!(await clickVisibleAddToCart(page))) return false;
  await page.waitForTimeout(2_000);
  if (await waitForCartAddSuccess(page)) return true;
  return cartPageHasLines(page);
}

/** Add a product via shop grid or known PDP. Guest cart often does not persist — retry logged in. */
export async function addFirstProductToCartFromShop(page) {
  if (await addFromShopGrid(page)) return;
  if (await addKnownInStockProduct(page)) return;

  const { ensureLoggedInBuyer } = await import("./oneDirectBuyAuth.js");
  await ensureLoggedInBuyer(page);
  if (await addFromShopGrid(page)) return;
  if (await addKnownInStockProduct(page)) return;

  throw new Error(
    "Could not add a product to cart after guest and logged-in attempts",
  );
}

/** Wait until cart page finishes loading (empty or with lines). */
export async function waitForCartReady(page) {
  await dismissCookieBanner(page);
  await dismissAssistantOverlay(page);
  await expect(page.getByText(/Loading your cart/i))
    .toBeHidden({ timeout: 60_000 })
    .catch(() => {});
  await expect(
    page
      .getByRole("heading", { name: /Your cart is empty|^Cart$|Shopping Cart/i })
      .or(page.getByText(/Your cart is empty|\d+\s+items?/i))
      .first(),
  ).toBeVisible({ timeout: 30_000 });
}

/** Open cart via header cart link or direct URL. */
export async function openCart(page) {
  await dismissCookieBanner(page);
  // Prefer direct navigation — more reliable than header click after toast.
  await gotoOneDirectBuy(page, "/account/shopping-cart");
  await waitForCartReady(page);
}

/** First cart line "Remove item" control (page can have multiple lines). */
export function cartRemoveItemButton(page) {
  return page
    .locator("button.ps-cart-line__remove")
    .or(page.getByRole("button", { name: /^Remove item$/i }))
    .first();
}

/** First cart line quantity spinbutton. */
export function cartQuantityInput(page) {
  return page
    .locator(".ps-cart-line")
    .getByRole("spinbutton", { name: /^Quantity$/i })
    .or(page.getByRole("spinbutton", { name: /^Quantity$/i }))
    .first();
}

/** First cart line increase-quantity control. */
export function cartIncreaseQtyButton(page) {
  return page
    .locator(".ps-cart-line")
    .getByRole("button", { name: /^Increase quantity$/i })
    .or(page.getByRole("button", { name: /^Increase quantity$/i }))
    .first();
}

export function cartCouponInput(page) {
  return page.getByRole("textbox", { name: /^Coupon$/i });
}

export function cartApplyCouponButton(page) {
  return page.getByRole("button", { name: /^Apply$/i });
}

export function cartRemoveCouponButton(page) {
  return page
    .getByRole("button", { name: /remove coupon|^Remove$/i })
    .or(page.getByRole("link", { name: /remove coupon/i }))
    .first();
}

export function cartLineProductLinks(page) {
  return page.locator(
    '.ps-cart-line a[href*="/product/"], .ps-shopping-cart a[href*="/product/"]',
  );
}

export function cartTaxLine(page) {
  return page.getByText(/^Tax$|^Estimated tax$|^Tax estimate$/i);
}

export function cartShippingLine(page) {
  return page.getByText(
    /^Shipping$|^Estimated shipping$|^Shipping estimate$|^Delivery$/i,
  );
}

export function cartSellerGroup(page) {
  return page.getByText(
    /items from this seller|grouped by seller|sold by the same seller|multi-?seller cart/i,
  );
}

/** Add a shop product then open /account/checkout. */
export async function openCheckoutWithCart(page) {
  await addFirstProductToCartFromShop(page);
  await gotoOneDirectBuy(page, "/account/checkout");
  await dismissCookieBanner(page);
  await expect(
    page.getByRole("heading", { name: /^Checkout Information$/i }),
  ).toBeVisible({ timeout: 30_000 });
}

/**
 * Visible "Shop by Department" control.
 * The storefront ships a hidden mobile clone first in the DOM; `.or().first()`
 * used to match that hidden node and fail toBeVisible().
 */
export function shopByDepartmentTrigger(page) {
  return page
    .locator(".menu__toggle[role='button']")
    .filter({ hasText: /Shop by Department/i })
    .or(page.getByRole("button", { name: /Shop by Department/i }))
    .or(page.getByText(/^Shop by Department$/i))
    .filter({ visible: true })
    .first();
}

/** Desktop: open the "Shop by Department" mega-menu (div.menu__toggle[role=button]). */
export async function openShopByDepartment(page) {
  await dismissCookieBanner(page);
  await dismissAssistantOverlay(page);
  const trigger = shopByDepartmentTrigger(page);

  await expect(trigger).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await trigger.scrollIntoViewIfNeeded().catch(() => {});
  await trigger.hover().catch(() => {});
  await trigger.click();

  const categoryLink = page.locator('a[href*="/category/exterior"]').first();
  if (!(await categoryLink.isVisible({ timeout: 3_000 }).catch(() => false))) {
    await trigger.click({ force: true });
  }

  await expect(
    page
      .getByRole("link", {
        name: /^(Exterior|Interior|Lighting|Performance)$/i,
      })
      .first(),
  ).toBeVisible({ timeout: 10_000 });
}

/** Open Shop by Department and navigate into Exterior like a shopper. */
export async function openDepartmentCategory(page, categoryName = "Exterior") {
  await openShopByDepartment(page);
  const link = page
    .getByRole("link", { name: new RegExp(`^${categoryName}$`, "i") })
    .first();
  await link.click();
  await page.waitForURL(new RegExp(`/category/`, "i"), {
    timeout: DEFAULT_TIMEOUT,
  });
  await dismissCookieBanner(page);
}

/** Mobile bottom bar: open Menu drawer (Home / Shop / Vendor / Blogs). */
export async function openMobileNav(page) {
  await emulateMobileStorefront(page);
  await dismissCookieBanner(page);
  await dismissAssistantOverlay(page);
  const menu = page
    .locator("button.navigation__item")
    .filter({ hasText: /^Menu$/i })
    .or(page.getByRole("button", { name: /^Menu$/i }))
    .first();
  await expect(menu).toBeAttached({ timeout: DEFAULT_TIMEOUT });
  await menu.click({ force: true });
  await expect(
    page
      .getByRole("heading", { name: /^Menu$/i })
      .or(page.getByRole("link", { name: /^All products$/i }))
      .or(page.getByRole("menuitem", { name: /^All products$/i }))
      .or(page.getByRole("link", { name: /^Shop$/i }))
      .or(page.getByRole("menuitem", { name: /^Shop$/i }))
      .first(),
  ).toBeVisible({
    timeout: 10_000,
  });
}

/** Click site logo (`a.ps-logo`) back to homepage. */
export async function clickLogoHome(page) {
  await dismissCookieBanner(page);
  const logo = page.locator("a.ps-logo").first();
  await expect(logo).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await logo.click();
  await page.waitForURL(/\/?$/, { timeout: DEFAULT_TIMEOUT }).catch(() => {});
  await dismissCookieBanner(page);
}
