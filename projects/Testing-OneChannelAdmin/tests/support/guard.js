// Org + host guard for the admin UI E2E suite.
// MIRROR of Onedirectbuy qa-api/lib/test-guard.mjs — keep the org lists and host rules in sync.
// Pure (no Playwright imports) so it is unit-tested with node --test (guard.test.js).

/** Nexus_Truck_Upgrades — main paying client. Never a test target. */
const NEXUS_CLIENTNAME = "1p0248qcm3j1k401";
const DENIED_CLIENTNAMES = Object.freeze([NEXUS_CLIENTNAME]);

/** Demo / test orgs (1CA `clientname` = localStorage.currentorganization). */
const TEST_ORGS = Object.freeze({
  "3at1mrm65w3g": "onedirectbuy (onedirectbuyDB)",
  "2wi2r1mas0pi2b": "The_Paradise demo restaurant (The_ParadiseDB)",
  oneauto: "oneauto platform org (oneautoDB) — read-mostly",
});

const PROD_HOSTS = [
  "admin.onechanneladmin.com",
  "backend.onechanneladmin.com",
  "onechanneladmin.com",
  "www.onechanneladmin.com",
  "onedirectbuy.com",
  "www.onedirectbuy.com",
  "admin.onedirectbuy.com",
  "marketplace-core.onedirectbuy.com",
];
/** devadmin UI → dev.onechanneladmin.com backend (src/utils/Constants.js). */
const DEV_HOSTS = ["devadmin.onechanneladmin.com", "dev.onechanneladmin.com", "dev.onedirectbuy.com"];
const DEV_HOST_RE = /^(dev|staging|qa|test)[.-]/i;
const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$|\.test$/i;

/** Hosts whose requests carry org data: the guard inspects / blocks these (Firebase etc. pass through). */
const BACKEND_HOST_RE = /(^|\.)onechanneladmin\.com$|(^|\.)onedirectbuy\.com$|^localhost$|^127\.0\.0\.1$/i;
const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
/**
 * 1CA loads lists and details with POST (inventory/orders/allOrders, usergroup/getallusers …).
 * Read-only mode lets these named read endpoints through; anything else that is not GET is blocked
 * (modifyOrder, save*, create*, update*, delete* …).
 */
const READ_POST_PATH_RE = /\/(all[A-Z]\w*|get[A-Za-z]\w*|list\w*|search\w*|headers|filters?)\/?$/;

const list = (v) =>
  String(v || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

function hostOf(url) {
  try {
    return new URL(String(url)).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** POST to a named read endpoint (see READ_POST_PATH_RE). */
function isReadPost(url) {
  try {
    const u = new URL(String(url));
    // Grids load pages with POST <resource>?showcount=… (inventory/customer, inventory/wms/inventory, inventory/catalog).
    return READ_POST_PATH_RE.test(u.pathname) || u.searchParams.has("showcount");
  } catch {
    return false;
  }
}

/** 'local' | 'dev' | 'prod' | 'unknown'. Unknown is treated like prod. */
function classifyHost(url) {
  const host = hostOf(url);
  if (!host) return "unknown";
  if (LOCAL_HOST_RE.test(host)) return "local";
  if (DEV_HOSTS.includes(host) || DEV_HOST_RE.test(host)) return "dev";
  if (PROD_HOSTS.includes(host)) return "prod";
  return "unknown";
}

function allowedOrgs(env = {}) {
  const extra = list(env.E2E_EXTRA_TEST_ORGS).filter((c) => !DENIED_CLIENTNAMES.includes(c));
  return [...new Set([...Object.keys(TEST_ORGS), ...extra])];
}

function assertTestOrg(clientname, env = {}) {
  const c = String(clientname || "").trim();
  if (!c) throw new Error("Refusing to run: E2E_ORG_ID (test org clientname) is not set.");
  if (DENIED_CLIENTNAMES.includes(c)) {
    throw new Error(`Refusing to run: "${c}" is Nexus_Truck_Upgrades (production client) — never a test target.`);
  }
  const allowed = allowedOrgs(env);
  if (!allowed.includes(c)) {
    throw new Error(`Refusing to run: org "${c}" is not an allow-listed test org (${allowed.join(", ")}).`);
  }
  return c;
}

/**
 * The suite is "writable" (critical flows may create/edit data) only on local/dev hosts, or on
 * prod with E2E_ALLOW_PROD_WRITES=1, and never under E2E_READ_ONLY=1.
 */
function writesAllowed(baseURL, env = {}) {
  if (env.E2E_READ_ONLY === "1") return { ok: false, reason: "E2E_READ_ONLY=1" };
  const kind = classifyHost(baseURL);
  if ((kind === "prod" || kind === "unknown") && env.E2E_ALLOW_PROD_WRITES !== "1") {
    return { ok: false, reason: `${kind} host without E2E_ALLOW_PROD_WRITES=1` };
  }
  return { ok: true, reason: kind };
}

/**
 * Decision for one browser request (used by the network guard fixture):
 *   - any backend request whose clientname header is a denied org → block (always);
 *   - read-only mode → block non-GET/HEAD/OPTIONS to backend hosts.
 * Returns null to let the request through, or a reason string to abort it.
 */
function requestBlockReason({ url, method, headers = {} }, { readOnly = false } = {}) {
  const host = hostOf(url);
  if (!BACKEND_HOST_RE.test(host)) return null;
  const client = String(headers.clientname || headers.Clientname || "").trim();
  if (client && DENIED_CLIENTNAMES.includes(client)) return `request for denied org ${client}`;
  const m = String(method || "GET").toUpperCase();
  if (readOnly && m === "POST" && isReadPost(url)) return null;
  if (readOnly && !READ_METHODS.has(m)) {
    return `read-only: ${String(method).toUpperCase()} ${host}`;
  }
  return null;
}

/** Tag for anything a UI flow creates: qa-e2e-<runId>-<case>. */
function qaTag(runId, caseId) {
  const clean = (s) => String(s || "").replace(/[^A-Za-z0-9]/g, "").toLowerCase();
  return `qa-e2e-${clean(runId)}-${clean(caseId)}`;
}

function runIdNow(d = new Date()) {
  return d.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

module.exports = {
  NEXUS_CLIENTNAME,
  DENIED_CLIENTNAMES,
  TEST_ORGS,
  classifyHost,
  isReadPost,
  allowedOrgs,
  assertTestOrg,
  writesAllowed,
  requestBlockReason,
  qaTag,
  runIdNow,
};
