// Integration: sheet sync + results API + coverage summary against a real (in-memory) MongoDB.
//   node --test server/routes/usecases.integration.test.js
// Needs devDependencies (mongodb-memory-server downloads a mongod binary on first use). No network
// besides that download: the sheet fetch is faked.
process.env.API_TOKEN = "test-token";
process.env.USECASE_SHEET_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdef";
process.env.USECASE_SHEET_TABS = "Main_v2:1,1CA_Admin_Orders:2";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const MAIN_CSV = [
  "Use Case ID,Module,Actor,Use Case,Description,Priority,Automation,Current Onedirectbuy Status,Assigned To,Section,Expected Result,Layer,Flow",
  '"1. Buyer Registration",,,,,,,,,,,,',
  "ODB-UC-001,Buyer Account,Guest Buyer,Register,Creates account,P0,Yes,Working,,1. Buyer,Account created,Playwright flow,B0",
  "ODB-UC-002,Buyer Account,Guest Buyer,Duplicate,Blocks duplicate,P0,Yes,Working,,1. Buyer,,Playwright flow,B0",
  "ODB-UC-003,Legal,Buyer,Old page,Retired,P2,No,Not Required,,23. Legal,,N/A (not in scope),—",
].join("\n");
const CA_CSV = [
  "Use Case ID,Area,Actor,Use Case,Screen / Popup,Route,Trigger (UI label),Expected Result (DRAFT — confirm),Priority,Layer,Flow",
  "1CA-UC-011,Refund,Admin,Refund one line,Refund Order,/fulfill/x,Refund,Refund row appears,P0,Playwright flow + API check,A5",
].join("\n");

function fakeFetch(map) {
  return async (url) => {
    const gid = new URL(url).searchParams.get("gid");
    const body = map[gid];
    if (body == null) return { ok: false, status: 404, headers: { get: () => "text/html" }, text: async () => "" };
    return { ok: true, status: 200, headers: { get: () => "text/csv" }, text: async () => body };
  };
}

let mongod;
let server;
let base;
let store;
let UseCase;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("usecases-test"));
  store = require("../services/useCaseStore");
  UseCase = require("../models/UseCase");
  const { createApp } = require("../app");
  await new Promise((resolve) => {
    server = createApp().listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((r) => server.close(r));
  await mongoose.disconnect();
  await mongod.stop();
});

const auth = { Authorization: "Bearer test-token" };
const post = (path, body, headers = auth) =>
  fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
const getJson = async (path) => (await fetch(`${base}${path}`, { headers: auth })).json();

test("sync loads every configured tab; section rows skipped", async () => {
  const r = await store.syncFromSheet({ fetchImpl: fakeFetch({ 1: MAIN_CSV, 2: CA_CSV }) });
  assert.equal(r.synced, 4);
  assert.deepEqual(r.tabs, [{ name: "Main_v2", rows: 3 }, { name: "1CA_Admin_Orders", rows: 1 }]);
  const uc = await UseCase.findOne({ useCaseId: "1CA-UC-011" }).lean();
  assert.equal(uc.expectedResult, "Refund row appears");
  assert.equal(uc.flow, "A5");
  assert.equal(uc.inSheet, true);
});

test("results API needs the token", async () => {
  const res = await post("/api/usecases/results", { results: [] }, {});
  assert.equal(res.status, 401);
});

test("results from a Playwright report become per-ID latest result + history", async () => {
  const playwrightReport = {
    suites: [
      {
        file: "flows/b0.spec.js",
        specs: [
          { title: "ODB-UC-001 register", tests: [{ projectName: "chromium", status: "expected", results: [{ status: "passed" }] }] },
          {
            title: "A5 refund",
            tests: [
              {
                projectName: "e2e",
                status: "unexpected",
                results: [{ status: "failed", error: { message: "boom" }, annotations: [{ type: "usecase-result", description: JSON.stringify({ id: "1CA-UC-011", failed: true, note: "axe: label" }) }] }],
              },
            ],
          },
        ],
      },
    ],
  };
  const res = await post("/api/usecases/results", { source: "1ca-e2e", runId: "run-1", playwrightReport });
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { recorded: 2, runId: "run-1", received: 2 });

  const one = await getJson("/api/usecases/ODB-UC-001");
  assert.equal(one.lastResult.status, "passed");
  assert.equal(one.lastResult.source, "1ca-e2e");
  assert.equal(one.history.length, 1);
  const ca = await getJson("/api/usecases/1ca-uc-011");
  assert.equal(ca.lastResult.status, "failed");
  assert.equal(ca.lastResult.error, "axe: label");
});

test("a later run replaces lastResult and grows history; invalid statuses are ignored", async () => {
  const res = await post("/api/usecases/results", { results: [{ useCaseId: "ODB-UC-001", status: "failed", error: "regressed" }, { useCaseId: "ODB-UC-002", status: "weird" }] });
  assert.deepEqual((await res.json()).recorded, 1);
  const one = await getJson("/api/usecases/ODB-UC-001");
  assert.equal(one.lastResult.status, "failed");
  assert.deepEqual(one.history.map((h) => h.status), ["failed", "passed"]);
  const two = await getJson("/api/usecases/ODB-UC-002");
  assert.equal(two.lastResult, null);
});

test("flow-control runs record through the same path; unknown IDs are kept as run-only", async () => {
  await store.recordOccurrenceResults({
    occurrenceId: "occ-1",
    flowId: "flow:5",
    finishedAt: new Date(),
    steps: [
      { stepId: "ODB-UC-002-a", status: "passed" },
      { stepId: "ODB-UC-999", status: "skipped" },
      { stepId: "setup", status: "passed" },
    ],
  });
  const two = await getJson("/api/usecases/ODB-UC-002");
  assert.equal(two.lastResult.status, "passed");
  assert.equal(two.lastResult.flowId, "flow:5");
  const ghost = await UseCase.findOne({ useCaseId: "ODB-UC-999" }).lean();
  assert.equal(ghost.inSheet, false);
  assert.equal(ghost.lastResult.status, "skipped");
});

test("summary + CSV export", async () => {
  const s = await getJson("/api/usecases/summary");
  assert.equal(s.sheetConfigured, true);
  assert.equal(s.all.total, 4); // run-only ODB-UC-999 not counted
  assert.equal(s.notInSheet, 1);
  assert.equal(s.byPriority.P0.inScope, 3);
  assert.equal(s.byPriority.P0.withExpected, 2);
  assert.equal(s.byPriority.P0.failed, 2); // ODB-UC-001, 1CA-UC-011
  assert.equal(s.byPriority.P0.passed, 1); // ODB-UC-002
  assert.deepEqual(s.failing.map((f) => f.useCaseId).sort(), ["1CA-UC-011", "ODB-UC-001"]);
  assert.deepEqual(s.p0MissingExpected, ["ODB-UC-002"]);
  const csv = await (await fetch(`${base}/api/usecases/export.csv`, { headers: auth })).text();
  assert.match(csv.split("\n")[0], /^Use Case ID,Tab,Priority,Last Result/);
  assert.match(csv, /ODB-UC-001,Main_v2,P0,failed,/);
});

test("re-sync keeps results and retires IDs that left a tab that loaded; a failed tab retires nothing", async () => {
  const withoutTwo = MAIN_CSV.split("\n").filter((l) => !l.startsWith("ODB-UC-002")).join("\n");
  const r = await store.syncFromSheet({ fetchImpl: fakeFetch({ 1: withoutTwo }) }); // tab 2 fails
  assert.equal(r.retired, 1);
  assert.match(r.tabs[1].error, /HTTP 404/);
  const two = await UseCase.findOne({ useCaseId: "ODB-UC-002" }).lean();
  assert.equal(two.inSheet, false);
  assert.equal(two.lastResult.status, "passed"); // results survive
  const ca = await UseCase.findOne({ useCaseId: "1CA-UC-011" }).lean();
  assert.equal(ca.inSheet, true); // its tab failed to load, so it is not retired
  const one = await UseCase.findOne({ useCaseId: "ODB-UC-001" }).lean();
  assert.equal(one.lastResult.status, "failed");
});
