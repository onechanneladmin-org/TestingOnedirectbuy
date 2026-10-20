// node --test lib/useCaseReport.test.js lib/checkStepCore.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("./useCaseReport");
const C = require("./checkStepCore");

const step = (id, failed, note = "") => ({ type: "usecase-result", description: JSON.stringify({ id, failed, note }) });

test("idsInText finds use-case IDs, not dates", () => {
  assert.deepEqual(R.idsInText("ODB-UC-201 checkout · 1ca-uc-011 refund · ODB-BE-ADV-003 · run 2026-10-20"), ["ODB-UC-201", "1CA-UC-011", "ODB-BE-ADV-003"]);
  assert.deepEqual(R.idsInText("no ids here"), []);
});

test("testStatus maps Playwright outcomes", () => {
  assert.equal(R.testStatus("expected"), "passed");
  assert.equal(R.testStatus("passed"), "passed");
  assert.equal(R.testStatus("unexpected"), "failed");
  assert.equal(R.testStatus("timedOut"), "failed");
  assert.equal(R.testStatus("skipped"), "skipped");
  assert.equal(R.testStatus("flaky"), "flaky");
});

test("step-level results: own step failure fails only that ID; a failure elsewhere blocks the rest", () => {
  const out = R.resultsFromTests([
    { title: "E1 order to return", status: "unexpected", error: "timeout on ship", annotations: [step("ODB-UC-201", false), step("1CA-UC-011", true, "axe: label missing")] },
  ]);
  const by = Object.fromEntries(out.map((r) => [r.useCaseId, r]));
  assert.equal(by["ODB-UC-201"].status, "blocked");
  assert.match(by["ODB-UC-201"].error, /test failed elsewhere: timeout on ship/);
  assert.equal(by["1CA-UC-011"].status, "failed");
  assert.equal(by["1CA-UC-011"].error, "axe: label missing");
});

test("step-level results on a passing test pass; desktop+phone failure of either fails the ID", () => {
  const out = R.resultsFromTests([
    { title: "A2 @ desktop", status: "expected", annotations: [step("1CA-UC-003", false)] },
    { title: "A2 @ phone", status: "unexpected", annotations: [step("1CA-UC-003", true, "horizontal-overflow")] },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].status, "failed");
  assert.deepEqual(out[0].tests, ["A2 @ desktop", "A2 @ phone"]);
});

test("test-level IDs from usecase annotations and titles; flaky is never a pass", () => {
  const out = R.resultsFromTests([
    { title: "ODB-UC-450 apply valid coupon", status: "expected", annotations: [] },
    { title: "remove coupon", status: "flaky", annotations: [{ type: "usecase", description: "ODB-UC-452" }] },
    { title: "ODB-UC-451 invalid coupon", status: "skipped" },
    { title: "setup", status: "expected" },
  ]);
  assert.deepEqual(out.map((r) => [r.useCaseId, r.status]), [["ODB-UC-450", "passed"], ["ODB-UC-451", "skipped"], ["ODB-UC-452", "failed"]]);
  assert.match(out[2].error, /flaky/);
});

test("worst result wins across tests: failed > blocked > passed > skipped", () => {
  const out = R.resultsFromTests([
    { title: "ODB-UC-1 a", status: "skipped" },
    { title: "ODB-UC-1 b", status: "expected" },
    { title: "ODB-UC-1 c", status: "unexpected", error: "boom" },
  ]);
  assert.equal(out[0].status, "failed");
  assert.equal(out[0].error, "boom");
});

test("testsFromPlaywrightJson flattens nested suites, joins test + result annotations, strips colours", () => {
  const report = {
    suites: [
      {
        file: "flows/a2.spec.js",
        suites: [
          {
            specs: [
              {
                title: "orders list → details",
                file: "flows/a2.spec.js",
                tests: [
                  {
                    projectName: "e2e",
                    status: "unexpected",
                    annotations: [{ type: "usecase", description: "1CA-UC-001" }],
                    results: [{ status: "failed", error: { message: "\u001b[31mExpected\u001b[39m visible" }, annotations: [step("1CA-UC-003", true)] }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  const tests = R.testsFromPlaywrightJson(report);
  assert.equal(tests.length, 1);
  assert.equal(tests[0].error, "Expected visible");
  assert.equal(tests[0].project, "e2e");
  assert.equal(tests[0].annotations.length, 2);
  const out = R.resultsFromTests(tests);
  // step-level annotations take precedence over the plain usecase one
  assert.deepEqual(out.map((r) => [r.useCaseId, r.status]), [["1CA-UC-003", "failed"]]);
  assert.deepEqual(R.testsFromPlaywrightJson(null), []);
});

test("checkStepCore: slug, layout, failing, console/5xx filters, Stripe guard, cents", () => {
  assert.equal(C.stepSlug("ODB-UC-201", "Checkout / confirmation"), "odb-uc-201--checkout-confirmation");
  const issues = C.classifyLayout({ viewport: { w: 390 }, doc: { scrollWidth: 420 }, offscreen: [{ sel: "button", text: "Pay" }], small: [{ sel: "a.x", w: 12, h: 12 }] });
  assert.deepEqual(issues.map((i) => i.kind), ["horizontal-overflow", "offscreen-control", "small-target"]);
  assert.deepEqual(C.failing(issues).map((i) => i.kind), ["horizontal-overflow", "offscreen-control"]);
  assert.equal(C.isIgnoredConsole("ResizeObserver loop limit exceeded"), true);
  assert.equal(C.isIgnoredConsole("TypeError: x is undefined"), false);
  assert.equal(C.isOwn5xx(502, "https://dev.onedirectbuy.com/user/cart"), true);
  assert.equal(C.isOwn5xx(500, "https://api.stripe.com/v1/x"), false);
  assert.equal(C.isOwn5xx(404, "https://onedirectbuy.com/x"), false);
  assert.throws(() => C.assertStripeTestKey("sk_live_abc"), /LIVE Stripe key/);
  assert.equal(C.assertStripeTestKey("sk_test_abc"), true);
  assert.equal(C.cents(0.1 + 0.2), 30);
});
