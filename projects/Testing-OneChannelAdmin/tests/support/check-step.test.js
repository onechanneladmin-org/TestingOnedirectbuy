// Unit tests for the pure parts of check-step.js (no browser): node --test tests/support/check-step.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("./check-step");

test("stepSlug: stable, filesystem-safe, bounded", () => {
  assert.equal(S.stepSlug("1CA-UC-011", "Refund popup open"), "1ca-uc-011--refund-popup-open");
  assert.equal(S.stepSlug("", "  Orders / list  "), "orders-list");
  assert.equal(S.stepSlug("", ""), "step");
  assert.ok(S.stepSlug("X", "y".repeat(300)).length <= 90);
});

test("classifyLayout: overflow, off-screen controls, clipped text, small targets", () => {
  const issues = S.classifyLayout({
    viewport: { w: 390, h: 844 },
    doc: { scrollWidth: 512 },
    offscreen: [{ sel: "button.p-button", text: "Refund" }],
    clipped: [{ sel: "th", text: "Fulfilled Qty Distribution" }],
    small: [{ sel: "a.icon", w: 16, h: 16 }, { sel: "button.ok", w: 40, h: 32 }],
  });
  const kinds = issues.map((i) => i.kind);
  assert.deepEqual(kinds, ["horizontal-overflow", "offscreen-control", "clipped-text", "small-target"]);
  assert.match(issues[0].text, /512px wide in a 390px viewport/);
  assert.equal(issues.find((i) => i.kind === "small-target").text.includes("16×16"), true);
});

test("classifyLayout: a clean page has no issues; 1px rounding is tolerated", () => {
  assert.deepEqual(S.classifyLayout({ viewport: { w: 1440, h: 900 }, doc: { scrollWidth: 1441 } }), []);
  assert.deepEqual(S.classifyLayout(null), []);
});

test("classifyLayout: lists at most LIMITS.maxListed offenders per kind", () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ sel: `button.b${i}`, text: "x" }));
  const issues = S.classifyLayout({ viewport: { w: 100 }, doc: { scrollWidth: 100 }, offscreen: many });
  assert.equal(issues.length, S.LIMITS.maxListed);
});

test("failing: serious/critical and every console/page/5xx error fail; minor/moderate do not", () => {
  const issues = [
    { kind: "small-target", severity: "minor" },
    { kind: "clipped-text", severity: "moderate" },
    { kind: "axe", severity: "serious" },
    { kind: "console", severity: "serious" },
    { kind: "http5xx" },
  ];
  assert.deepEqual(S.failing(issues).map((i) => i.kind), ["axe", "console", "http5xx"]);
  assert.equal(S.summarize({ issues: issues.slice(0, 2) }).failed, false);
  assert.equal(S.summarize({ issues }).failed, true);
});

test("uxReportMarkdown: counts kinds, marks failing steps, escapes pipes", () => {
  const md = S.uxReportMarkdown(
    [
      { id: "1CA-UC-001", name: "orders list", viewport: "1440x900", screenshot: "a.png", issues: [] },
      { id: "1CA-UC-011", name: "refund popup", viewport: "390x844", screenshot: "b.png", issues: [{ kind: "axe", severity: "serious", text: "label | missing" }] },
    ],
    { title: "T", runAt: "2026-10-20T00:00:00Z" }
  );
  assert.match(md, /^# T/);
  assert.match(md, /steps: 2 · steps with failing issues: 1/);
  assert.match(md, /\| axe \| 1 \|/);
  assert.match(md, /\| 1CA-UC-011 \| refund popup \| 390x844 \| FAIL \| axe: label \/ missing/);
  assert.match(md, /\| 1CA-UC-001 \| orders list \| 1440x900 \| ok \| — \|/);
  assert.match(S.uxReportMarkdown([]), /\| \(none\) \| 0 \|/);
});
