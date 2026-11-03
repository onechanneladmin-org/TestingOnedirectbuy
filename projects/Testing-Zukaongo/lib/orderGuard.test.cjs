const test = require("node:test");
const assert = require("node:assert/strict");
const { orderE2eDecision } = require("./orderGuard.cjs");

test("off by default", () => {
  assert.equal(orderE2eDecision({}).ok, false);
  assert.equal(orderE2eDecision({ ZUKA_ALLOW_ORDER_E2E: "0" }).ok, false);
  assert.equal(orderE2eDecision({ ZUKA_ALLOW_ORDER_E2E: "" }).ok, false);
});

test("live site needs a second flag", () => {
  const r = orderE2eDecision({ ZUKA_ALLOW_ORDER_E2E: "1" });
  assert.equal(r.ok, false);
  assert.equal(r.prod, true);
  assert.match(r.reason, /ZUKA_ALLOW_PROD_ORDERS=1/);
  assert.equal(orderE2eDecision({ ZUKA_ALLOW_ORDER_E2E: "1", ZUKA_ALLOW_PROD_ORDERS: "0" }).ok, false);
  assert.equal(orderE2eDecision({ ZUKA_ALLOW_ORDER_E2E: "1", ZUKA_ALLOW_PROD_ORDERS: "1" }).ok, true);
});

test("one live URL among local ones still counts as prod", () => {
  const local = {
    ZUKA_CUSTOMER_URL: "http://localhost:8081",
    ZUKA_ADMIN_URL: "http://localhost:8082",
    ZUKA_PARTNER_URL: "http://localhost:8083",
    ZUKA_PARTNER_ALIAS_URL: "http://localhost:8083",
    ZUKA_API_URL: "https://api.zukaongo.com",
    ZUKA_ALLOW_ORDER_E2E: "1",
  };
  assert.equal(orderE2eDecision(local).ok, false);
  assert.equal(orderE2eDecision({ ...local, ZUKA_API_URL: "http://localhost:3000" }).ok, true);
});
