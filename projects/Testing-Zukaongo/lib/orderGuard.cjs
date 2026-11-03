/**
 * Gate for the live order lifecycle (OrderLifecycle.spec.js).
 * - Off unless ZUKA_ALLOW_ORDER_E2E=1.
 * - Staging (or local) only: if any Zuka URL is a live site the run is refused,
 *   whatever other flag is set. There is no override for production orders.
 * Pure, so it is unit-tested with node --test (orderGuard.test.cjs).
 */
const targetGuard = require("./targetGuard.cjs");

const on = (v) => v === "1" || String(v || "").toLowerCase() === "true";

/** @returns {{ ok: boolean, prod: boolean, reason: string }} */
function orderE2eDecision(env = process.env) {
  const urls = targetGuard.resolveUrls(env);
  const prod = Object.values(urls).some((u) => !targetGuard.isNonProdUrl(u));
  if (!on(env.ZUKA_ALLOW_ORDER_E2E)) {
    return { ok: false, prod, reason: "live order lifecycle off: set ZUKA_ALLOW_ORDER_E2E=1 (Zuka staging only)" };
  }
  if (prod) {
    return {
      ok: false,
      prod,
      reason: "order lifecycle refused: Zuka URLs include a live site (zukaongo.com); orders run on Zuka staging only",
    };
  }
  return { ok: true, prod, reason: "Zuka staging/local URLs" };
}

module.exports = { orderE2eDecision };
