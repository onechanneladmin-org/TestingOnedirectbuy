/**
 * Gate for the live order lifecycle (OrderLifecycle.spec.js).
 * - Off unless ZUKA_ALLOW_ORDER_E2E=1.
 * - When any Zuka URL is the live site (*.zukaongo.com), it also needs
 *   ZUKA_ALLOW_PROD_ORDERS=1: real orders, real kitchen and driver actions.
 * Pure, so it is unit-tested with node --test (orderGuard.test.cjs).
 */
const URL_VARS = ["ZUKA_CUSTOMER_URL", "ZUKA_ADMIN_URL", "ZUKA_PARTNER_URL", "ZUKA_PARTNER_ALIAS_URL", "ZUKA_API_URL"];
const DEFAULT_URLS = {
  ZUKA_CUSTOMER_URL: "https://zukaongo.com",
  ZUKA_ADMIN_URL: "https://admin.zukaongo.com",
  ZUKA_PARTNER_URL: "https://drivers.zukaongo.com",
  ZUKA_PARTNER_ALIAS_URL: "https://partners.zukaongo.com",
  ZUKA_API_URL: "https://api.zukaongo.com",
};
const PROD_HOST = /(^|\.)zukaongo\.com$/i;

const on = (v) => v === "1" || String(v || "").toLowerCase() === "true";

function isProdUrl(url) {
  try {
    return PROD_HOST.test(new URL(url).hostname);
  } catch {
    return true; // unparseable: treat as prod
  }
}

/** @returns {{ ok: boolean, prod: boolean, reason: string }} */
function orderE2eDecision(env = process.env) {
  const urls = URL_VARS.map((k) => String(env[k] || "").trim() || DEFAULT_URLS[k]);
  const prod = urls.some(isProdUrl);
  if (!on(env.ZUKA_ALLOW_ORDER_E2E)) {
    return { ok: false, prod, reason: "live order lifecycle off: set ZUKA_ALLOW_ORDER_E2E=1 to run it" };
  }
  if (prod && !on(env.ZUKA_ALLOW_PROD_ORDERS)) {
    return {
      ok: false,
      prod,
      reason: "Zuka URLs point at the live site (zukaongo.com): real orders also need ZUKA_ALLOW_PROD_ORDERS=1",
    };
  }
  return { ok: true, prod, reason: prod ? "live site, both flags set" : "non-prod Zuka URLs" };
}

module.exports = { orderE2eDecision, isProdUrl };
