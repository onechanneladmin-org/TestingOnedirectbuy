const test = require("node:test");
const assert = require("node:assert/strict");
const { orderE2eDecision } = require("./orderGuard.cjs");

const LIVE = {
  ZUKA_CUSTOMER_URL: "https://zukaongo.com",
  ZUKA_ADMIN_URL: "https://admin.zukaongo.com",
  ZUKA_PARTNER_URL: "https://drivers.zukaongo.com",
  ZUKA_PARTNER_ALIAS_URL: "https://partners.zukaongo.com",
  ZUKA_API_URL: "https://api.zukaongo.com",
};

test("off by default", () => {
  assert.equal(orderE2eDecision({}).ok, false);
  assert.equal(orderE2eDecision({ ZUKA_ALLOW_ORDER_E2E: "0" }).ok, false);
  assert.equal(orderE2eDecision({ ZUKA_ALLOW_ORDER_E2E: "" }).ok, false);
});

test("on Zuka staging (the default URLs) it runs with the flag", () => {
  const r = orderE2eDecision({ ZUKA_ALLOW_ORDER_E2E: "1" });
  assert.equal(r.ok, true);
  assert.equal(r.prod, false);
});

test("never against the live sites, whatever else is set", () => {
  for (const extra of [{}, { ZUKA_ALLOW_PROD_ORDERS: "1" }, { ALLOW_PROD_READONLY: "1" }]) {
    const r = orderE2eDecision({ ...LIVE, ZUKA_ALLOW_ORDER_E2E: "1", ...extra });
    assert.equal(r.ok, false, JSON.stringify(extra));
    assert.match(r.reason, /staging only/);
  }
});

test("one live URL among staging ones still refuses", () => {
  const r = orderE2eDecision({ ZUKA_ALLOW_ORDER_E2E: "1", ZUKA_API_URL: "https://api.zukaongo.com" });
  assert.equal(r.ok, false);
});
