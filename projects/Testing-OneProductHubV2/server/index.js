/**
 * Express + MongoDB flow control plane.
 *
 * Usage:
 *   npm run server
 *   npm run server:seed
 *
 * When MONGODB_URI is unset or local Mongo is unreachable, falls back to
 * mongodb-memory-server so the UI works out of the box.
 */
const mongoose = require("mongoose");
const { createApp } = require("./app");
const { PORT, HOST, MONGODB_URI, STATUS_API_URL } = require("./config");
const { seedFlows } = require("./services/seedFlows");
const {
  configureMongoDns,
  mongoConnectOptions,
  withDatabaseName,
} = require("../lib/mongoConnect");

let memoryServer = null;

async function resolveMongoUri() {
  const configured = String(MONGODB_URI || "").trim();
  const preferMemory =
    process.env.MONGODB_MEMORY === "1" ||
    process.env.MONGODB_MEMORY === "true" ||
    !configured ||
    /127\.0\.0\.1|localhost/i.test(configured);

  if (!preferMemory) {
    return withDatabaseName(configured);
  }

  // Try configured local URI first; on failure start in-memory
  if (configured) {
    try {
      const uri = withDatabaseName(configured);
      const options = {
        ...mongoConnectOptions(),
        serverSelectionTimeoutMS: 3000,
      };
      await mongoose.connect(uri, options);
      console.log("[server] Connected to local MongoDB");
      return uri;
    } catch (err) {
      console.warn(
        "[server] Local Mongo unavailable, starting in-memory MongoDB:",
        err instanceof Error ? err.message : String(err),
      );
      try {
        await mongoose.disconnect();
      } catch {
        // ignore
      }
    }
  }

  const { MongoMemoryServer } = require("mongodb-memory-server");
  memoryServer = await MongoMemoryServer.create({
    instance: { dbName: process.env.MONGODB_DB || "oneproducthub-tests" },
  });
  const memUri = memoryServer.getUri();
  console.log("[server] Using mongodb-memory-server");
  await mongoose.connect(memUri, mongoConnectOptions());
  process.env.MONGODB_URI = memUri;
  return memUri;
}

async function main() {
  const seedOnly = process.argv.includes("--seed");

  configureMongoDns();
  const uri = await resolveMongoUri();
  if (!mongoose.connection.readyState) {
    await mongoose.connect(uri, mongoConnectOptions());
  }

  console.log(
    `[server] MongoDB ready: ${String(uri).replace(/:\/\/.*@/, "://***@")}`,
  );
  console.log(`[server] Listening target ${HOST}:${PORT}`);

  const { upserted } = await seedFlows();
  console.log(`[server] Seeded/upserted ${upserted} flow(s)`);

  if (seedOnly) {
    await mongoose.disconnect();
    if (memoryServer) await memoryServer.stop();
    console.log("[server] Seed complete");
    return;
  }

  const app = createApp();
  app.listen(PORT, HOST, () => {
    console.log(`[server] Flow control UI  http://127.0.0.1:${PORT}/`);
    console.log(
      `[server] Listening on     http://${HOST}:${PORT}/ (0.0.0.0 = all interfaces)`,
    );
    console.log(`[server] API health       http://127.0.0.1:${PORT}/health`);
    console.log(`[server] STATUS_API_URL   ${STATUS_API_URL}`);
    console.log(`[server] GET  /api/flows`);
    console.log(`[server] POST /api/flows/:flowId/run`);
    console.log(`[server] GET  /api/occurrences/:occurrenceId`);
    console.log(`[server] GET  /api/occurrences/:occurrenceId/report`);
  });
}

main().catch((err) => {
  console.error("[server] Fatal:", err);
  process.exit(1);
});
