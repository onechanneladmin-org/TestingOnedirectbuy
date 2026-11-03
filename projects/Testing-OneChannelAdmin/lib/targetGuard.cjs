/**
 * Target guard: keeps the 1CA suite off the live admin.
 *
 * - Default target is staging (https://staging-admin.onechanneladmin.com).
 * - A run against any other host (admin.onechanneladmin.com, …) is refused
 *   unless ALLOW_PROD_READONLY=1. Then only PRODUCTION_READ_ONLY_SPECS run, and
 *   specs that write (order, fulfil, catalog, CRM create/update) never do.
 * - On a non-prod run the browser cannot resolve live 1CA hosts at all
 *   (hostResolverArgs), so a hard-coded live URL in a spec fails instead of
 *   reaching production.
 */
const path = require("path");

const DEFAULT_BASE_URL = "https://staging-admin.onechanneladmin.com";
const DEFAULT_API_URL = "https://staging-api.onechanneladmin.com";

const NON_PROD_HOST =
  /^(localhost|127\.0\.0\.1|\[::1\]|[a-z0-9-]+\.localhost|[a-z0-9.-]+\.test|(dev|devadmin|staging|qa|test)(-[a-z0-9-]+)?\.[a-z0-9.-]+)$/i;

/** Specs allowed against production with ALLOW_PROD_READONLY=1 (sign-in only). */
const PRODUCTION_READ_ONLY_SPECS = ["login.spec.js"];

/** Specs that click Save/Update/Complete/Create: never allowed against production. */
const WRITE_SPEC_PATTERNS = [
  /^Nexus/i,
  /^Complete/i,
  /^Fulfillment/i,
  /^Rentals/i,
  /^add-?product/i,
  /^addcontact/i,
  /^catalog/i,
  /^Catalog/i,
  /^crm-account/i,
  /^emai?lmarketing/i,
];

function resolveBaseUrl(env = process.env) {
  for (const key of ["PLAYWRIGHT_BASE_URL", "BASE_URL"]) {
    const v = String(env[key] || "").trim();
    if (v) return v.replace(/\/+$/, "");
  }
  return DEFAULT_BASE_URL;
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
 * Decide whether a run may start.
 * @returns {{ ok: true, prod: boolean, baseUrl: string, readOnlySpecs: string[] } | { ok: false, reason: string }}
 */
function checkTarget(env = process.env, readOnlySpecs = PRODUCTION_READ_ONLY_SPECS) {
  const baseUrl = resolveBaseUrl(env);
  if (isNonProdUrl(baseUrl)) {
    return { ok: true, prod: false, baseUrl, readOnlySpecs: [] };
  }
  if (!allowProdReadOnly(env)) {
    return {
      ok: false,
      reason:
        `Refusing to run against ${baseUrl}: not a staging, dev or local host. ` +
        `Point PLAYWRIGHT_BASE_URL at ${DEFAULT_BASE_URL}, ` +
        `or set ALLOW_PROD_READONLY=1 to run only: ${readOnlySpecs.join(", ")}.`,
    };
  }
  const writes = readOnlySpecs.filter(isWriteSpec);
  if (writes.length) {
    return {
      ok: false,
      reason: `Write specs can never run against production: ${writes.join(", ")}.`,
    };
  }
  return { ok: true, prod: true, baseUrl, readOnlySpecs };
}

/**
 * Chromium args that make live *.onechanneladmin.com hosts unresolvable,
 * except the staging/dev hosts. Empty on a production read-only run.
 */
function hostResolverArgs(target) {
  if (!target.ok || target.prod) return [];
  const rules = [
    "MAP onechanneladmin.com ~NOTFOUND",
    "MAP *.onechanneladmin.com ~NOTFOUND",
    "EXCLUDE staging-*.onechanneladmin.com",
    "EXCLUDE staging.onechanneladmin.com",
    "EXCLUDE dev-*.onechanneladmin.com",
    "EXCLUDE dev.onechanneladmin.com",
    "EXCLUDE devadmin.onechanneladmin.com",
  ];
  return [`--host-resolver-rules=${rules.join(", ")}`];
}


module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_API_URL,
  PRODUCTION_READ_ONLY_SPECS,
  resolveBaseUrl,
  isNonProdUrl,
  isWriteSpec,
  checkTarget,
  hostResolverArgs,
};
