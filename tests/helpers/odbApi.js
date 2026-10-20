/**
 * ODB buyer API checks for UI flows: after a step that moves money or stock, read the data back so
 * a screen that LOOKS right but saved the wrong numbers still fails.
 *
 *   import { readOrder, expectOrderStatus, expectMoney } from "../helpers/odbApi.js";
 *   const order = await readOrder(buyerToken, orderId);
 *   expectOrderStatus(order, ["placed", "processing"]);
 *   expectMoney(order.total, uiTotal, "order total = total shown on the confirmation page");
 *
 * Base URL: ONEDIRECTBUY_API_URL (default https://dev.onedirectbuy.com — same as couponApi.js).
 * Read-only (GET) on purpose; writes happen through the UI under test.
 */
import { expect } from "@playwright/test";
import { api, API_URL } from "./couponApi.js";
import core from "../../lib/checkStepCore.js";

export { API_URL };
const { cents } = core;

/** GET /user/orders/:id as the buyer. Returns the order object (unwrapped). */
export async function readOrder(buyerToken, orderId) {
  const res = await api("GET", `/user/orders/${encodeURIComponent(orderId)}`, { token: buyerToken });
  expect(res.status, `GET /user/orders/${orderId} → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
  return res.json?.order || res.json?.data || res.json;
}

/** GET /user/cart/:id (guest or buyer). */
export async function readCart(cartId, buyerToken) {
  const res = await api("GET", `/user/cart/${encodeURIComponent(cartId)}`, { token: buyerToken });
  expect(res.status, `GET /user/cart/${cartId} → ${res.status}`).toBe(200);
  return res.json?.cart || res.json?.data || res.json;
}

/** Order (or line) status is one of `allowed` (case-insensitive). */
export function expectOrderStatus(orderOrLine, allowed, message = "order status") {
  const status = String(orderOrLine?.status || orderOrLine?.orderStatus || "").toLowerCase();
  expect.soft(allowed.map((s) => s.toLowerCase()), `${message}: got "${status}"`).toContain(status);
  return status;
}

/** Two money values are equal to the cent. */
export function expectMoney(actual, expected, message = "amount") {
  expect.soft(cents(actual), `${message}: ${actual} vs ${expected}`).toBe(cents(expected));
}

/** Parse "$1,234.56" / "1234.56" from UI text. */
export function moneyFromText(text) {
  const m = String(text || "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : NaN;
}
