// Money helpers for money steps (guide § 6.4): every amount is compared in integer cents.
// Pure — unit-tested in money.test.js.

/** 12.5 → 1250, "12.50" → 1250, "$1,234.56" → 123456, null → NaN. */
function cents(value) {
  if (value == null || value === "") return NaN;
  if (typeof value === "number") return Math.round(value * 100);
  const n = moneyFromText(value);
  return Number.isNaN(n) ? NaN : Math.round(n * 100);
}

/** First money amount in a text ("Total: $1,234.56" → 1234.56, "-$5.00" → -5). NaN when none. */
function moneyFromText(text) {
  const m = String(text || "").match(/(-)?\s*[$€£]?\s*(-)?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?/);
  if (!m) return NaN;
  const sign = m[1] || m[2] ? -1 : 1;
  return sign * Number(`${m[3].replace(/,/g, "")}${m[4] || ""}`);
}

/** Sum of cents; NaN-safe (a NaN part makes the sum NaN so the assert fails loudly). */
function sumCents(...parts) {
  return parts.flat().reduce((a, b) => a + cents(b), 0);
}

/** Playwright assertion: two amounts equal to the cent. */
function expectMoney(actual, expected, label = "amount") {
  const { expect } = require("@playwright/test");
  const a = cents(actual);
  const e = cents(expected);
  expect(Number.isNaN(a), `${label}: actual "${actual}" is not an amount`).toBe(false);
  expect(Number.isNaN(e), `${label}: expected "${expected}" is not an amount`).toBe(false);
  expect(a, `${label}: ${actual} should equal ${expected} (in cents)`).toBe(e);
}

module.exports = { cents, moneyFromText, sumCents, expectMoney };
