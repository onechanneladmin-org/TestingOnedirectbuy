const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const g = require("./targetGuard.cjs");

const SPECS = path.resolve(__dirname, "..", "tests", "Onechanneladmin");

test("defaults to staging, which is non-prod", () => {
  assert.equal(g.resolveBaseUrl({}), "https://staging-admin.onechanneladmin.com");
  const r = g.checkTarget({});
  assert.equal(r.ok, true);
  assert.equal(r.prod, false);
});

test("host classification", () => {
  for (const u of [
    "https://staging-admin.onechanneladmin.com",
    "https://staging-api.onechanneladmin.com",
    "https://dev-onetest.onechanneladmin.com",
    "http://localhost:3000",
    "http://127.0.0.1:8080",
  ]) {
    assert.equal(g.isNonProdUrl(u), true, u);
  }
  for (const u of [
    "https://admin.onechanneladmin.com",
    "https://backend.onechanneladmin.com",
    "https://onechanneladmin.com",
    "https://stagingadmin.example",
    "not a url",
  ]) {
    assert.equal(g.isNonProdUrl(u), false, u);
  }
});

test("live admin is refused without ALLOW_PROD_READONLY", () => {
  for (const key of ["PLAYWRIGHT_BASE_URL", "BASE_URL"]) {
    const r = g.checkTarget({ [key]: "https://admin.onechanneladmin.com" });
    assert.equal(r.ok, false, key);
    assert.match(r.reason, /Refusing/);
  }
  assert.equal(
    g.checkTarget({ PLAYWRIGHT_BASE_URL: "https://admin.onechanneladmin.com", ALLOW_PROD_READONLY: "yes" }).ok,
    false,
  );
});

test("ALLOW_PROD_READONLY=1 runs only the read-only allowlist", () => {
  const r = g.checkTarget({
    PLAYWRIGHT_BASE_URL: "https://admin.onechanneladmin.com",
    ALLOW_PROD_READONLY: "1",
  });
  assert.equal(r.ok, true);
  assert.equal(r.prod, true);
  assert.deepEqual(r.readOnlySpecs, ["login.spec.js"]);
});

test("write specs can never be allowlisted for production", () => {
  const env = { PLAYWRIGHT_BASE_URL: "https://admin.onechanneladmin.com", ALLOW_PROD_READONLY: "1" };
  for (const f of [
    "NexusD2Cborderflow.spec.js",
    "Nexusb2borderflow.spec.js",
    "CompleteOrderFlow.spec.js",
    "FulfillmentSOB2BOrderFlow.spec.js",
    "Fulfillmentflowreturn.spec.js",
  ]) {
    const r = g.checkTarget(env, ["login.spec.js", f]);
    assert.equal(r.ok, false, f);
    assert.match(r.reason, /never run against production/);
  }
});

test("every order/fulfil/Nexus spec on disk is classed as a write spec", () => {
  const files = fs.readdirSync(SPECS).filter((f) => /\.spec\.js$/.test(f));
  const orderish = files.filter((f) => /nexus|order|fulfil|complete/i.test(f));
  assert.ok(orderish.length >= 7, `found ${orderish.length}`);
  for (const f of orderish) assert.equal(g.isWriteSpec(f), true, f);
  for (const f of g.PRODUCTION_READ_ONLY_SPECS) assert.equal(g.isWriteSpec(f), false, f);
});

test("non-prod runs block live 1CA hosts in the browser; prod read-only does not", () => {
  const [arg] = g.hostResolverArgs(g.checkTarget({}));
  assert.match(arg, /^--host-resolver-rules=/);
  assert.match(arg, /MAP \*\.onechanneladmin\.com ~NOTFOUND/);
  assert.match(arg, /EXCLUDE staging-\*\.onechanneladmin\.com/);
  assert.deepEqual(
    g.hostResolverArgs(
      g.checkTarget({ PLAYWRIGHT_BASE_URL: "https://admin.onechanneladmin.com", ALLOW_PROD_READONLY: "1" }),
    ),
    [],
  );
});

test("no spec hard-codes the live admin or backend host", () => {
  const offenders = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(js|ts)$/.test(e.name) && /https:\/\/(admin|backend)\.onechanneladmin\.com/.test(fs.readFileSync(p, "utf8")))
        offenders.push(path.relative(SPECS, p));
    }
  };
  walk(path.resolve(__dirname, "..", "tests"));
  assert.deepEqual(offenders, []);
});
