/**
 * Which site the suite points at, and whether it may run there.
 *
 * - Default target is dev (https://dev.onedirectbuy.com), never production.
 * - A host counts as non-production only when it is explicitly a dev/staging/
 *   local host (see NON_PROD_HOST). Everything else is treated as production.
 * - Production needs ALLOW_PROD=1, and then only the specs listed in
 *   ci-tests.config.json → "productionReadOnly" may run.
 */
const fs = require("fs");
const path = require("path");

const DEFAULT_BASE_URL = "https://dev.onedirectbuy.com";

const NON_PROD_HOST =
  /^(localhost|127\.0\.0\.1|\[::1\]|[a-z0-9-]+\.localhost|[a-z0-9.-]+\.test|(dev|staging|qa|test)(-[a-z0-9-]+)?\.[a-z0-9.-]+)$/i;

const BASE_URL_VARS = ["ONEDIRECTBUY_BASE_URL", "BASE_URL", "PLAYWRIGHT_BASE_URL"];

/** URL the helpers navigate to. */
function resolveBaseUrl(env = process.env) {
  for (const key of BASE_URL_VARS) {
    const v = String(env[key] || "").trim();
    if (v) return v.replace(/\/+$/, "");
  }
  return DEFAULT_BASE_URL;
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
  if (isNonProdTarget(env)) return { ok: true, prod: false, readOnlySpecs: [] };
  const urls = configuredBaseUrls(env).filter((u) => !isNonProdUrl(u));
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

module.exports = {
  DEFAULT_BASE_URL,
  resolveBaseUrl,
  configuredBaseUrls,
  isNonProdUrl,
  isNonProdTarget,
  allowProd,
  productionReadOnlySpecs,
  checkTarget,
};
