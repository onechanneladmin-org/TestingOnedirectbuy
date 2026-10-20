import path from "path";
import { expect } from "@playwright/test";
import { collectSnapshot } from "../../lib/zuka-ui-audit/collect.js";
import { runRules } from "../../lib/zuka-ui-audit/rules.js";
import { writePageResult, auditDir } from "../../lib/zuka-ui-audit/report.js";

/**
 * UI/UX theme audit for one screen.
 *
 *   await auditScreen(page, { surface: "customer", pageName: "Cart" }, async () => {
 *     await page.goto(".../cart");
 *     await expect(page.getByRole("heading", { name: "Cart" })).toBeVisible();
 *   });
 *
 * Records runtime errors / failed API calls while `open()` runs, times the
 * screen until it settles, runs lib/zuka-ui-audit rules, writes JSON + HTML
 * (test-results/zuka-ui-audit/<run>/index.html) and attaches the findings.
 * Critical findings fail the step; ZUKA_UI_AUDIT_STRICT=1 also fails on major.
 */

const WATCH = Symbol.for("zukaUiAuditWatch");
const IGNORED_HTTP = [/\/favicon/, /google-analytics|googletagmanager|sentry|hotjar/i, /\/api\/chat\//];

function watch(page) {
  if (page[WATCH]) return page[WATCH];
  const state = { consoleErrors: [], pageErrors: [], httpErrors: [] };
  page.on("console", (m) => {
    if (m.type() === "error") state.consoleErrors.push(m.text().slice(0, 240));
  });
  page.on("pageerror", (e) => state.pageErrors.push(String(e.message || e).slice(0, 240)));
  page.on("response", (r) => {
    const url = r.url();
    if (r.status() >= 400 && !IGNORED_HTTP.some((re) => re.test(url))) {
      state.httpErrors.push({ url: url.slice(0, 200), status: r.status(), method: r.request().method() });
    }
  });
  page[WATCH] = state;
  return state;
}

/** Wait for the screen to settle: network idle and no visible spinners/progressbars. */
export async function settle(page) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  const busy = page.locator('[role=progressbar]:visible, [aria-busy=true]:visible');
  await expect(busy).toHaveCount(0, { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(400);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ surface: "marketing"|"customer"|"admin"|"partner"; pageName: string; mobile?: boolean; testInfo?: import('@playwright/test').TestInfo }} opts
 * @param {() => Promise<void>} [open]
 */
export async function auditScreen(page, opts, open) {
  const state = watch(page);
  state.consoleErrors.length = 0;
  state.pageErrors.length = 0;
  state.httpErrors.length = 0;

  const t0 = Date.now();
  if (open) await open();
  await settle(page);
  const settleMs = Date.now() - t0;

  const snapshot = await page.evaluate(collectSnapshot, { maxElements: 1500 });
  const findings = runRules(snapshot, {
    surface: opts.surface,
    mobile: Boolean(opts.mobile),
    settleMs: open ? settleMs : 0,
    consoleErrors: state.consoleErrors,
    pageErrors: state.pageErrors,
    httpErrors: state.httpErrors,
  });

  const viewport = page.viewportSize();
  const vp = viewport ? `${viewport.width}x${viewport.height}` : "";
  const slug = `${opts.surface}-${opts.pageName}-${vp}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const dir = auditDir();
  const screenshot = path.join(dir, `${slug}.png`);
  await page.screenshot({ path: screenshot, fullPage: false }).catch(() => {});

  const result = {
    slug,
    surface: opts.surface,
    pageName: opts.pageName,
    viewport: vp,
    url: snapshot.url,
    settleMs,
    screenshot,
    findings,
    stats: {
      texts: snapshot.texts.length,
      controls: snapshot.controls.length,
      images: snapshot.images.length,
      fonts: snapshot.fonts,
    },
  };
  writePageResult(result);

  const testInfo = opts.testInfo;
  const counts = ["critical", "major", "minor", "info"].map((s) => `${findings.filter((f) => f.severity === s).length} ${s}`).join(", ");
  if (testInfo) {
    await testInfo.attach(`UI audit — ${opts.pageName} (${vp}): ${counts}`, {
      body: Buffer.from(JSON.stringify(findings, null, 2)),
      contentType: "application/json",
    }).catch(() => {});
  }
  console.log(`[ui-audit] ${opts.surface} · ${opts.pageName} (${vp}) → ${counts}`);

  const strict = process.env.ZUKA_UI_AUDIT_STRICT === "1" || process.env.ZUKA_UI_AUDIT_STRICT === "true";
  const blocking = findings.filter((f) => f.severity === "critical" || (strict && f.severity === "major"));
  expect(
    blocking.map((f) => `${f.severity.toUpperCase()} ${f.ruleId}: ${f.message} — ${f.actual}`),
    `UI audit blocking findings on ${opts.pageName} (report: ${path.join(dir, "index.html")})`,
  ).toEqual([]);
  return result;
}

export const MOBILE = { width: 390, height: 844 };
export const DESKTOP = { width: 1366, height: 900 };
