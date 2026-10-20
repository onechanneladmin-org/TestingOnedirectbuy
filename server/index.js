/**
 * Express + MongoDB flow control plane.
 *
 * Usage:
 *   npm run server
 *   npm run server:seed
 *
 * When local Mongo is unreachable, falls back to mongodb-memory-server
 * with a disk-backed dbPath so recent runs survive process restarts.
 */
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { createApp } = require("./app");
const { PORT, HOST, MONGODB_URI, STATUS_API_URL } = require("./config");
const { seedFlows } = require("./services/seedFlows");
const { syncFromSheet, sheetConfigured } = require("./services/useCaseStore");
const {
  configureMongoDns,
  mongoConnectOptions,
  withDatabaseName,
} = require("../lib/mongoConnect");
const {
  restoreOccurrenceArchives,
  pruneOccurrenceRetention,
} = require("./lib/occurrenceArchive");
const RunningOccurrence = require("./models/RunningOccurrence");
const Report = require("./models/Report");

let memoryServer = null;

const MEMORY_DB_PATH = path.join(__dirname, "data", "mongo-memory");

async function startPersistentMemoryMongo() {
  const { MongoMemoryServer } = require("mongodb-memory-server");
  fs.mkdirSync(MEMORY_DB_PATH, { recursive: true });
  // Stale lock from a killed process blocks reuse of the on-disk WiredTiger files.
  const lockFile = path.join(MEMORY_DB_PATH, "WiredTiger.lock");
  if (fs.existsSync(lockFile)) {
    try {
      fs.unlinkSync(lockFile);
      console.warn("[server] Removed stale WiredTiger.lock for memory Mongo reuse");
    } catch (err) {
      console.warn(
        "[server] Could not remove WiredTiger.lock:",
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  memoryServer = await MongoMemoryServer.create({
    instance: {
      dbName: process.env.MONGODB_DB || "onedirectbuy-tests",
      dbPath: MEMORY_DB_PATH,
      storageEngine: "wiredTiger",
    },
  });
  const memUri = memoryServer.getUri();
  console.log(
    `[server] Using disk-backed mongodb-memory-server at ${MEMORY_DB_PATH}`,
  );
  await mongoose.connect(memUri, mongoConnectOptions());
  process.env.MONGODB_URI = memUri;
  return memUri;
}

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
        "[server] Local Mongo unavailable, starting disk-backed memory MongoDB:",
        err instanceof Error ? err.message : String(err),
      );
      try {
        await mongoose.disconnect();
      } catch {
        // ignore
      }
    }
  }

  return startPersistentMemoryMongo();
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

  try {
    const { restored, skipped } = await restoreOccurrenceArchives(RunningOccurrence);
    if (restored || skipped) {
      console.log(
        `[server] Restored ${restored} archived run(s) (${skipped} already present)`,
      );
    }
  } catch (err) {
    console.warn(
      "[server] Occurrence archive restore failed:",
      err instanceof Error ? err.message : String(err),
    );
  }

  try {
    const pruned = await pruneOccurrenceRetention(RunningOccurrence, Report);
    if (pruned.deleted) {
      console.log(
        `[server] Pruned ${pruned.deleted} old run(s); keeping last ${pruned.keep} per project (+ running)`,
      );
    }
  } catch (err) {
    console.warn(
      "[server] Occurrence retention prune failed:",
      err instanceof Error ? err.message : String(err),
    );
  }

  if (sheetConfigured()) {
    try {
      const s = await syncFromSheet();
      console.log(`[server] Use-case sheet synced: ${s.synced} rows (${s.tabs.map((t) => `${t.name}=${t.error ? `ERROR ${t.error}` : t.rows}`).join(", ")})`);
    } catch (err) {
      console.warn("[server] Use-case sheet sync failed (dashboard keeps the last copy):", err.message);
    }
  } else {
    console.log("[server] Use-case sheet not configured (USECASE_SHEET_ID / USECASE_SHEET_TABS) — coverage shows run results only");
  }

  if (seedOnly) {
    await mongoose.disconnect();
    if (memoryServer) await memoryServer.stop({ doCleanup: false });
    console.log("[server] Seed complete");
    return;
  }

  const shutdown = async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
    if (memoryServer) {
      try {
        await memoryServer.stop({ doCleanup: false });
      } catch {
        // ignore
      }
    }
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const app = createApp();
  app.listen(PORT, HOST, () => {
    console.log(`[server] Flow control UI  http://127.0.0.1:${PORT}/`);
    console.log(
      `[server] Listening on     http://${HOST}:${PORT}/ (0.0.0.0 = all interfaces)`,
    );
    console.log(`[server] API health       http://127.0.0.1:${PORT}/health`);
    console.log(`[server] STATUS_API_URL   ${STATUS_API_URL}`);
    console.log(`[server] GET  /api/projects`);
    console.log(`[server] GET  /api/flows?projectId=`);
    console.log(`[server] Coverage UI      http://127.0.0.1:${PORT}/coverage`);
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
