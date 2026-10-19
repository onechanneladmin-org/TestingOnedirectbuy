/**
 * Express + MongoDB flow control plane.
 *
 * Usage:
 *   npm run server
 *   npm run server:seed
 */
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

async function main() {
  const seedOnly = process.argv.includes("--seed");

  configureMongoDns();
  const uri = withDatabaseName(MONGODB_URI);
  const options = mongoConnectOptions();

  console.log(
    `[server] Connecting to MongoDB: ${uri.replace(/:\/\/.*@/, "://***@")}`,
  );
  console.log(
    `[server] Mongo options family=${options.family} listen=${HOST}:${PORT}`,
  );
  await mongoose.connect(uri, options);
  console.log("[server] MongoDB connected");

  const { upserted } = await seedFlows();
  console.log(`[server] Seeded/upserted ${upserted} flow(s)`);

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
