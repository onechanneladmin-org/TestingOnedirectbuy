/**
 * Coupon / cart API helpers for tests/OneDirectBuy/Coupons.spec.js.
 * Uses Node's global fetch (no browser) so API cases run fast and without a page.
 *
 * Env:
 *   ONEDIRECTBUY_API_URL            storefront API (default https://dev.onedirectbuy.com)
 *   ONEDIRECTBUY_TEST_COUPON        coupon code to use for the "valid coupon" cases
 *                                   (default: first active coupon from GET /coupons)
 *   ONEDIRECTBUY_COUPON_PRODUCT_SLUG product used to seed carts
 *   ONEDIRECTBUY_ADMIN_API_TOKEN    Firebase ID token of a platform admin (optional)
 */

export const API_URL = (
  process.env.ONEDIRECTBUY_API_URL || "https://dev.onedirectbuy.com"
).replace(/\/$/, "");

const PRODUCT_SLUG =
  process.env.ONEDIRECTBUY_COUPON_PRODUCT_SLUG ||
  "creed-utv-24x7-4x156-115-0-m-blk-mch";

/** @returns {Promise<{status:number, json:any, text:string}>} */
export async function api(method, path, { body, token, headers = {} } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-JSON body (gateway pages etc.)
  }
  return { status: res.status, json, text };
}

export async function listCoupons(query = "") {
  const res = await api("GET", `/coupons${query}`);
  if (res.status !== 200) {
    throw new Error(`GET /coupons${query} -> ${res.status} ${res.text.slice(0, 200)}`);
  }
  return res.json;
}

/**
 * Coupon used by the "valid coupon" cases.
 * @returns {Promise<{code:string, discountType?:string, value?:number, minOrderAmount?:number, campaignType?:string}>}
 */
export async function getTestCoupon() {
  const fromEnv = (process.env.ONEDIRECTBUY_TEST_COUPON || "").trim();
  if (fromEnv) {
    const { items } = await listCoupons(`?code=${encodeURIComponent(fromEnv)}`);
    return items?.[0] || { code: fromEnv.toUpperCase() };
  }
  const { items } = await listCoupons();
  const coupon = (items || []).find((c) => c.code);
  if (!coupon) {
    throw new Error(
      "No active coupon found via GET /coupons — create one or set ONEDIRECTBUY_TEST_COUPON.",
    );
  }
  return coupon;
}

/** Offer (productId/listingId/sellerId/price) used to seed carts. */
let offerCache = null;
export async function getSeedOffer() {
  if (offerCache) return offerCache;
  const res = await api("GET", `/products/${PRODUCT_SLUG}`);
  if (res.status !== 200) {
    throw new Error(`GET /products/${PRODUCT_SLUG} -> ${res.status}`);
  }
  const p = res.json;
  const offer = (p.offerSellers || []).find((o) => (o.qty ?? 0) > 5) || p.offerSellers?.[0];
  if (!offer) throw new Error(`Product ${PRODUCT_SLUG} has no offers.`);
  offerCache = {
    productId: p._id,
    listingId: offer.listingId,
    sellerId: offer.id,
    price: Number(offer.effectivePrice ?? offer.price ?? p.price),
  };
  return offerCache;
}

/** Create a guest cart holding `qty` of the seed product. */
export async function createGuestCart(qty = 1) {
  const o = await getSeedOffer();
  const res = await api("POST", "/user/cart/new/items", {
    body: {
      qty,
      priceAtAdd: o.price,
      productId: o.productId,
      listingId: o.listingId,
      sellerId: o.sellerId,
    },
  });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`Seeding guest cart failed: ${res.status} ${res.text.slice(0, 200)}`);
  }
  return res.json;
}

export const applyCoupon = (cartId, body) =>
  api("POST", `/user/cart/${cartId}/coupon`, { body });

export const removeCoupon = (cartId) =>
  api("DELETE", `/user/cart/${cartId}/coupon`);

export const getCart = (cartId) => api("GET", `/user/cart/${cartId}`);

/** Expected merchandise discount for a coupon row from GET /coupons. */
export function expectedDiscount(coupon, subtotal) {
  const value = Number(coupon.value || 0);
  const raw =
    coupon.discountType === "percent" ? (subtotal * Math.min(value, 100)) / 100 : value;
  return Math.round(Math.min(raw, subtotal) * 100) / 100;
}

/** Cents-safe money compare. */
export const cents = (n) => Math.round(Number(n) * 100);
