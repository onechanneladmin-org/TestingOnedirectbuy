import test from "node:test";
import assert from "node:assert/strict";
import { createSoftChecker, isExpectedAbsentOnStorefront } from "./softCheck.js";

class Skip extends Error {}

function fakes() {
  const testInfo = {
    file: "tests/OneDirectBuy/Fake.spec.js",
    title: "fake",
    annotations: [],
    skipped: null,
    skip(cond, reason) {
      if (cond) {
        this.skipped = reason;
        throw new Skip(reason);
      }
    },
    attach: async () => {},
  };
  const page = { url: () => "about:blank", screenshot: async () => {} };
  return { page, testInfo };
}

test("a failed check is recorded (the fixture then fails the test)", async () => {
  const { page, testInfo } = fakes();
  const c = createSoftChecker(page, testInfo);
  const ok = await c.soft("ODB-UC-1", "fails", async () => {
    throw new Error("expect(locator).toBeVisible() failed");
  });
  assert.equal(ok, false);
  assert.equal(c.issues.length, 1);
  assert.equal(testInfo.skipped, null);
});

test("an out-of-scope check skips the test instead of passing it", async () => {
  const { page, testInfo } = fakes();
  const c = createSoftChecker(page, testInfo);
  await assert.rejects(
    c.soft("ODB-UC-2", "later", async () => {
      throw new Error("sheet: Later versions — not built yet");
    }),
    Skip,
  );
  assert.match(testInfo.skipped, /Out of scope — ODB-UC-2/);
  assert.equal(c.issues.length, 0);
  assert.equal(testInfo.annotations[0].type, "out-of-scope");
});

test("New Functionality and missing storefront features are failures, not exemptions", () => {
  assert.equal(isExpectedAbsentOnStorefront(new Error("sheet: New Functionality")), false);
  assert.equal(isExpectedAbsentOnStorefront(new Error("Checkout has no shipping method")), false);
  assert.equal(isExpectedAbsentOnStorefront(new Error("sheet: Not Required")), true);
  assert.equal(isExpectedAbsentOnStorefront(new Error("admin orders live in OneChannel")), true);
});
