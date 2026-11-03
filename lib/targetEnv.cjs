/**
 * Which site the suite points at, and whether it may run there.
 *
 * - Default target is dev (https://dev.onedirectbuy.com), never production.
 * - A host counts as non-production only when it is explicitly a dev/staging/
 *   local host (see NON_PROD_HOST). Everything else is treated as production.
 * - Production needs ALLOW_PROD=1, and then only the specs listed in
 *   ci-tests.config.json → "productionReadOnly" may run.
 * - The API URLs (ONEDIRECTBUY_API_URL, ONEDIRECTBUY_BUYER_API_URL) are checked too:
 *   a dev/staging storefront with a production API (or the reverse) is always refused.
 */
const fs = require("fs");
const path = require("path");

const DEFAULT_BASE_URL = "https://dev.onedirectbuy.com";

const NON_PROD_HOST =
  /^(localhost|127\.0\.0\.1|\[::1\]|[a-z0-9-]+\.localhost|[a-z0-9.-]+\.test|(dev|staging|qa|test)(-[a-z0-9-]+)?\.[a-z0-9.-]+)$/i;

const BASE_URL_VARS = ["ONEDIRECTBUY_BASE_URL", "BASE_URL", "PLAYWRIGHT_BASE_URL"];
const API_URL_VARS = ["ONEDIRECTBUY_API_URL", "ONEDIRECTBUY_BUYER_API_URL"];
const STAGING_API_URL = "https://staging-api.onedirectbuy.com";

/** URL the helpers navigate to. */
function resolveBaseUrl(env = process.env) {
  for (const key of BASE_URL_VARS) {
    const v = String(env[key] || "").trim();
    if (v) return v.replace(/\/+$/, "");
  }
  return DEFAULT_BASE_URL;
}

/**
 * Storefront API the helpers call: ONEDIRECTBUY_API_URL, else the one that matches the
 * storefront (staging → staging-api, production → <origin>/api, anything else → dev).
 */
function resolveApiUrl(env = process.env) {
  const explicit = String(env.ONEDIRECTBUY_API_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const base = resolveBaseUrl(env);
  let host = "";
  try {
    host = new URL(base).hostname;
  } catch {
    // fall through to the dev default
  }
  if (/^staging(-[a-z0-9-]+)?\.onedirectbuy\.com$/i.test(host)) return STAGING_API_URL;
  if (host && !isNonProdUrl(base)) return `${new URL(base).origin}/api`;
  return DEFAULT_BASE_URL;
}

/** API URLs set explicitly (an unset one follows the storefront, see resolveApiUrl). */
function configuredApiUrls(env = process.env) {
  return API_URL_VARS.map((k) => String(env[k] || "").trim()).filter(Boolean);
}

/** Every base URL in play (any of them may be navigated to by some helper). */
function configuredBaseUrls(env = process.env) {
  const urls = BASE_URL_VARS.map((k) => String(env[k] || "").trim()).filter(Boolean);
  return urls.length ? urls : [DEFAULT_BASE_URL];
}

function isNonProdUrl(url) {
  try {
    return NON_PROD_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** True when every configured base URL is a dev/staging/local host. */
function isNonProdTarget(env = process.env) {
  return configuredBaseUrls(env).every(isNonProdUrl);
}

function allowProd(env = process.env) {
  return env.ALLOW_PROD === "1" || env.ALLOW_PROD === "true";
}

/** Spec basenames allowed against production (read-only browsing only). */
function productionReadOnlySpecs(root = path.resolve(__dirname, "..")) {
  try {
    const cfg = JSON.parse(
      fs.readFileSync(path.join(root, "ci-tests.config.json"), "utf8"),
    );
    return (cfg.productionReadOnly || []).map((f) => path.basename(String(f)));
  } catch {
    return [];
  }
}

/**
 * Decide whether a run may start.
 * @returns {{ ok: true, prod: boolean, readOnlySpecs: string[] } | { ok: false, reason: string }}
 */
function checkTarget(env = process.env, root) {
  const apiUrls = configuredApiUrls(env);
  const all = [...configuredBaseUrls(env), ...apiUrls];
  const nonProd = all.filter(isNonProdUrl);
  if (nonProd.length && nonProd.length < all.length) {
    return {
      ok: false,
      reason:
        `Refusing to run: storefront and API point at different environments ` +
        `(non-prod: ${nonProd.join(", ")}; prod: ${all.filter((u) => !isNonProdUrl(u)).join(", ")}). ` +
        `Set ONEDIRECTBUY_API_URL to the API of the same target, e.g. ${STAGING_API_URL} for staging.`,
    };
  }
  if (isNonProdTarget(env)) return { ok: true, prod: false, readOnlySpecs: [] };
  const urls = all.filter((u) => !isNonProdUrl(u));
  if (!allowProd(env)) {
    return {
      ok: false,
      reason:
        `Refusing to run against production (${urls.join(", ")}). ` +
        `Point BASE_URL / ONEDIRECTBUY_BASE_URL at ${DEFAULT_BASE_URL}, ` +
        `or set ALLOW_PROD=1 to run only the read-only specs listed in ci-tests.config.json → productionReadOnly.`,
    };
  }
  const readOnlySpecs = productionReadOnlySpecs(root);
  if (!readOnlySpecs.length) {
    return {
      ok: false,
      reason: "ALLOW_PROD=1 but ci-tests.config.json has no productionReadOnly specs.",
    };
  }
  return { ok: true, prod: true, readOnlySpecs };
}

/**
 * Specs that place real orders (BuyerPurchaseJourney) run only with ODB_ALLOW_ORDERS=1
 * and a staging or local storefront + API (never dev, never production).
 * @returns {{ ok: boolean, reason: string }}
 */
function orderPlacingDecision(env = process.env, root) {
  if (!(env.ODB_ALLOW_ORDERS === "1" || env.ODB_ALLOW_ORDERS === "true")) {
    return { ok: false, reason: "places a real order: set ODB_ALLOW_ORDERS=1 (staging or local target only)" };
  }
  const target = checkTarget(env, root);
  if (!target.ok || target.prod) {
    return { ok: false, reason: `order placing refused: ${target.ok ? "production target" : target.reason}` };
  }
  const STAGING_OR_LOCAL =
    /^(localhost|127\.0\.0\.1|\[::1\]|[a-z0-9-]+\.localhost|staging(-[a-z0-9-]+)?\.onedirectbuy\.com)$/i;
  const urls = [resolveBaseUrl(env), resolveApiUrl(env), ...configuredApiUrls(env)];
  const bad = urls.filter((u) => {
    try {
      return !STAGING_OR_LOCAL.test(new URL(u).hostname);
    } catch {
      return true;
    }
  });
  if (bad.length) {
    return { ok: false, reason: `order placing needs a staging or local target, not ${bad.join(", ")}` };
  }
  return { ok: true, reason: "staging/local target with ODB_ALLOW_ORDERS=1" };
}

/** ci-tests.config.json entries marked "placesOrders": true. */
function placesOrders(entry) {
  return Boolean(entry && entry.placesOrders);
}

module.exports = {
  DEFAULT_BASE_URL,
  orderPlacingDecision,
  placesOrders,
  STAGING_API_URL,
  resolveBaseUrl,
  resolveApiUrl,
  configuredApiUrls,
  configuredBaseUrls,
  isNonProdUrl,
  isNonProdTarget,
  allowProd,
  productionReadOnlySpecs,
  checkTarget,
};
