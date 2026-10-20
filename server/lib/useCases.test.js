// node --test server/lib/useCases.test.js — pure parts of the sheet sync + coverage (no DB, no network)
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("./sheetSync");
const R = require("./useCaseResults");

test("parseCsv: quotes, escaped quotes, newlines in quotes, CRLF", () => {
  const rows = S.parseCsv('a,b,c\r\n"x, y","he said ""hi""","line1\nline2"\nlast,,\n');
  assert.deepEqual(rows, [["a", "b", "c"], ["x, y", 'he said "hi"', "line1\nline2"], ["last", "", ""]]);
  assert.deepEqual(S.parseCsv(""), []);
});

test("mapTabRows: Main layout, section rows skipped, duplicates dropped", () => {
  const csv = [
    ["Use Case ID", "Module", "Actor", "Use Case", "Description", "Priority", "Automation", "Current Onedirectbuy Status", "Assigned To", "Expected Result", "Layer", "Flow"],
    ["1. Buyer Registration", "", "", "", "", "", "", "", "", "", "", ""],
    ["ODB-UC-001", "Buyer Account", "Guest Buyer", "Register", "Buyer creates account", "p0", "Yes", "Working", "", "Account created", "Playwright flow", "B0"],
    ["odb-uc-001", "dup", "", "", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", "", "", ""],
  ];
  const rows = S.mapTabRows("Main", csv);
  assert.equal(rows.length, 1);
  assert.deepEqual(
    { id: rows[0].useCaseId, tab: rows[0].tab, prio: rows[0].priority, exp: rows[0].expectedResult, layer: rows[0].layer, flow: rows[0].flow, status: rows[0].currentStatus },
    { id: "ODB-UC-001", tab: "Main", prio: "P0", exp: "Account created", layer: "Playwright flow", flow: "B0", status: "Working" },
  );
});

test("mapTabRows: Backend and 1CA tab layouts map to the same fields", () => {
  const be = S.mapTabRows("Backend", [
    ["Test Case ID", "Module", "API / Backend Area", "Test Scenario", "Preconditions", "Steps", "Expected Result", "Priority"],
    ["ODB-BE-ADV-001", "Authentication", "Token", "Refresh token", "valid token", "send request", "new token issued", "P0"],
  ]);
  assert.equal(be[0].useCaseId, "ODB-BE-ADV-001");
  assert.equal(be[0].title, "Refresh token");
  assert.equal(be[0].description, "send request");
  assert.equal(be[0].preconditions, "valid token");
  assert.equal(be[0].expectedResult, "new token issued");
  const ca = S.mapTabRows("1CA_Admin_Orders", [
    ["Use Case ID", "Area", "Actor", "Use Case", "Screen / Popup", "Route", "Trigger (UI label)", "Expected Result (DRAFT — confirm)", "Priority"],
    ["1CA-UC-011", "Refund", "Admin", "Refund one line", "Refund Order", "/fulfill/x", "Refund", "Refund row appears", "P0"],
  ]);
  assert.equal(ca[0].useCaseId, "1CA-UC-011");
  assert.equal(ca[0].module, "Refund");
  assert.equal(ca[0].screen, "Refund Order");
  assert.equal(ca[0].expectedResult, "Refund row appears");
});

test("parseTabs and csvExportUrl", () => {
  assert.deepEqual(S.parseTabs(" Main:602444940, Mobile App:1374608172 ,bad, x:abc"), [
    { name: "Main", gid: "602444940" },
    { name: "Mobile App", gid: "1374608172" },
  ]);
  assert.match(S.csvExportUrl("1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdef", "602444940"), /\/export\?format=csv&gid=602444940$/);
  assert.throws(() => S.csvExportUrl("../evil", "1"), /not a valid spreadsheet ID/);
});

test("fetchSheetRows: per-tab errors are reported, other tabs still load", async () => {
  const csv = "Use Case ID,Use Case,Priority\nODB-UC-002,Dup check,P0\n";
  const fake = async (url) =>
    url.includes("gid=1")
      ? { ok: true, status: 200, headers: { get: () => "text/csv" }, text: async () => csv }
      : { ok: true, status: 200, headers: { get: () => "text/html" }, text: async () => "<html>login</html>" };
  const r = await S.fetchSheetRows({ sheetId: "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdef", tabs: [{ name: "Main", gid: "1" }, { name: "CRM", gid: "2" }] }, fake);
  assert.equal(r.rows.length, 1);
  assert.deepEqual(r.tabs[0], { name: "Main", rows: 1 });
  assert.match(r.tabs[1].error, /not shared by link/);
});

test("baseUseCaseId / resultsByUseCase: sub-steps fold into the use case, any failure wins", () => {
  assert.equal(R.baseUseCaseId("ODB-UC-005-b"), "ODB-UC-005");
  assert.equal(R.baseUseCaseId("1ca-uc-011:retry"), "1CA-UC-011");
  assert.equal(R.baseUseCaseId("login"), null);
  const by = R.resultsByUseCase([
    { stepId: "ODB-UC-005-a", status: "passed" },
    { stepId: "ODB-UC-005-b", status: "failed", error: "button missing" },
    { stepId: "ODB-UC-006", status: "skipped" },
    { stepId: "ODB-UC-007", status: "running" },
    { stepId: "setup", status: "passed" },
  ]);
  assert.deepEqual([...by.keys()], ["ODB-UC-005", "ODB-UC-006"]);
  assert.equal(by.get("ODB-UC-005").status, "failed");
  assert.equal(by.get("ODB-UC-005").error, "button missing");
  assert.deepEqual(by.get("ODB-UC-005").stepIds, ["ODB-UC-005-a", "ODB-UC-005-b"]);
});

test("summarize: priority buckets, scope, coverage, failing list", () => {
  const ucs = [
    { useCaseId: "ODB-UC-1", priority: "P0", layer: "Playwright flow", expectedResult: "x", lastResult: { status: "passed" }, flow: "B2", tab: "Main" },
    { useCaseId: "ODB-UC-2", priority: "P0", layer: "API", lastResult: { status: "failed", error: "500" }, tab: "Main" },
    { useCaseId: "ODB-UC-3", priority: "P0", layer: "N/A (not in scope)", tab: "Main" },
    { useCaseId: "ODB-UC-4", priority: "P1", currentStatus: "Not Required", tab: "Main" },
    { useCaseId: "1CA-UC-1", priority: "P1", layer: "Playwright flow", flow: "A5", tab: "1CA_Admin_Orders" },
    { useCaseId: "X-UC-9", priority: "", tab: "" },
  ];
  const s = R.summarize(ucs);
  assert.deepEqual(
    { total: s.byPriority.P0.total, inScope: s.byPriority.P0.inScope, exp: s.byPriority.P0.withExpected, pass: s.byPriority.P0.passed, fail: s.byPriority.P0.failed },
    { total: 3, inScope: 2, exp: 1, pass: 1, fail: 1 },
  );
  assert.equal(s.byPriority.P1.inScope, 1);
  assert.equal(s.byPriority["—"].total, 1);
  assert.equal(s.all.total, 6);
  assert.equal(s.all.notRun, 2);
  assert.equal(s.coverage.p0ExpectedPct, 50);
  assert.equal(s.coverage.p0PassedPct, 50);
  assert.deepEqual(s.failing.map((f) => f.useCaseId), ["ODB-UC-2"]);
  assert.deepEqual(s.p0MissingExpected, ["ODB-UC-2"]);
  assert.equal(s.byFlow.B2, 1);
  assert.equal(s.byTab["(run only)"], 1);
});

test("resultsCsv: header, not-run rows, quoting", () => {
  const csv = R.resultsCsv([
    { useCaseId: "ODB-UC-1", tab: "Main", priority: "P0", lastResult: { status: "failed", at: "2026-10-20T01:02:03Z", occurrenceId: "o1", flowId: "flow:5", error: 'bad "total", 0' } },
    { useCaseId: "ODB-UC-2", tab: "Main", priority: "P1" },
  ]);
  const lines = csv.trim().split("\n");
  assert.equal(lines[0], "Use Case ID,Tab,Priority,Last Result,Last Run At,Flow Run,Flow,Error");
  assert.equal(lines[1], 'ODB-UC-1,Main,P0,failed,2026-10-20T01:02:03.000Z,o1,flow:5,"bad ""total"", 0"');
  assert.equal(lines[2], "ODB-UC-2,Main,P1,not run,,,,");
});
