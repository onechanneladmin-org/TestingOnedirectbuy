// API read-back for the 1CA flows (guide § 2.3 / § 6.4): after a money, stock or status step the spec
// reads the record back from the 1CA backend with the SAME auth the app uses, so a screen that looks
// right but saved the wrong numbers fails.
//
// The client copies the auth headers (authorization / token / clientname) from the app's own backend
// calls, so it never handles credentials itself. Every request goes through the page's
// APIRequestContext, which the netGuard fixture does NOT see — so this client applies the same guard
// itself: GET or a named read POST only, and never for a denied org.
const G = require("./guard");

// Only the 1CA inventory/marketplace backend (backend.onechanneladmin.com, dev.onechanneladmin.com, localhost:3004);
// other *.onechanneladmin.com services (aichatbackend …) also send a Bearer token and must not become the base.
const BACKEND_RE = /^https?:\/\/([^/]*(onechanneladmin|onedirectbuy)\.com|localhost:3004)\/(inventory|marketplace)\//i;
const AUTH_HEADERS = ["authorization", "token", "x-access-token", "clientname", "organization", "orgid"];

function trackBackend(page) {
  const state = { base: "", headers: {} };
  page.on("request", (req) => {
    const url = req.url();
    if (!BACKEND_RE.test(url) || /\/\/(dev)?admin\./i.test(url)) return;
    const h = req.headers();
    if (!h.authorization && !h.token && !h["x-access-token"]) return;
    state.base = new URL(url).origin;
    for (const k of AUTH_HEADERS) if (h[k]) state.headers[k] = h[k];
  });

  async function ready(timeout = 30_000) {
    const until = Date.now() + timeout;
    while (!state.base && Date.now() < until) {
      // Wait for the app to make any authenticated backend call (the shell polls on every page).
      await page.waitForRequest((r) => BACKEND_RE.test(r.url()), { timeout: 5_000 }).catch(() => {});
    }
    if (!state.base) throw new Error("No authenticated 1CA backend call seen yet — open an app page first.");
    const client = state.headers.clientname;
    if (client && G.DENIED_CLIENTNAMES.includes(client)) throw new Error(`Refusing API read for denied org ${client}`);
    return state;
  }

  /** GET <backend><path>; returns { status, json, text }. */
  async function get(pathOrUrl, { params } = {}) {
    const s = await ready();
    const url = new URL(pathOrUrl, s.base);
    for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, String(v));
    const res = await page.request.get(url.toString(), { headers: s.headers, failOnStatusCode: false });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // non-JSON body: keep text
    }
    return { status: res.status(), json, text };
  }

  /** POST to a named READ endpoint only (guard.isReadPost: allOrders, getallusers …). */
  async function readPost(pathOrUrl, body = {}) {
    const s = await ready();
    const url = new URL(pathOrUrl, s.base).toString();
    if (!G.isReadPost(url)) throw new Error(`readPost refuses a non-read endpoint: ${url.split("?")[0]}`);
    const res = await page.request.post(url, { headers: s.headers, data: body, failOnStatusCode: false });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // non-JSON body: keep text
    }
    return { status: res.status(), json, text };
  }

  /**
   * Arrange / cleanup writes only (creating the flow's own tagged order, cancelling it afterwards).
   * Refused unless writes are allowed (guard.writesAllowed) and the session org is an allow-listed test org.
   */
  async function write(pathOrUrl, body) {
    const s = await ready();
    const allowed = G.writesAllowed(page.url(), process.env);
    if (!allowed.ok) throw new Error(`API write refused: ${allowed.reason}`);
    G.assertTestOrg(s.headers.clientname, process.env);
    const res = await page.request.post(new URL(pathOrUrl, s.base).toString(), { headers: s.headers, data: body, failOnStatusCode: false });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // non-JSON body: keep text
    }
    return { status: res.status(), json, text };
  }

  /** One order as the details screen loads it: POST inventory/orders/allOrders?orderId=<id> → data[0]. */
  async function readOrder(orderId) {
    const res = await readPost(`/inventory/orders/allOrders?orderId=${encodeURIComponent(orderId)}`, {});
    if (res.status >= 400) throw new Error(`readOrder ${orderId}: HTTP ${res.status} ${res.text.slice(0, 200)}`);
    const rows = (res.json && res.json.data) || [];
    return rows[0] || null;
  }

  /** Orders list page (same call as the list screen; pages start at 1 here, 0 on the wire); searchText narrows it. */
  async function listOrders({ searchText = "", page: p = 1, limit = 25 } = {}) {
    const q = searchText ? `?searchText=${encodeURIComponent(searchText)}` : "?";
    const res = await readPost(`/inventory/orders/allOrders${q}`, { page: p - 1, limit, dateType: null, filters: [], manualFilters: [], or_Condition: [] });
    return { rows: (res.json && res.json.data) || [], total: (res.json && res.json.totalcount) || 0, status: res.status };
  }

  /**
   * Wait for the app itself to load a backend URL and return its JSON. Used when the endpoint is
   * easier to observe than to rebuild (e.g. the order-details payload the screen renders).
   */
  async function captureJson(urlPart, action, { timeout = 30_000 } = {}) {
    const matcher = (r) => r.url().includes(urlPart) && r.status() < 400;
    const [res] = await Promise.all([page.waitForResponse(matcher, { timeout }), action()]);
    return res.json().catch(() => null);
  }

  return { state, ready, get, readPost, write, readOrder, listOrders, captureJson };
}

/** Poll a read until `check(value)` is truthy (sync between systems takes time; guide § 2.3). */
async function pollUntil(read, check, { timeout = 60_000, interval = 3_000, message = "condition" } = {}) {
  const { expect } = require("@playwright/test");
  let last;
  await expect
    .poll(
      async () => {
        last = await read();
        return Boolean(check(last));
      },
      { timeout, intervals: [interval], message }
    )
    .toBe(true);
  return last;
}

module.exports = { trackBackend, pollUntil };
