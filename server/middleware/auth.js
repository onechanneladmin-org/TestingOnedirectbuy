const crypto = require("crypto");

/**
 * API token gate. Fails closed: when API_TOKEN is unset every request is
 * refused with 503 (except GET /api/health), and a missing or wrong token is
 * refused with 401. The token is read from `Authorization: Bearer <token>` or
 * `x-api-token` only — never from the query string, which leaks into logs,
 * browser history and Referer headers.
 */
const PUBLIC_PATHS = new Set(["/api/health"]);

function tokensMatch(given, expected) {
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function readToken(req) {
  const header = String(req.headers?.authorization || "");
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  const x = req.headers?.["x-api-token"];
  return typeof x === "string" ? x.trim() : "";
}

function isPublic(req) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const full = `${req.baseUrl || ""}${req.path || ""}`.replace(/\/+$/, "");
  return PUBLIC_PATHS.has(full);
}

/** @param {() => string} getApiToken */
function createRequireAuth(getApiToken) {
  return function requireAuth(req, res, next) {
    if (isPublic(req)) return next();

    const expected = String(getApiToken() || "");
    if (!expected) {
      return res
        .status(503)
        .json({ error: "API disabled: API_TOKEN is not configured" });
    }

    const token = readToken(req);
    if (!token || !tokensMatch(token, expected)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return next();
  };
}

const requireAuth = createRequireAuth(() => require("../config").API_TOKEN);

module.exports = { requireAuth, createRequireAuth };
