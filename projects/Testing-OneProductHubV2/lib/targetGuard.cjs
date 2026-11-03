/**
 * Target guard: keeps the OneProductHub suite off the live site by default.
 *
 * - Default target is local: UI http://localhost:3000, API http://localhost:4000.
 * - Any other host (oneproducthub.com, oneproducthub-backend.onechanneladmin.com, …)
 *   is refused unless ALLOW_PROD_READONLY=1. Then only PRODUCTION_READ_ONLY_SPECS run,
 *   and specs that write (create product, access requests, approve, settings, imports,
 *   password-reset emails) can never be allow-listed.
 * - The UI and the API are checked separately: a local or staging UI with the live API
 *   is refused (the API is called from Node through route.fetch, so the browser block
 *   below does not cover it).
 * - On a non-prod run the browser cannot resolve the live hosts (hostResolverArgs).
 */
const path = require("path");

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_API_URL = "http://localhost:4000";
const PROD_API_URL = "https://oneproducthub-backend.onechanneladmin.com";

const NON_PROD_HOST =
  /^(localhost|127\.0\.0\.1|\[::1\]|[a-z0-9-]+\.localhost|[a-z0-9.-]+\.test|(dev|staging|qa|test)(-[a-z0-9-]+)?\.[a-z0-9.-]+)$/i;

/** Read-only specs: pages, sign-in, navigation; no form submits. */
const PRODUCTION_READ_ONLY_SPECS = [
  "PublicMarketingPages.spec.js",
  "PublicPolicies.spec.js",
  "PublicPricingFaq.spec.js",
  "PublicHomeSearch.spec.js",
  "RoleSelection.spec.js",
  "LoginAdmin.spec.js",
  "LoginBrand.spec.js",
  "LoginClient.spec.js",
  "LoginInvalidCredentials.spec.js",
  "LoginWrongPortal.spec.js",
  "Logout.spec.js",
  "NavMatrixAdmin.spec.js",
  "NavMatrixBrand.spec.js",
  "NavMatrixClient.spec.js",
  "UnauthenticatedGuard.spec.js",
  "SessionPersistence.spec.js",
  "ForgotPassword.spec.js",
];

/** Specs that write or send something: never allowed against production. */
const WRITE_SPEC_PATTERNS = [
  /AddProduct\.spec/i,
  /ProductLifecycle/i,
  /SharedAccess/i,
  /RequestAccess/i,
  /BrandAccessFlow/i,
  /ApproveAccess/i,
  /CatalogAccessActions/i,
  /Submit/i,
  /Actions/i,
  /Mutations/i,
  /Import/i,
  /AIProductStudio/i,
  /Settings/i,
  /Team/i,
  /Subscription/i,
  /Drafts/i,
  /BookDemo/i,
  /StartFree/i,
  /^Signup(Brand|Client)/i,
];

const first = (env, keys) =>
  keys.map((k) => String(env[k] || "").trim()).find(Boolean) || "";

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

/** UI and API URLs, with the API defaulting to the one that matches the UI. */
function resolveUrls(env = process.env) {
  const baseUrl = (
    first(env, ["ONEPRODUCTHUB_BASE_URL", "ONEPRODUCTHUB_V2_BASE_URL", "BASE_URL", "PLAYWRIGHT_BASE_URL"]) ||
    DEFAULT_BASE_URL
  ).replace(/\/+$/, "");
  const apiUrl = (
    first(env, ["ONEPRODUCTHUB_API_BASE_URL"]) ||
    (isNonProdUrl(baseUrl) ? DEFAULT_API_URL : PROD_API_URL)
  ).replace(/\/+$/, "");
  return { baseUrl, apiUrl };
}

/**
 * Decide whether a run may start.
 * @returns {{ ok: true, prod: boolean, baseUrl: string, apiUrl: string, readOnlySpecs: string[] } | { ok: false, reason: string }}
 */
function checkTarget(env = process.env, readOnlySpecs = PRODUCTION_READ_ONLY_SPECS) {
  const { baseUrl, apiUrl } = resolveUrls(env);
  const uiNonProd = isNonProdUrl(baseUrl);
  const apiNonProd = isNonProdUrl(apiUrl);
  if (uiNonProd && apiNonProd) {
    return { ok: true, prod: false, baseUrl, apiUrl, readOnlySpecs: [] };
  }
  if (uiNonProd !== apiNonProd) {
    return {
      ok: false,
      reason:
        `Refusing to run: UI ${baseUrl} and API ${apiUrl} are on different environments. ` +
        "Point ONEPRODUCTHUB_BASE_URL and ONEPRODUCTHUB_API_BASE_URL at the same (local or staging) target.",
    };
  }
  if (!allowProdReadOnly(env)) {
    return {
      ok: false,
      reason:
        `Refusing to run against ${baseUrl}: not a staging, dev or local host. ` +
        `Point ONEPRODUCTHUB_BASE_URL at ${DEFAULT_BASE_URL} (API ${DEFAULT_API_URL}), ` +
        "or set ALLOW_PROD_READONLY=1 to run only the read-only specs.",
    };
  }
  const writes = readOnlySpecs.filter(isWriteSpec);
  if (writes.length) {
    return { ok: false, reason: `Write specs can never run against production: ${writes.join(", ")}.` };
  }
  return { ok: true, prod: true, baseUrl, apiUrl, readOnlySpecs };
}

/** Chromium args that make the live hosts unresolvable on a non-prod run. */
function hostResolverArgs(target) {
  if (!target.ok || target.prod) return [];
  const rules = [
    "MAP oneproducthub.com ~NOTFOUND",
    "MAP *.oneproducthub.com ~NOTFOUND",
    "MAP oneproducthub-backend.onechanneladmin.com ~NOTFOUND",
    "EXCLUDE staging-*.oneproducthub.com",
    "EXCLUDE staging.oneproducthub.com",
    "EXCLUDE dev-*.oneproducthub.com",
    "EXCLUDE dev.oneproducthub.com",
  ];
  return [`--host-resolver-rules=${rules.join(", ")}`];
}

module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_API_URL,
  PROD_API_URL,
  PRODUCTION_READ_ONLY_SPECS,
  resolveUrls,
  isNonProdUrl,
  isWriteSpec,
  checkTarget,
  hostResolverArgs,
};
