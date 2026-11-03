/**
 * Target guard: keeps the Zuka suite off the live sites by default.
 *
 * - Default target is Zuka staging (STAGING_URLS below; override per site in .env).
 * - Live zukaongo.com / api. / admin. / partners. / drivers. are refused unless
 *   ALLOW_PROD_READONLY=1. Then only PRODUCTION_READ_ONLY_SPECS run, and specs that
 *   write (orders, carts, accounts, kitchen/driver actions, partner forms) never do.
 * - All Zuka URLs must be on the same side: a staging site next to a live one is refused.
 * - On a non-prod run the browser cannot resolve the live hosts (hostResolverArgs), and
 *   Node-side API calls are checked with assertApiAllowed.
 * Pure (no Playwright imports), unit-tested in targetGuard.test.cjs.
 */
const path = require("path");

/**
 * Zuka staging hosts. partner = the drivers app (live drivers.zukaongo.com),
 * partnerAlias = the partners host (live partners.zukaongo.com).
 */
const STAGING_URLS = {
  customer: "https://staging.zukaongo.com",
  api: "https://staging-api.zukaongo.com",
  admin: "https://staging-admin.zukaongo.com",
  partner: "https://staging-drivers.zukaongo.com",
  partnerAlias: "https://staging-partners.zukaongo.com",
};

/**
 * Env vars per site, first one set wins. Aliases: ZUKA_BASE_URL (customer),
 * ZUKA_DRIVER_URL (drivers app), ZUKA_PARTNERS_URL (partners host).
 */
const URL_VARS = {
  customer: ["ZUKA_CUSTOMER_URL", "ZUKA_BASE_URL"],
  api: ["ZUKA_API_URL"],
  admin: ["ZUKA_ADMIN_URL"],
  partner: ["ZUKA_PARTNER_URL", "ZUKA_DRIVER_URL"],
  partnerAlias: ["ZUKA_PARTNER_ALIAS_URL", "ZUKA_PARTNERS_URL"],
};

const NON_PROD_HOST =
  /^(localhost|127\.0\.0\.1|\[::1\]|[a-z0-9-]+\.localhost|[a-z0-9.-]+\.test|(dev|staging|qa|test)(-[a-z0-9-]+)?\.zukaongo\.com)$/i;

/** Read-only specs: pages, sign-in/out, theme audits that only look. */
const PRODUCTION_READ_ONLY_SPECS = [
  "PublicSite.spec.js",
  "Auth.spec.js",
  "PublicSiteUiAudit.spec.js",
  "AdminUiAudit.spec.js",
  "CustomerAppUiAudit.spec.js",
];

/** Specs that change something on the site: never allowed against production. */
const WRITE_SPEC_PATTERNS = [
  /^OrderLifecycle/i,
  /^CustomerShopping/i,
  /^CustomerAccount/i,
  /^StaffAccess/i,
  /^DriverApp/i,
  /^PartnerOnboarding/i,
  /^AdminConsole/i,
  /^PartnerAppUiAudit/i, // auto-declines live delivery offers for the driver it signs in as
];

const first = (env, keys) => keys.map((k) => String(env[k] || "").trim()).find(Boolean) || "";

function resolveUrls(env = process.env) {
  const out = {};
  for (const [site, keys] of Object.entries(URL_VARS)) {
    out[site] = (first(env, keys) || STAGING_URLS[site]).replace(/\/+$/, "");
  }
  return out;
}

function isNonProdUrl(url) {
  try {
    return NON_PROD_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

function allowProdReadOnly(env = process.env) {
  return env.ALLOW_PROD_READONLY === "1" || env.ALLOW_PROD_READONLY === "true";
}

function isWriteSpec(file) {
  const base = path.basename(String(file));
  return WRITE_SPEC_PATTERNS.some((re) => re.test(base));
}

/**
 * @returns {{ ok: true, prod: boolean, urls: Record<string,string>, readOnlySpecs: string[] } | { ok: false, reason: string }}
 */
function checkTarget(env = process.env, readOnlySpecs = PRODUCTION_READ_ONLY_SPECS) {
  const urls = resolveUrls(env);
  const entries = Object.entries(urls);
  const nonProd = entries.filter(([, u]) => isNonProdUrl(u));
  if (nonProd.length === entries.length) return { ok: true, prod: false, urls, readOnlySpecs: [] };
  if (nonProd.length) {
    const live = entries.filter(([, u]) => !isNonProdUrl(u)).map(([s, u]) => `${s}=${u}`);
    return {
      ok: false,
      reason:
        `Refusing to run: Zuka URLs are on different environments (live: ${live.join(", ")}). ` +
        "Point every ZUKA_*_URL at staging (or every one at the live site with ALLOW_PROD_READONLY=1).",
    };
  }
  if (!allowProdReadOnly(env)) {
    return {
      ok: false,
      reason:
        `Refusing to run against the live Zuka sites (${urls.customer}). ` +
        `Point the ZUKA_*_URL vars at staging (default ${STAGING_URLS.customer}), ` +
        "or set ALLOW_PROD_READONLY=1 to run only the read-only specs.",
    };
  }
  const writes = readOnlySpecs.filter(isWriteSpec);
  if (writes.length) {
    return { ok: false, reason: `Write specs can never run against production: ${writes.join(", ")}.` };
  }
  return { ok: true, prod: true, urls, readOnlySpecs };
}

/** Chromium args that make the live Zuka hosts unresolvable on a non-prod run. */
function hostResolverArgs(target) {
  if (!target.ok || target.prod) return [];
  const rules = [
    "MAP zukaongo.com ~NOTFOUND",
    "MAP *.zukaongo.com ~NOTFOUND",
    "EXCLUDE staging.zukaongo.com",
    "EXCLUDE staging-*.zukaongo.com",
    "EXCLUDE dev.zukaongo.com",
    "EXCLUDE dev-*.zukaongo.com",
  ];
  return [`--host-resolver-rules=${rules.join(", ")}`];
}

/**
 * Node-side API calls (page.request) skip the browser block, so check each one:
 * a live API host only on a production read-only run, and then GET only.
 */
function assertApiAllowed(apiBase, method, env = process.env) {
  const target = checkTarget(env);
  if (!target.ok) throw new Error(`[zuka-api] ${target.reason}`);
  const live = !isNonProdUrl(apiBase);
  if (live && !target.prod) {
    throw new Error(`[zuka-api] Refusing ${method} ${apiBase}: live API on a staging run.`);
  }
  if (live && String(method).toUpperCase() !== "GET") {
    throw new Error(`[zuka-api] Refusing ${method} ${apiBase}: production runs are read-only.`);
  }
  return true;
}

module.exports = {
  STAGING_URLS,
  PRODUCTION_READ_ONLY_SPECS,
  resolveUrls,
  isNonProdUrl,
  isWriteSpec,
  checkTarget,
  hostResolverArgs,
  assertApiAllowed,
};
