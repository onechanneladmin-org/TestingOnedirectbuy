// checkStep — the per-step UI/UX check every flow spec calls after each screen or popup
// (guide: docs/qa/E2E-TEST-GUIDE.md § 6.1). Ported from onechanneladmin-latest apps/web/e2e/support.
//
//   await checkStep(page, testInfo, { id: "1CA-UC-011", name: "refund popup open", health, scope: dialog });
//
// One call:
//   1. settles the page (network idle, spinners gone);
//   2. attaches a screenshot to the report (always) and, with E2E_VISUAL=1, compares it with the
//      approved baseline (dynamic regions masked);
//   3. runs axe (WCAG 2.1 A/AA) on the page or the popup — serious/critical issues fail the step;
//   4. measures layout: page wider than the viewport, clipped text, buttons off-screen, tiny targets;
//   5. fails on console errors, uncaught exceptions and 5xx seen since the previous step;
//   6. writes one JSON line per step to test-results/.ux/steps.jsonl for the UX report (scripts/ux-report.js).
// Failures use expect.soft: the flow keeps going so every step gets its screenshot, and the test
// still FAILS at the end. (Unlike the old softTest wrapper, nothing is swallowed.)
//
// Pure parts (classifyLayout, stepSlug, summarize, uxReportMarkdown) are unit-tested in
// check-step.test.js; the browser part is only exercised by real runs.
const fs = require("fs");
const path = require("path");
const { settle } = require("./page-health");

const UX_DIR = path.resolve(__dirname, "..", "..", "test-results", ".ux");
const UX_LOG = path.join(UX_DIR, "steps.jsonl");

/** Same masks as specs/visual.spec.js, plus the order-flow fields that change every run. */
const DYNAMIC_MASKS = [
  ".p-datatable-tbody",
  ".p-paginator",
  ".p-badge",
  ".p-avatar",
  "time",
  "[data-testid='dynamic']",
  "[data-testid$='-date']",
  "[data-testid$='-order-number']",
];

const LIMITS = Object.freeze({
  minTarget: 24, // px, WCAG 2.2 target size (minimum)
  maxListed: 8, // offenders listed per kind
});

function stepSlug(id, name) {
  const clean = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  return [clean(id), clean(name)].filter(Boolean).join("--").slice(0, 90) || "step";
}

/**
 * Turn raw layout measurements (collected in the browser by measureLayout) into issues.
 * metrics = { viewport:{w,h}, doc:{scrollWidth}, clipped:[{sel,text}], offscreen:[{sel,text}], small:[{sel,w,h}] }
 */
function classifyLayout(metrics, limits = LIMITS) {
  const issues = [];
  const m = metrics || {};
  const vw = (m.viewport && m.viewport.w) || 0;
  const sw = (m.doc && m.doc.scrollWidth) || 0;
  if (vw && sw > vw + 1) {
    issues.push({ kind: "horizontal-overflow", severity: "serious", text: `page is ${sw}px wide in a ${vw}px viewport` });
  }
  const list = (arr) => (Array.isArray(arr) ? arr.slice(0, limits.maxListed) : []);
  for (const o of list(m.offscreen)) {
    issues.push({ kind: "offscreen-control", severity: "serious", text: `${o.sel} "${o.text || ""}" is outside the viewport` });
  }
  for (const c of list(m.clipped)) {
    issues.push({ kind: "clipped-text", severity: "moderate", text: `${c.sel} "${c.text || ""}" is cut off` });
  }
  for (const s of list(m.small)) {
    if (s.w < limits.minTarget || s.h < limits.minTarget) {
      issues.push({ kind: "small-target", severity: "minor", text: `${s.sel} is ${s.w}×${s.h}px (< ${limits.minTarget}px)` });
    }
  }
  return issues;
}

/** Which issues fail a step: serious/critical layout + axe, every console/page/5xx error. */
function failing(issues) {
  return (issues || []).filter((i) => ["serious", "critical"].includes(i.severity) || ["console", "pageerror", "http5xx"].includes(i.kind));
}

function summarize(step) {
  const issues = step.issues || [];
  const by = {};
  for (const i of issues) by[i.kind] = (by[i.kind] || 0) + 1;
  return { ...step, failed: failing(issues).length > 0, counts: by };
}

/** Markdown UX report from step records (one per checkStep call). */
function uxReportMarkdown(steps, { title = "UX report", runAt = new Date().toISOString() } = {}) {
  const rows = (steps || []).map(summarize);
  const failed = rows.filter((r) => r.failed);
  const kinds = {};
  for (const r of rows) for (const i of r.issues || []) kinds[i.kind] = (kinds[i.kind] || 0) + 1;
  const out = [];
  out.push(`# ${title}`, "", `Run: ${runAt} · steps: ${rows.length} · steps with failing issues: ${failed.length}`, "");
  out.push("## Issues by kind", "", "| Kind | Count |", "| --- | --- |");
  for (const [k, n] of Object.entries(kinds).sort((a, b) => b[1] - a[1])) out.push(`| ${k} | ${n} |`);
  if (!Object.keys(kinds).length) out.push("| (none) | 0 |");
  out.push("", "## Steps", "", "| Use case | Step | Viewport | Result | Issues | Screenshot |", "| --- | --- | --- | --- | --- | --- |");
  for (const r of rows) {
    const issues = (r.issues || []).map((i) => `${i.kind}: ${String(i.text).replace(/\|/g, "/")}`).slice(0, 4).join("<br>") || "—";
    out.push(`| ${r.id || ""} | ${r.name || ""} | ${r.viewport || ""} | ${r.failed ? "FAIL" : "ok"} | ${issues} | ${r.screenshot ? `\`${r.screenshot}\`` : ""} |`);
  }
  out.push("");
  return out.join("\n");
}

// ---------------------------------------------------------------------------------------------
// Browser part
// ---------------------------------------------------------------------------------------------

/** Runs in the page: measures layout problems inside `rootSel` (default: whole document). */
async function measureLayout(page, rootSel) {
  return page.evaluate(
    ({ rootSel, minTarget }) => {
      // First VISIBLE match: PrimeReact keeps closed sidebars/dialogs in the DOM.
      const shown = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
      };
      const root = (rootSel && [...document.querySelectorAll(rootSel)].filter(shown).pop()) || document.body;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const label = (el) => {
        const tid = el.getAttribute("data-testid");
        if (tid) return `[data-testid=${tid}]`;
        const id = el.id ? `#${el.id}` : "";
        const cls = typeof el.className === "string" ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).map((c) => `.${c}`).join("") : "";
        return `${el.tagName.toLowerCase()}${id}${cls}`;
      };
      const visible = (el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.visibility !== "hidden" && s.display !== "none" && r.width > 0 && r.height > 0;
      };
      const controls = [...root.querySelectorAll("button, a[href], input, select, textarea, [role=button]")].filter(visible);
      const offscreen = controls
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.right > vw + 1 || r.left < -1;
        })
        .map((el) => ({ sel: label(el), text: (el.innerText || el.value || "").trim().slice(0, 40) }));
      const small = controls
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ el, r }) => (r.width < minTarget || r.height < minTarget) && el.tagName !== "INPUT")
        .map(({ el, r }) => ({ sel: label(el), w: Math.round(r.width), h: Math.round(r.height) }));
      const clipped = [...root.querySelectorAll("button, label, th, td, h1, h2, h3, h4, h5, h6, .p-dialog-title")]
        .filter(visible)
        .filter((el) => {
          const s = getComputedStyle(el);
          const hides = ["hidden", "clip"].includes(s.overflowX) || s.textOverflow === "ellipsis";
          return hides && el.scrollWidth > el.clientWidth + 1;
        })
        .map((el) => ({ sel: label(el), text: (el.innerText || "").trim().slice(0, 40) }));
      return {
        viewport: { w: vw, h: vh },
        doc: { scrollWidth: document.documentElement.scrollWidth },
        offscreen,
        small,
        clipped,
      };
    },
    { rootSel, minTarget: LIMITS.minTarget }
  );
}

async function axeIssues(page, scopeSel) {
  // Lazy: keeps this module loadable by node --test without Playwright deps.
  const AxeBuilder = require("@axe-core/playwright").default;
  let b = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude("iframe");
  if (scopeSel) b = b.include(scopeSel);
  const res = await b.analyze();
  return res.violations
    .filter((v) => ["critical", "serious"].includes(v.impact))
    .map((v) => ({ kind: "axe", severity: v.impact, text: `${v.id} (${v.nodes.length}): ${v.help}` }));
}

function appendLog(record) {
  try {
    fs.mkdirSync(UX_DIR, { recursive: true });
    fs.appendFileSync(UX_LOG, `${JSON.stringify(record)}\n`);
  } catch {
    // reporting must never break a test
  }
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').TestInfo} testInfo
 * @param {{id:string,name:string,health?:{issues():any[],reset():void},scope?:string,axe?:boolean,baseline?:boolean,extraMasks?:string[]}} opts
 *   scope — CSS selector of the popup (plain CSS, e.g. ".p-dialog"; the first visible match is used) to limit axe + layout to it.
 */
async function checkStep(page, testInfo, opts) {
  const { expect } = require("@playwright/test");
  const { id, name, health, scope, axe = true, extraMasks = [] } = opts || {};
  const baseline = opts && opts.baseline != null ? opts.baseline : process.env.E2E_VISUAL === "1";
  const slug = stepSlug(id, name);
  const vp = page.viewportSize();
  const viewport = vp ? `${vp.width}x${vp.height}` : "";
  await settle(page);

  const masks = [...DYNAMIC_MASKS, ...extraMasks].map((sel) => page.locator(sel));
  const shotName = `${slug}${viewport ? `--${viewport}` : ""}.png`;
  const shotPath = testInfo.outputPath(shotName);
  await page.screenshot({ path: shotPath, fullPage: !scope, animations: "disabled", caret: "hide", mask: masks });
  await testInfo.attach(`step: ${id} ${name}`, { path: shotPath, contentType: "image/png" });
  if (baseline) {
    await expect.soft(page, `${id} ${name}: screenshot differs from the approved baseline`).toHaveScreenshot(shotName, {
      fullPage: !scope,
      animations: "disabled",
      caret: "hide",
      mask: masks,
      maxDiffPixelRatio: 0.02,
    });
  }

  const issues = [];
  if (axe) issues.push(...(await axeIssues(page, scope)));
  issues.push(...classifyLayout(await measureLayout(page, scope)));
  if (health) {
    issues.push(...health.issues().map((i) => ({ ...i, severity: "serious" })));
    health.reset();
  }

  const bad = failing(issues);
  // Per-step result for the coverage dashboard (TestingOnedirectbuy /api/usecases/results).
  testInfo.annotations.push({
    type: "usecase-result",
    description: JSON.stringify({ id, failed: bad.length > 0, note: bad.map((i) => `${i.kind}: ${i.text}`).slice(0, 3).join("; ") }),
  });
  const record = { at: new Date().toISOString(), test: testInfo.title, id, name, viewport, screenshot: path.relative(process.cwd(), shotPath), issues };
  appendLog(record);
  await testInfo.attach(`ux: ${id} ${name}`, { body: JSON.stringify(record, null, 2), contentType: "application/json" });
  expect.soft(bad, `${id} ${name}: UX/health issues`).toEqual([]);
  return record;
}

/**
 * Keyboard checks for an open popup: focus is inside it, Tab keeps focus inside, Esc closes it.
 * Call only where closing the popup is harmless (it is closed at the end).
 */
async function checkPopupKeyboard(page, dialog, { id = "", name = "popup" } = {}) {
  const { expect } = require("@playwright/test");
  const inside = () => dialog.evaluate((d) => d.contains(document.activeElement));
  await page.keyboard.press("Tab");
  expect.soft(await inside(), `${id} ${name}: focus should be inside the popup after Tab`).toBe(true);
  for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
  expect.soft(await inside(), `${id} ${name}: focus escaped the popup (no focus trap)`).toBe(true);
  await page.keyboard.press("Escape");
  await expect.soft(dialog, `${id} ${name}: Esc should close the popup`).toBeHidden({ timeout: 3000 });
}

module.exports = {
  DYNAMIC_MASKS,
  LIMITS,
  UX_LOG,
  stepSlug,
  classifyLayout,
  failing,
  summarize,
  uxReportMarkdown,
  measureLayout,
  checkStep,
  checkPopupKeyboard,
};
