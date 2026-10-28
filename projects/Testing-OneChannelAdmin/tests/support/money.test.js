// node --test tests/support/money.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { cents, moneyFromText, sumCents } = require("./money");

test("money: cents from numbers and texts", () => {
  assert.equal(cents(12.5), 1250);
  assert.equal(cents(0.1 + 0.2), 30);
  assert.equal(cents("12.50"), 1250);
  assert.equal(cents("$1,234.56"), 123456);
  assert.equal(cents("Total: -$5.00"), -500);
  assert.ok(Number.isNaN(cents(null)));
  assert.ok(Number.isNaN(cents("n/a")));
});

test("money: first amount in a text", () => {
  assert.equal(moneyFromText("Refund $12.50 of $40"), 12.5);
  assert.equal(moneyFromText("USD 7"), 7);
  assert.ok(Number.isNaN(moneyFromText("")));
});

test("money: totals add up in cents", () => {
  assert.equal(sumCents("10.10", 0.2, ["$1.00"]), 1130);
  assert.ok(Number.isNaN(sumCents("1", "x")));
});
