import { expect } from "@playwright/test";
import {
  dismissCookieBanner,
  openKnownProductDetail,
  productAddToCartControl,
} from "./oneDirectBuyNav.js";

export async function openGuestPdp(page, keyword = "bearing") {
  await openKnownProductDetail(page, keyword);
}

export function pdpTitle(page) {
  return page.getByRole("heading", { level: 1 }).first();
}

export function pdpPrice(page) {
  return page
    .getByRole("heading", { name: /\$\s*\d+/ })
    .or(page.locator(".ps-product__price, [class*='price']"))
    .or(page.locator("h1, h2, h3, h4, h5, p, span").filter({ hasText: /\$\s*\d+/ }))
    .filter({ visible: true })
    .first();
}

export function pdpQtyUp(page) {
  return page
    .locator("button.up, button[aria-label*='Increase quantity'], button:has(.fa-plus)")
    .filter({ visible: true })
    .first();
}

export function pdpQtyDown(page) {
  return page
    .locator("button.down, button[aria-label*='Decrease quantity'], button:has(.fa-minus)")
    .filter({ visible: true })
    .first();
}

export function pdpQtyInput(page) {
  return page
    .locator(".form-group--number input, input[aria-label='Quantity'], input#product-quantity-1, input.form-control")
    .filter({ visible: true })
    .first();
}

export function pdpWishlist(page) {
  return page
    .locator(".ps-product__actions a, .ps-product a, button.wishlist-btn")
    .filter({ has: page.locator("i.icon-heart, [class*='heart']") })
    .filter({ visible: true })
    .first();
}

export function pdpBuyNow(page) {
  return page
    .getByRole("link", { name: /^Buy Now$/i })
    .or(page.getByRole("button", { name: /^Buy Now$/i }))
    .or(page.locator("a, button").filter({ hasText: /^Buy Now$/i }))
    .filter({ visible: true })
    .first();
}

export function pdpTab(page, nameRe) {
  return page
    .getByRole("tab", { name: nameRe })
    .or(page.locator("[role='tab'], .ps-tab-list a, .ps-product__tabs a").filter({ hasText: nameRe }))
    .first();
}

export function pdpVariantControls(page) {
  return page
    .locator(".ps-product__variations, .ps-product__attribute")
    .or(page.getByRole("radiogroup"))
    .or(page.getByRole("combobox", { name: /size|color|option|variant/i }))
    .or(page.getByText(/^(Size|Color|Style|Select option):/i));
}

export function pdpShippingEstimate(page) {
  return page
    .getByPlaceholder(/zip|postal/i)
    .or(page.getByRole("textbox", { name: /zip|postal|shipping/i }))
    .or(page.getByRole("button", { name: /estimate shipping|get (quote|estimate)|check delivery/i }));
}

export async function openPdpTab(page, nameRe) {
  await dismissCookieBanner(page);
  const tab = pdpTab(page, nameRe);
  await expect(tab).toBeVisible({ timeout: 15_000 });
  await tab.scrollIntoViewIfNeeded().catch(() => {});
  await tab.click({ force: true });
}

export { productAddToCartControl };
