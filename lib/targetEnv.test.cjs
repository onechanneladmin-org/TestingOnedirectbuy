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

test("a staging/dev storefront with a production API is refused, even with ALLOW_PROD", () => {
  for (const env of [
    { BASE_URL: "https://staging.onedirectbuy.com", ONEDIRECTBUY_API_URL: "https://onedirectbuy.com/api" },
    { BASE_URL: "https://dev.onedirectbuy.com", ONEDIRECTBUY_BUYER_API_URL: "https://marketplace-core.onedirectbuy.com" },
    { BASE_URL: "https://staging.onedirectbuy.com", ONEDIRECTBUY_API_URL: "https://onedirectbuy.com/api", ALLOW_PROD: "1" },
    { BASE_URL: "https://onedirectbuy.com", ONEDIRECTBUY_API_URL: "https://staging-api.onedirectbuy.com", ALLOW_PROD: "1" },
  ]) {
    const r = t.checkTarget(env, ROOT);
    assert.equal(r.ok, false, JSON.stringify(env));
    assert.match(r.reason, /different environments/);
  }
});

test("a production API alone is refused without ALLOW_PROD", () => {
  const r = t.checkTarget({ ONEDIRECTBUY_BASE_URL: "https://onedirectbuy.com", ONEDIRECTBUY_API_URL: "https://onedirectbuy.com/api" }, ROOT);
  assert.equal(r.ok, false);
  assert.match(r.reason, /Refusing to run against production/);
});

test("matching staging storefront and API pass; the API follows the storefront when unset", () => {
  const env = { BASE_URL: "https://staging.onedirectbuy.com", ONEDIRECTBUY_API_URL: "https://staging-api.onedirectbuy.com" };
  assert.equal(t.checkTarget(env, ROOT).ok, true);
  assert.equal(t.resolveApiUrl({ BASE_URL: "https://staging.onedirectbuy.com" }), "https://staging-api.onedirectbuy.com");
  assert.equal(t.resolveApiUrl({}), "https://dev.onedirectbuy.com");
  assert.equal(t.resolveApiUrl({ BASE_URL: "https://onedirectbuy.com" }), "https://onedirectbuy.com/api");
  assert.equal(t.resolveApiUrl({ ONEDIRECTBUY_API_URL: "http://localhost:4000/" }), "http://localhost:4000");
});

test("order placing: off by default, staging or local only", () => {
  assert.equal(t.orderPlacingDecision({}, ROOT).ok, false);
  assert.equal(t.orderPlacingDecision({ BASE_URL: "https://staging.onedirectbuy.com" }, ROOT).ok, false);
  const on = { ODB_ALLOW_ORDERS: "1" };
  // dev (the default) is not enough
  assert.equal(t.orderPlacingDecision(on, ROOT).ok, false);
  assert.equal(t.orderPlacingDecision({ ...on, BASE_URL: "https://onedirectbuy.com", ALLOW_PROD: "1" }, ROOT).ok, false);
  assert.equal(
    t.orderPlacingDecision({ ...on, BASE_URL: "https://staging.onedirectbuy.com", ONEDIRECTBUY_API_URL: "https://onedirectbuy.com/api" }, ROOT).ok,
    false,
  );
  assert.equal(
    t.orderPlacingDecision({ ...on, BASE_URL: "https://staging.onedirectbuy.com", ONEDIRECTBUY_API_URL: "https://dev.onedirectbuy.com" }, ROOT).ok,
    false,
  );
  assert.equal(t.orderPlacingDecision({ ...on, BASE_URL: "https://staging.onedirectbuy.com" }, ROOT).ok, true);
  assert.equal(t.orderPlacingDecision({ ...on, BASE_URL: "http://localhost:3000", ONEDIRECTBUY_API_URL: "http://localhost:4000" }, ROOT).ok, true);
});

test("ci-tests.config.json marks the order-placing journey", () => {
  const cfg = require("../ci-tests.config.json");
  const marked = cfg.tests.filter(t.placesOrders).map((e) => e.file);
  assert.ok(marked.includes("tests/OneDirectBuy/BuyerPurchaseJourney.spec.js"));
});
