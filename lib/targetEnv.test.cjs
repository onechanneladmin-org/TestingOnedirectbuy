const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const t = require("./targetEnv.cjs");

const ROOT = path.resolve(__dirname, "..");

test("defaults to dev, which is non-prod", () => {
  assert.equal(t.resolveBaseUrl({}), "https://dev.onedirectbuy.com");
  assert.equal(t.isNonProdTarget({}), true);
});

test("host classification", () => {
  for (const u of [
    "https://dev.onedirectbuy.com",
    "https://staging.onedirectbuy.com",
    "http://localhost:3000",
    "http://127.0.0.1:8080",
    "http://odb.test",
    "https://dev-2.onedirectbuy.com",
  ]) {
    assert.equal(t.isNonProdUrl(u), true, u);
  }
  for (const u of [
    "https://onedirectbuy.com",
    "https://www.onedirectbuy.com",
    "https://devious.example",
    "not a url",
  ]) {
    assert.equal(t.isNonProdUrl(u), false, u);
  }
});

test("any prod URL among the base-URL vars makes the target prod", () => {
  const env = {
    ONEDIRECTBUY_BASE_URL: "https://dev.onedirectbuy.com",
    BASE_URL: "https://onedirectbuy.com",
  };
  assert.equal(t.isNonProdTarget(env), false);
});

test("prod without ALLOW_PROD is refused", () => {
  const r = t.checkTarget({ BASE_URL: "https://onedirectbuy.com" }, ROOT);
  assert.equal(r.ok, false);
});

test("prod with ALLOW_PROD=1 is limited to read-only specs", () => {
  const r = t.checkTarget(
    { BASE_URL: "https://onedirectbuy.com", ALLOW_PROD: "1" },
    ROOT,
  );
  assert.equal(r.ok, true);
  assert.equal(r.prod, true);
  assert.ok(r.readOnlySpecs.length > 0);
  assert.ok(!r.readOnlySpecs.includes("BuyerAccount.spec.js"));
});
