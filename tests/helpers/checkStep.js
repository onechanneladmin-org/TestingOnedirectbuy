/**
 * checkStep — per-step UI/UX check for the ODB buyer flows (plan: docs/qa/E2E-UI-UX-PLAN.md § 4).
 *
 *   import { test, expect } from "@playwright/test";
 *   import { watchHealth, checkStep } from "../helpers/checkStep.js";
 *   const health = watchHealth(page);
 *   await checkStep(page, testInfo, { id: "ODB-UC-201", name: "checkout confirmation", health });
 *
 * One call: settle → screenshot attached to the report (+ baseline compare with E2E_VISUAL=1) →
 * axe WCAG 2.1 A/AA (serious/critical fail; needs @axe-core/playwright installed) → layout
 * checks → console errors / page errors / 5xx since the last step. Uses expect.soft: the flow
 * continues so every step gets its screenshot, and the test still FAILS at the end (unlike the
 * old softTest.js wrapper). Each step adds a `usecase-result` annotation, which
 * reporters/useCaseResultsReporter.js turns into a per-ID result on the /coverage dashboard.
 *
 * Use plain @playwright/test (not ../helpers/softTest.js) in flows that call this.
 */
import { expect } from "@playwright/test";
import core from "../../lib/checkStepCore.js";

const { DYNAMIC_MASKS, LIMITS, stepSlug, classifyLayout, failing, isIgnoredConsole, isOwn5xx } = core;

/** Collect console errors, uncaught exceptions and our own 5xx responses on a page. */
export function watchHealth(page) {
  let issues = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (!isIgnoredConsole(text)) issues.push({ kind: "console", severity: "serious", text: text.slice(0, 500) });
  });
  page.on("pageerror", (err) => issues.push({ kind: "pageerror", severity: "serious", text: String(err?.message || err).slice(0, 500) }));
  page.on("response", (res) => {
    if (isOwn5xx(res.status(), res.url())) issues.push({ kind: "http5xx", severity: "serious", text: `${res.status()} ${res.request().method()} ${res.url().split("?")[0]}` });
  });
  return {
    issues: () => [...issues],
    reset: () => {
      issues = [];
    },
  };
}

export async function settle(page, { timeout = 15000 } = {}) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout }).catch(() => {});
}

async function measureLayout(page, rootSel) {
  return page.evaluate(
    ({ rootSel, minTarget }) => {
      const root = (rootSel && document.querySelector(rootSel)) || document.body;
      const vw = window.innerWidth;
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
      return {
        viewport: { w: vw, h: window.innerHeight },
        doc: { scrollWidth: document.documentElement.scrollWidth },
        offscreen: controls
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.right > vw + 1 || r.left < -1;
          })
          .map((el) => ({ sel: label(el), text: (el.innerText || el.value || "").trim().slice(0, 40) })),
        small: controls
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ el, r }) => (r.width < minTarget || r.height < minTarget) && el.tagName !== "INPUT")
          .map(({ el, r }) => ({ sel: label(el), w: Math.round(r.width), h: Math.round(r.height) })),
        clipped: [...root.querySelectorAll("button, label, th, td, h1, h2, h3, h4, h5, h6")]
          .filter(visible)
          .filter((el) => {
            const s = getComputedStyle(el);
            return (["hidden", "clip"].includes(s.overflowX) || s.textOverflow === "ellipsis") && el.scrollWidth > el.clientWidth + 1;
          })
          .map((el) => ({ sel: label(el), text: (el.innerText || "").trim().slice(0, 40) })),
      };
    },
    { rootSel, minTarget: LIMITS.minTarget },
  );
}

let axeModule;
async function axeIssues(page, scopeSel) {
  if (axeModule === undefined) axeModule = await import("@axe-core/playwright").then((m) => m.default || m.AxeBuilder || m).catch(() => null);
  if (!axeModule) return [{ kind: "axe-unavailable", severity: "minor", text: "install @axe-core/playwright to enable the accessibility scan" }];
  let b = new axeModule({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude("iframe");
  if (scopeSel) b = b.include(scopeSel);
  const res = await b.analyze();
  return res.violations
    .filter((v) => ["critical", "serious"].includes(v.impact))
    .map((v) => ({ kind: "axe", severity: v.impact, text: `${v.id} (${v.nodes.length}): ${v.help}` }));
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').TestInfo} testInfo
 * @param {{id:string,name:string,health?:ReturnType<typeof watchHealth>,scope?:string,axe?:boolean,baseline?:boolean,extraMasks?:string[]}} opts
 */
export async function checkStep(page, testInfo, opts) {
  const { id, name, health, scope, axe = true, extraMasks = [] } = opts || {};
  const baseline = opts?.baseline ?? process.env.E2E_VISUAL === "1";
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
    issues.push(...health.issues());
    health.reset();
  }
  const bad = failing(issues);
  testInfo.annotations.push({
    type: "usecase-result",
    description: JSON.stringify({ id, failed: bad.length > 0, note: bad.map((i) => `${i.kind}: ${i.text}`).slice(0, 3).join("; ") }),
  });
  await testInfo.attach(`ux: ${id} ${name}`, { body: JSON.stringify({ id, name, viewport, issues }, null, 2), contentType: "application/json" });
  expect.soft(bad, `${id} ${name}: UX/health issues`).toEqual([]);
  return { id, name, viewport, issues };
}
