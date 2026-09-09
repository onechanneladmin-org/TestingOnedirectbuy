/**
 * Shared MongoDB connect helpers.
 * Atlas mongodb+srv:// often fails when local DNS cannot resolve SRV —
 * force public DNS (8.8.8.8) + IPv4 before connecting.
 */
const dns = require("dns");

let dnsConfigured = false;

/**
 * Apply DNS servers for SRV lookups (MongoDB Atlas).
 * Default: Google Public DNS. Override with DNS_SERVERS=8.8.8.8,8.8.4.4
 */
function configureMongoDns() {
  if (dnsConfigured) return;
  const raw = String(
    process.env.DNS_SERVERS || process.env.MONGODB_DNS_SERVERS || "8.8.8.8,8.8.4.4",
  ).trim();
  const servers = raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s !== "0.0.0.0" && s !== "::");
  if (servers.length) {
    try {
      dns.setServers(servers);
      console.log(`[mongo] DNS servers: ${servers.join(", ")}`);
    } catch (err) {
      console.warn(
        `[mongo] dns.setServers failed:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  try {
    dns.setDefaultResultOrder("ipv4first");
  } catch {
    // Node < 16 may not have setDefaultResultOrder
  }
  dnsConfigured = true;
}

/**
 * Mongoose / MongoClient options tuned for Atlas + flaky DNS.
 */
function mongoConnectOptions() {
  const family = Number(process.env.MONGODB_FAMILY || 4);
  return {
    family: Number.isFinite(family) ? family : 4,
    serverSelectionTimeoutMS: Number(
      process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 30000,
    ),
    connectTimeoutMS: Number(process.env.MONGODB_CONNECT_TIMEOUT_MS || 30000),
    retryWrites: true,
  };
}

/**
 * Ensure URI has a database path.
 * @param {string} uri
 * @param {string} [dbName]
 */
function withDatabaseName(uri, dbName = "oneproducthub-tests") {
  const raw = String(uri || "").trim();
  if (!raw) return raw;
  const name = String(
    process.env.MONGODB_DB || dbName || "oneproducthub-tests",
  ).trim();
  try {
    const normalized = raw
      .replace("mongodb+srv://", "https://")
      .replace("mongodb://", "http://");
    const u = new URL(normalized);
    const pathDb = (u.pathname || "/").replace(/^\//, "").split("?")[0];
    if (pathDb) return raw;
    const scheme = raw.startsWith("mongodb+srv://")
      ? "mongodb+srv://"
      : "mongodb://";
    const rest = raw.replace(/^mongodb(\+srv)?:\/\//, "");
    if (rest.includes("?")) {
      return `${scheme}${rest.replace("?", `/${name}?`)}`;
    }
    const trimmed = rest.replace(/\/$/, "");
    return `${scheme}${trimmed}/${name}`;
  } catch {
    return raw;
  }
}

module.exports = {
  configureMongoDns,
  mongoConnectOptions,
  withDatabaseName,
};
