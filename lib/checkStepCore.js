/**
 * Pure parts of the per-step UI/UX check for the ODB buyer flows (tests/helpers/checkStep.js).
 * Mirrors onechanneladmin-latest apps/web/e2e/support/check-step.js — keep the rules in sync.
 * Unit tests: node --test lib/checkStepCore.test.js
 */
const LIMITS = Object.freeze({ minTarget: 24, maxListed: 8 });

/** Same masks idea as the 1CA suite: anything that changes every run. */
const DYNAMIC_MASKS = Object.freeze([
  "time",
  "[data-testid='dynamic']",
  "[data-testid$='-date']",
  "[data-testid$='-order-number']",
  "iframe[src*='stripe']",
]);

function stepSlug(id, name) {
  const clean = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  return [clean(id), clean(name)].filter(Boolean).join("--").slice(0, 90) || "step";
}

/** metrics = { viewport:{w,h}, doc:{scrollWidth}, clipped:[{sel,text}], offscreen:[{sel,text}], small:[{sel,w,h}] } */
function classifyLayout(metrics, limits = LIMITS) {
  const issues = [];
  const m = metrics || {};
  const vw = (m.viewport && m.viewport.w) || 0;
  const sw = (m.doc && m.doc.scrollWidth) || 0;
  if (vw && sw > vw + 1) issues.push({ kind: "horizontal-overflow", severity: "serious", text: `page is ${sw}px wide in a ${vw}px viewport` });
  const list = (arr) => (Array.isArray(arr) ? arr.slice(0, limits.maxListed) : []);
  for (const o of list(m.offscreen)) issues.push({ kind: "offscreen-control", severity: "serious", text: `${o.sel} "${o.text || ""}" is outside the viewport` });
  for (const c of list(m.clipped)) issues.push({ kind: "clipped-text", severity: "moderate", text: `${c.sel} "${c.text || ""}" is cut off` });
  for (const s of list(m.small)) {
    if (s.w < limits.minTarget || s.h < limits.minTarget) issues.push({ kind: "small-target", severity: "minor", text: `${s.sel} is ${s.w}×${s.h}px (< ${limits.minTarget}px)` });
  }
  return issues;
}

/** Issues that fail a step: serious/critical, and every console / page / 5xx error. */
function failing(issues) {
  return (issues || []).filter((i) => ["serious", "critical"].includes(i.severity) || ["console", "pageerror", "http5xx"].includes(i.kind));
}

/** Console noise that is not a storefront defect (keep short; every entry needs a reason). */
const IGNORED_CONSOLE = [
  /ResizeObserver loop/i, // benign browser warning
  /Download the React DevTools/i,
  /favicon\.ico/i,
  /googletagmanager|google-analytics|clarity\.ms|hotjar|facebook\.net|doubleclick/i, // third-party beacons
  /ERR_BLOCKED_BY_CLIENT/i,
];
const isIgnoredConsole = (text) => IGNORED_CONSOLE.some((re) => re.test(String(text || "")));

/** Only our own hosts count for 5xx (third-party outages are not storefront defects). */
const OWN_HOST_RE = /(^|\.)onedirectbuy\.com$|(^|\.)onechanneladmin\.com$|^localhost$|^127\.0\.0\.1$/i;
function isOwn5xx(status, url) {
  if (!(status >= 500)) return false;
  try {
    return OWN_HOST_RE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Stripe key guard: flows that pay must never run with a live key. */
function assertStripeTestKey(key) {
  const k = String(key || "");
  if (/^(sk|rk|pk)_live_/.test(k)) throw new Error("Refusing to run: a LIVE Stripe key is configured — use sk_test_/pk_test_ only.");
  return true;
}

/** Money compare in cents (avoids 0.1 + 0.2 problems). */
const cents = (n) => Math.round(Number(n) * 100);

module.exports = { LIMITS, DYNAMIC_MASKS, stepSlug, classifyLayout, failing, isIgnoredConsole, isOwn5xx, assertStripeTestKey, cents };
