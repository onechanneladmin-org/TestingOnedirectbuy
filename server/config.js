/**
 * Server configuration from environment.
 */
const path = require("path");

function loadDotenv() {
  try {
    require("dotenv").config({
      path: path.resolve(__dirname, "..", ".env"),
    });
  } catch {
    // optional
  }
}

loadDotenv();

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || process.env.SERVER_PORT || 3847);
/** Bind address — 0.0.0.0 accepts LAN/remote clients; use 127.0.0.1 for local-only. */
const HOST = String(
  process.env.HOST || process.env.SERVER_HOST || "0.0.0.0",
).trim();

module.exports = {
  ROOT,
  PORT,
  HOST,
  MONGODB_URI:
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/onedirectbuy-tests",
  MONGODB_DB: process.env.MONGODB_DB || "onedirectbuy-tests",
  /** Shared bearer token; when empty the /api routes refuse every request (503). */
  API_TOKEN: process.env.API_TOKEN || process.env.STATUS_API_TOKEN || "",
  /** Origins allowed to call the API cross-origin (comma-separated). Empty = same-origin only. */
  CORS_ORIGINS: String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean),
  /** Base URL the Playwright child uses to POST step updates. */
  STATUS_API_URL:
    process.env.STATUS_API_URL || `http://127.0.0.1:${PORT}`,
  /** Public DNS for Atlas SRV (comma-separated). */
  DNS_SERVERS: process.env.DNS_SERVERS || "8.8.8.8,8.8.4.4",
  FLOWS_CONFIG: path.join(ROOT, "flows.config.json"),
  FLOW_STEPS_DATA: path.join(ROOT, "server", "data", "flow-steps.json"),
};
