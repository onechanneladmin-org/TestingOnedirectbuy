// Unit tests for the pure E2E helpers (no browser): node --test tests/support/support.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("./guard");
const { totpNow, hotp } = require("./totp");
const M = require("./menu");
const H = require("./page-health");

test("guard: Nexus is never a test org, even via E2E_EXTRA_TEST_ORGS", () => {
  const env = { E2E_EXTRA_TEST_ORGS: `${G.NEXUS_CLIENTNAME},demo1` };
  assert.throws(() => G.assertTestOrg(G.NEXUS_CLIENTNAME, env), /Nexus_Truck_Upgrades/);
  assert.equal(G.assertTestOrg("demo1", env), "demo1");
  assert.equal(G.assertTestOrg("3at1mrm65w3g"), "3at1mrm65w3g");
  assert.throws(() => G.assertTestOrg("random"), /not an allow-listed/);
  assert.throws(() => G.assertTestOrg(""), /E2E_ORG_ID/);
});

test("guard: host classes and write permission", () => {
  assert.equal(G.classifyHost("https://devadmin.onechanneladmin.com"), "dev");
  assert.equal(G.classifyHost("https://admin.onechanneladmin.com"), "prod");
  assert.equal(G.classifyHost("http://localhost:3000"), "local");
  assert.equal(G.classifyHost("https://elsewhere.example"), "unknown");
  assert.equal(G.writesAllowed("https://devadmin.onechanneladmin.com").ok, true);
  assert.equal(G.writesAllowed("https://admin.onechanneladmin.com").ok, false);
  assert.equal(G.writesAllowed("https://admin.onechanneladmin.com", { E2E_ALLOW_PROD_WRITES: "1" }).ok, true);
  assert.equal(G.writesAllowed("http://localhost:3000", { E2E_READ_ONLY: "1" }).ok, false);
});

test("guard: request blocking", () => {
  const be = "https://backend.onechanneladmin.com/inventory/x";
  assert.match(G.requestBlockReason({ url: be, method: "GET", headers: { clientname: G.NEXUS_CLIENTNAME } }), /denied org/);
  assert.equal(G.requestBlockReason({ url: be, method: "POST", headers: { clientname: "3at1mrm65w3g" } }), null);
  assert.match(G.requestBlockReason({ url: be, method: "POST" }, { readOnly: true }), /read-only/);
  assert.equal(G.requestBlockReason({ url: be, method: "GET" }, { readOnly: true }), null);
  // Firebase / third parties are never blocked (login must work in read-only mode)
  assert.equal(G.requestBlockReason({ url: "https://identitytoolkit.googleapis.com/v1/x", method: "POST" }, { readOnly: true }), null);
});

test("guard: read-only lets named read POSTs through, blocks writes", () => {
  const be = "https://backend.onechanneladmin.com/inventory/orders";
  const ro = { readOnly: true };
  assert.equal(G.requestBlockReason({ url: `${be}/allOrders?orderId=1`, method: "POST" }, ro), null);
  assert.equal(G.requestBlockReason({ url: "https://backend.onechanneladmin.com/inventory/usergroup/getallusers?type=active", method: "POST" }, ro), null);
  assert.equal(G.requestBlockReason({ url: "https://backend.onechanneladmin.com/inventory/customer?showcount=true", method: "POST" }, ro), null);
  assert.match(G.requestBlockReason({ url: "https://backend.onechanneladmin.com/inventory/customer/createB2Buser", method: "POST" }, ro), /read-only/);
  assert.match(G.requestBlockReason({ url: `${be}/modifyOrder`, method: "POST" }, ro), /read-only/);
  assert.match(G.requestBlockReason({ url: "https://backend.onechanneladmin.com/marketplace/sendgrid/saveEmailLogsToOrder", method: "POST" }, ro), /read-only/);
  assert.match(G.requestBlockReason({ url: `${be}/allOrders`, method: "PUT" }, ro), /read-only/);
  // a denied org is refused even for reads
  assert.match(G.requestBlockReason({ url: `${be}/allOrders`, method: "POST", headers: { clientname: G.NEXUS_CLIENTNAME } }, ro), /denied org/);
});

test("totp: RFC 6238 / 4226 vectors", () => {
  const seed = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(totpNow(seed, 59_000), "287082");
  assert.equal(totpNow(seed, 1111111109_000), "081804");
  assert.equal(hotp(Buffer.from("12345678901234567890"), 0), "755224");
  assert.equal(totpNow(""), "");
});

test("menu: visibility mirrors the app rules", () => {
  const menu = {
    suites: [
      {
        id: "s",
        leaves: [
          { id: "a", path: "/a", permissions: ["read:a", "read:b"] },
          { id: "b", path: "/b", permissions: ["read:a", "read:x"], permissionType: "or" },
          { id: "c", path: "/c", permissions: "superadmin" },
          { id: "d", path: "/d", permissions: "read:restaurant", requiresModules: ["Restaurant"] },
          { id: "e", path: "https://external.example/x", permissions: "read:a" },
          { id: "f", path: "/a", permissions: "read:a" },
        ],
      },
    ],
  };
  const vis = (opts) => M.partitionLeaves(menu, opts).visible.map((l) => l.id);
  assert.deepEqual(vis({ permissions: ["read:a"] }), ["b", "f"]);
  assert.deepEqual(vis({ permissions: ["read:a", "read:b"] }), ["a", "b"]); // "/a" deduped
  assert.deepEqual(vis({ permissions: [], modules: ["Restaurant"] }), ["d"]); // module grants read:restaurant
  assert.deepEqual(vis({ permissions: ["superadmin"] }), ["a", "b", "c", "d"]);
  assert.deepEqual(M.partitionLeaves(menu, { permissions: ["read:a"] }).external.map((l) => l.id), ["e"]);
  assert.deepEqual(vis({ permissions: ["superadmin"], suites: ["other"] }), []);
});

test("menu: real navbar.menu.json loads and superadmin sees every in-app leaf", () => {
  const menu = M.loadMenu();
  const all = (menu.suites || []).flatMap((s) => s.leaves || []);
  const { visible, external } = M.partitionLeaves(menu, { permissions: ["superadmin"] });
  const uniqueInApp = new Set(all.filter((l) => !/^https?:/i.test(l.path)).map((l) => l.path));
  assert.ok(all.length > 50, `expected the full menu, got ${all.length} leaves`);
  assert.equal(visible.length, uniqueInApp.size);
  assert.equal(visible.length + external.length <= all.length, true);
});

test("menu: stored lists parse defensively", () => {
  assert.deepEqual(M.parseStoredList('["read:a"]'), ["read:a"]);
  assert.deepEqual(M.parseStoredList("not json"), []);
  assert.deepEqual(M.parseStoredList(null), []);
});

test("page-health: error screens and console noise", () => {
  assert.ok(H.findErrorScreen("Application error: a client-side exception has occurred (see console)"));
  assert.ok(H.findErrorScreen("Sorry, we couldn't find the page you are looking for."));
  assert.equal(H.findErrorScreen("Orders 404 items"), null);
  assert.equal(H.isIgnoredConsole("ResizeObserver loop limit exceeded"), true);
  assert.equal(H.isIgnoredConsole("TypeError: cannot read properties of undefined"), false);
});
