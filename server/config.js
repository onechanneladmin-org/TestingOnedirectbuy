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
  /** Shared bearer token; when empty, auth is disabled (local/dev). */
  API_TOKEN: process.env.API_TOKEN || process.env.STATUS_API_TOKEN || "",
  /** Base URL the Playwright child uses to POST step updates. */
  STATUS_API_URL:
    process.env.STATUS_API_URL || `http://127.0.0.1:${PORT}`,
  /** Public DNS for Atlas SRV (comma-separated). */
  DNS_SERVERS: process.env.DNS_SERVERS || "8.8.8.8,8.8.4.4",
  /** Use-case Google Sheet (definitions). Keep the ID in .env only — this repo is public. */
  USECASE_SHEET_ID: String(process.env.USECASE_SHEET_ID || "").trim(),
  /** Comma list of name:gid, e.g. "Main:602444940,Backend:1823207124". */
  USECASE_SHEET_TABS: String(process.env.USECASE_SHEET_TABS || "").trim(),
  FLOWS_CONFIG: path.join(ROOT, "flows.config.json"),
  FLOW_STEPS_DATA: path.join(ROOT, "server", "data", "flow-steps.json"),
};
