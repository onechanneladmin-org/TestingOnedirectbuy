/**
 * Call the ZUKAongo API with the signed-in user's own Firebase session.
 *
 * The apps send `Authorization: Bearer <Firebase ID token>` to `<origin>/api/...`.
 * We record the header from the app's own traffic, so API checks run as exactly
 * the same user the UI is signed in as (used for server-side rules the UI hides:
 * 402 unpaid, 403 scope, 409 final status — doc §2).
 */

const SESSION_KEY = Symbol.for("zukaApiSession");

/**
 * Start recording the auth header. Call before signIn().
 * @param {import('@playwright/test').Page} page
 */
export function trackApiSession(page) {
  if (page[SESSION_KEY]) return page[SESSION_KEY];
  const session = { base: "", authorization: "" };
  page.on("request", (req) => {
    const url = req.url();
    const idx = url.indexOf("/api/");
    if (idx === -1) return;
    const auth = req.headers().authorization;
    if (!auth || !/^Bearer\s+\S{20,}/.test(auth)) return;
    session.base = url.slice(0, idx + 4);
    session.authorization = auth;
  });
  page[SESSION_KEY] = session;
  return session;
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeoutMs]
 */
export async function apiSession(page, timeoutMs = 20_000) {
  const session = page[SESSION_KEY];
  if (!session) throw new Error("trackApiSession(page) was not called before sign-in");
  const until = Date.now() + timeoutMs;
  while (!session.authorization && Date.now() < until) {
    await page.waitForTimeout(250);
  }
  if (!session.authorization) {
    throw new Error("[AUTH] No authenticated /api/ request seen — is the user signed in?");
  }
  return session;
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} method
 * @param {string} path e.g. "/orders" or "/admin/orders/ZMV.../accept"
 * @param {unknown} [body]
 * @returns {Promise<{ status: number; ok: boolean; json: any; text: string }>}
 */
export async function api(page, method, path, body) {
  const session = await apiSession(page);
  const res = await page.request.fetch(`${session.base}${path}`, {
    method,
    headers: {
      authorization: session.authorization,
      "content-type": "application/json",
    },
    data: body === undefined ? undefined : JSON.stringify(body),
    failOnStatusCode: false,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status(), ok: res.ok(), json, text: text.slice(0, 500) };
}

/** Order ids are "#ZMV…" everywhere (UI and API `id`). Returns "" when none found. */
export function orderIdFromLabel(label) {
  const m = String(label || "").match(/#?(ZMV[A-Z0-9]{6,})/i);
  return m ? `#${m[1].toUpperCase()}` : "";
}

/** URL segment for an order id ("#ZMV…" → "%23ZMV…"), as the apps encode it. */
export function orderSegment(id) {
  return encodeURIComponent(id.startsWith("#") ? id : `#${id}`);
}

/**
 * Normalize list responses ({ orders: [...] } | [...]).
 * @param {any} json
 * @param {string} key
 */
export function listFrom(json, key) {
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json[key])) return json[key];
  if (json && Array.isArray(json.items)) return json.items;
  if (json && Array.isArray(json.data)) return json.data;
  return [];
}
