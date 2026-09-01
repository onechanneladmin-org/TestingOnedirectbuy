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
    .locator(".ps-product__price")
    .or(page.getByRole("heading", { name: /\$\s*\d+/ }))
    .first();
}

export function pdpQtyUp(page) {
  return page.locator("button.up").first();
}

export function pdpQtyDown(page) {
  return page.locator("button.down").first();
}

export function pdpQtyInput(page) {
  return page.locator(".form-group--number input").first();
}

export function pdpWishlist(page) {
  return page.locator("button.wishlist-btn").first();
}

export function pdpBuyNow(page) {
  return page.getByRole("link", { name: /^Buy Now$/i }).first();
}

export function pdpTab(page, nameRe) {
  return page.getByRole("tab", { name: nameRe }).first();
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
  await tab.click();
}

export { productAddToCartControl };
