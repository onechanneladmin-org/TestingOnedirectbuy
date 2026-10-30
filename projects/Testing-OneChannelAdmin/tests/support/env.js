// E2E settings for the 1CA flow specs (tests/Onechanneladmin/flows). Ported from
// onechanneladmin-latest apps/web/e2e/support/env.js.
// Loads this project's .env, then the hub's .env (both gitignored), without overriding real env vars.
// Credentials come only from those files or CI secrets — never from code, never printed.
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const HUB_ROOT = path.resolve(PROJECT_ROOT, "..", "..");

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") process.env[key] = val;
  }
}

let loaded = false;
function loadE2eEnv() {
  if (loaded) return process.env;
  loadEnvFile(path.join(PROJECT_ROOT, ".env"));
  loadEnvFile(path.join(HUB_ROOT, ".env"));
  loaded = true;
  return process.env;
}

const DEFAULT_BASE_URL = "https://devadmin.onechanneladmin.com";

function e2eSettings(env = loadE2eEnv()) {
  const list = (v) =>
    String(v || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return {
    baseURL: (env.E2E_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    // Fall back to the generic login vars this project already configures
    // (same aliasing playwright.config.js does for BASE_URL/USERNAME/PASSWORD),
    // so a single set of credentials serves both the legacy specs and the
    // flow/UX suites — including runs spawned by the flow-control server,
    // which inherit only what is in .env.
    email: env.E2E_USER_EMAIL || env.TEST_LOGIN_EMAIL || "",
    password: env.E2E_USER_PASSWORD || env.TEST_LOGIN_PASSWORD || "",
    totp: env.E2E_USER_TOTP || "",
    totpSecret: env.E2E_USER_TOTP_SECRET || "",
    orgId: (env.E2E_ORG_ID || "").trim(),
    readOnly: env.E2E_READ_ONLY === "1",
    menuSuites: list(env.E2E_MENU_SUITES),
    orderId: env.E2E_ORDER_ID || "",
    // A1 "most-used pages" and A8 low-permission user.
    lowPermEmail: env.E2E_LOWPERM_EMAIL || "",
    lowPermPassword: env.E2E_LOWPERM_PASSWORD || "",
    lowPermTotpSecret: env.E2E_LOWPERM_TOTP_SECRET || "",
    // Write flows (A3–A7, E1): SKUs with bin stock in a WMS warehouse of the test org (guide § 7).
    testSkus: list(env.E2E_TEST_SKUS || "MSA_M34-020756M,MSA_M35-020756M"),
    warehouse: env.E2E_WAREHOUSE || "wh1",
    // Customer the write flows create D2C orders for (must belong to the test org).
    customer: env.E2E_TEST_CUSTOMER || "",
  };
}

const AUTH_DIR = path.join(PROJECT_ROOT, "playwright", ".auth");
const AUTH_FILE = path.join(AUTH_DIR, "e2e-user.json");
const LOWPERM_AUTH_FILE = path.join(AUTH_DIR, "e2e-lowperm.json");

module.exports = { loadE2eEnv, e2eSettings, AUTH_FILE, LOWPERM_AUTH_FILE, PROJECT_ROOT, DEFAULT_BASE_URL };
