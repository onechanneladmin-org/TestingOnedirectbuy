const { expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { uiAudit } = require("../../../lib/ui-audit");
const { findingKey } = require("../../../lib/ui-audit/report");
const { getReference } = require("../../../lib/ui-audit/references");
const { captureIssueScreenshot: defaultCaptureShot } = require("../../helpers/flowStep");
const { auditComponents } = require("../../../lib/ui-audit/components");

const { e2eSettings } = require("../../support/env");
const G = require("../../support/guard");

// Same QA user / admin / test org as the E2E flows (E2E_* in .env); TEST_LOGIN_* still works.
const E2E = e2eSettings();
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || process.env.E2E_BASE_URL || "https://admin.onechanneladmin.com";
const EMAIL = E2E.email || process.env.TEST_LOGIN_EMAIL || "admin@onechanneladmin.com";
const PASSWORD = E2E.password || process.env.TEST_LOGIN_PASSWORD || "";
/** The audit only looks: every write is aborted unless UX_ALLOW_WRITES=1 (and never for Nexus). */
const UX_READ_ONLY = process.env.UX_ALLOW_WRITES !== "1";
/** Re-walk the hub's side-menu pages from every page (slow; each has its own spec). Off by default. */
const UX_SIDE_MENU = process.env.UX_SIDE_MENU === "1";

/**
 * Safety for the audit (it clicks Add / Create / tabs / first row on live): pins the test org
 * (E2E_ORG_ID, Nexus refused) and blocks every write and every request for a denied org.
 * Installed once per context; blocked calls are listed on page.__uxBlocked.
 */
async function installAuditGuard(page) {
  const context = page.context();
  if (context.__uxGuard) return;
  context.__uxGuard = true;
  G.assertTestOrg(E2E.orgId, process.env);
  const blocked = [];
  page.__uxBlocked = blocked;
  await context.route("**/*", (route) => {
    const req = route.request();
    const reason = G.requestBlockReason({ url: req.url(), method: req.method(), headers: req.headers() }, { readOnly: UX_READ_ONLY });
    if (!reason) return route.fallback();
    blocked.push({ reason, method: req.method(), url: req.url().split("?")[0] });
    return route.abort("blockedbyclient");
  });
}

/** Pin E2E_ORG_ID in the app and fail if the app moved the session to another org. */
async function pinTestOrg(page) {
  let after = await page.evaluate(() => localStorage.getItem("currentorganization")).catch(() => null);
  // The app's bootstrap can overwrite the org with the user's default after a reload: retry.
  for (let attempt = 0; attempt < 3 && after !== E2E.orgId; attempt += 1) {
    await page.evaluate((org) => {
      localStorage.setItem("currentorganization", org);
      localStorage.setItem("currentorganization_reset", org);
    }, E2E.orgId);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAdminUiReady(page);
    after = await page.evaluate(() => localStorage.getItem("currentorganization"));
  }
  expect(after, "audit session must be on E2E_ORG_ID (test org)").toBe(E2E.orgId);
  G.assertTestOrg(after, process.env);
}

const UX_EXTRA_RULES = new Set([
  "a11y.contrast",
  "forms.placeholder-contrast",
]);

const SIDE_MENU_CHROME_RULES = new Set([
  "design.primary-button",
  "design.sidebar-nav",
  "design.date-pills",
]);

function isUxFinding(finding) {
  if (!finding || finding.kind === "review") return false;
  const ruleId = String(finding.ruleId || "");
  if (ruleId === "design.view-scale") return false;
  if (ruleId.startsWith("design.validation.") && finding.kind === "heuristic") return false;
  return ruleId === "catalog.metric-card" || ruleId.startsWith("design.") || UX_EXTRA_RULES.has(ruleId);
}

function referenceForFinding(finding) {
  return getReference(finding.ruleId) || null;
}

async function waitForAdminUiReady(page) {
  await page.waitForURL((url) => !/signin|\/v2\/login|\/login/i.test(url.href), {
    timeout: 45000,
  });
  await page.waitForLoadState("domcontentloaded");

  const shell = page
    .locator("aside, nav, [class*=sidebar], [class*=SideBar], [class*=side-bar]")
    .first();
  await shell.waitFor({ state: "visible", timeout: 30000 }).catch(() => {});

  for (let i = 0; i < 20; i += 1) {
    const busy = await page.evaluate(() => {
      const loaders = [
        ...document.querySelectorAll(
          ".loader-container, .MuiCircularProgress-root, [class*=loading], [aria-busy=true]",
        ),
      ];
      return loaders.some((el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity || "1") > 0.05 &&
          rect.width > 8 &&
          rect.height > 8
        );
      });
    });
    if (!busy) break;
    await page.waitForTimeout(250);
  }

  await page
    .waitForLoadState("networkidle", { timeout: 8000 })
    .catch(() => page.waitForTimeout(800));

  const content = page
    .locator(
      "main:visible, [role=main]:visible, h1:visible, h2:visible, h3:visible, h4:visible, table:visible, aside button:visible, nav button:visible",
    )
    .first();
  const visible = await content
    .waitFor({ state: "visible", timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  if (!visible) {
    await page.waitForTimeout(1500);
  } else {
    await page.waitForTimeout(400);
  }
}

function isLoginUrl(url) {
  return /signin|\/v2\/login|\/login/i.test(String(url || ""));
}

async function performLogin(page) {
  if (!PASSWORD) {
    throw new Error("TEST_LOGIN_PASSWORD is empty. Set it in projects/Testing-OneChannelAdmin/.env");
  }
  await page.goto(`${BASE_URL}/signin?returnUrl=%2Fhome%2Fdashboard`, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await page.getByRole("textbox", { name: "Email address" }).fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Login" }).click();
  await waitForAdminUiReady(page);
  if (isLoginUrl(page.url())) {
    throw new Error(`Login did not leave the sign-in page: ${page.url()}`);
  }
}

async function openSignIn(page) {
  if (!PASSWORD) {
    throw new Error("TEST_LOGIN_PASSWORD is empty. Set it in projects/Testing-OneChannelAdmin/.env");
  }
  await installAuditGuard(page);
  // Prefer home when storageState already has a session; fall back to sign-in.
  await page.goto(`${BASE_URL}/home/dashboard`, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  if (isLoginUrl(page.url())) {
    await page.goto(`${BASE_URL}/signin?returnUrl=%2Fhome%2Fdashboard`, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
  }
}

async function signIn(page) {
  await installAuditGuard(page);
  if (isLoginUrl(page.url())) {
    await performLogin(page);
  } else {
    await waitForAdminUiReady(page);
    if (isLoginUrl(page.url())) await performLogin(page);
  }
  await pinTestOrg(page);
}

async function openAdminPage(page, entry) {
  await installAuditGuard(page);
  const target = new URL(entry.path, BASE_URL).href;
  await page.goto(target, { waitUntil: "domcontentloaded", timeout: 45000 });
  if (isLoginUrl(page.url())) {
    await performLogin(page);
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 45000 });
  }
  const org = await page.evaluate(() => localStorage.getItem("currentorganization")).catch(() => null);
  if (org !== E2E.orgId) {
    await pinTestOrg(page);
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 45000 });
  }
  await waitForAdminUiReady(page);
  if (isLoginUrl(page.url())) {
    throw new Error(`Still on login after opening ${entry.path}: ${page.url()}`);
  }
  const pathOnly = String(entry.path || "").split("?")[0];
  const onPage = new RegExp(pathOnly.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const stayed = await expect(page).toHaveURL(onPage, { timeout: 10000 }).then(() => true, () => false);
  if (!stayed) handleRedirect(page, pathOnly);
}

/**
 * The dashboard body scrolls inside .oneca-suite-content, not the document: window.scrollTo is a
 * no-op there and document.scrollHeight equals the viewport height, so anything below the fold
 * never mounts. Resolve the real scroller, falling back to the tallest overflow-y container.
 */
async function scrollContainerHandle(page) {
  return page.evaluateHandle(() => {
    const named = document.querySelector(".oneca-suite-content");
    if (named && named.scrollHeight > named.clientHeight) return named;
    let best = document.scrollingElement || document.documentElement;
    let bestOverflow = best.scrollHeight - best.clientHeight;
    document.querySelectorAll("div, main, section").forEach((el) => {
      if (!/auto|scroll/.test(getComputedStyle(el).overflowY)) return;
      const overflow = el.scrollHeight - el.clientHeight;
      if (overflow > bestOverflow) {
        best = el;
        bestOverflow = overflow;
      }
    });
    return best;
  });
}

/** Resolves once no XHR/fetch has been in flight for `quietMs`, or `timeout` elapses. */
async function waitForDataLoad(page, { quietMs = 1200, timeout = 45000 } = {}) {
  let inflight = 0;
  let lastActivity = Date.now();
  const track = (delta) => (request) => {
    if (!["xhr", "fetch"].includes(request.resourceType())) return;
    inflight += delta;
    lastActivity = Date.now();
  };
  const onRequest = track(1);
  const onSettled = track(-1);
  page.on("request", onRequest);
  page.on("requestfinished", onSettled);
  page.on("requestfailed", onSettled);
  try {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (inflight <= 0 && Date.now() - lastActivity >= quietMs) break;
      await page.waitForTimeout(150);
    }
    // Widgets paint a skeleton while their own request resolves.
    await page
      .locator(".p-skeleton, .p-progress-spinner, [class*=skeleton]")
      .first()
      .waitFor({ state: "hidden", timeout: 15000 })
      .catch(() => {});
  } finally {
    page.off("request", onRequest);
    page.off("requestfinished", onSettled);
    page.off("requestfailed", onSettled);
  }
}

/**
 * Pick a date-range pill (PrimeReact SelectButton: .p-selectbutton > .p-button, selected = .p-highlight)
 * and wait for the refetch it triggers. listUserActions() skips these pills on purpose, so without
 * this the whole audit only ever sees the default "Today" range.
 * @param {string} label exact pill text, e.g. "This year"
 */
async function selectDateRange(page, label) {
  const group = page.locator(".p-selectbutton").first();
  await group.waitFor({ state: "visible", timeout: 20000 });
  const pill = group.locator(".p-button").filter({ hasText: new RegExp(`^\\s*${label}\\s*$`, "i") }).first();
  if (!(await pill.count())) {
    const available = await group.locator(".p-button").allInnerTexts().catch(() => []);
    throw new Error(`Date range "${label}" not found. Available: ${available.join(" | ") || "(none)"}`);
  }
  await pill.click();
  await waitForDataLoad(page);
  const selected = (await group.locator(".p-button.p-highlight").first().innerText().catch(() => "")).trim();
  if (!new RegExp(`^${label}$`, "i").test(selected)) {
    throw new Error(`Date range did not apply: expected "${label}", active pill is "${selected || "(none)"}"`);
  }
  return selected;
}

/**
 * Step the real scroll container to the bottom so every lazy section mounts, waiting for data
 * after each move, then report what rendered. Returns a summary for the step log.
 */
async function scrollThroughPage(page) {
  const scroller = await scrollContainerHandle(page);
  const geometry = await scroller.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
  const stride = Math.max(200, Math.round(geometry.clientHeight * 0.8));
  for (let y = 0; y <= geometry.scrollHeight; y += stride) {
    await scroller.evaluate((el, top) => el.scrollTo(0, top), y);
    await page.waitForTimeout(400);
  }
  await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await waitForDataLoad(page);

  const result = await scroller.evaluate((el) => {
    const atBottom = el.scrollTop >= el.scrollHeight - el.clientHeight - 2;
    const q = (sel) => document.querySelectorAll(sel).length;
    return {
      atBottom,
      scrollTop: el.scrollTop,
      maxScroll: el.scrollHeight - el.clientHeight,
      charts: q("canvas, svg.recharts-surface, .p-chart"),
      tables: q("table"),
      cards: q("[class*=metric], [class*=card]"),
      pendingSkeletons: q(".p-skeleton, .p-progress-spinner"),
    };
  });
  await scroller.dispose();
  if (!result.atBottom) {
    throw new Error(`Did not reach the bottom: scrollTop ${result.scrollTop} of ${result.maxScroll}`);
  }
  if (result.pendingSkeletons > 0) {
    throw new Error(`${result.pendingSkeletons} widget(s) still loading after scrolling to the bottom`);
  }
  return result;
}

let auditedPathsCache = null;
/** Paths that have their own ux-flows spec (so a redirect onto them needs no second audit). */
function auditedPaths() {
  if (auditedPathsCache) return auditedPathsCache;
  auditedPathsCache = new Set();
  for (const file of fs.readdirSync(__dirname).filter((f) => f.endsWith(".spec.js"))) {
    const m = fs.readFileSync(path.join(__dirname, file), "utf8").match(/"path":\s*"([^"?]+)/);
    if (m) auditedPathsCache.add(m[1]);
  }
  return auditedPathsCache;
}

/**
 * The menu path redirected. Landing on a dashboard or on a page with its own spec means the
 * feature is off for this org (or the page moved onto an audited one): skip with the reason.
 * Otherwise the page moved to a new path — keep auditing it there and say so.
 */
function handleRedirect(page, pathOnly) {
  const { test } = require("@playwright/test");
  const landed = new URL(page.url()).pathname;
  test.info().annotations.push({ type: "redirect", description: `${pathOnly} → ${landed}` });
  if (/\/dashboard$/.test(landed) || auditedPaths().has(landed)) {
    test.skip(true, `${pathOnly} redirects to ${landed} on org ${E2E.orgId} (feature not enabled for this org, or page moved)`);
  }
  page.__uxRedirectedTo = landed;
  console.log(`[ux-audit] ${pathOnly} moved to ${landed}; auditing it there`);
}

function specFinding(fields) {
  return {
    ruleId: fields.ruleId,
    kind: "deterministic",
    severity: "major",
    category: "design",
    element: fields.element || "",
    selector: fields.selector || "",
    message: fields.message,
    expected: fields.expected,
    actual: fields.actual,
  };
}

const TAB_PANEL_RULES = new Set([
  "design.validation.table-layout",
  "design.validation.table-actions",
  "design.validation.title-color",
  "design.validation.component-contrast",
  "design.validation.card-geometry",
  "design.validation.chart-detail",
  "design.validation.badges",
  "design.validation.calendar",
  "design.validation.section-spacing",
  "design.table",
  "design.content-card",
  "catalog.metric-card",
  "a11y.contrast",
  "forms.placeholder-contrast",
]);

function tableSpacingSignature(tables) {
  const rows = (tables || []).filter((table) => !table.hasEmptyMarker && (table.rowCount || 0) > 0);
  if (!rows.length) return null;
  const avg = (key) => rows.reduce((sum, table) => sum + (Number(table[key]) || 0), 0) / rows.length;
  return { topGap: avg("topGap"), insetLeft: avg("insetLeft"), insetRight: avg("insetRight") };
}

async function auditInactiveTabs(page, entry, seenKeys, overlayStats) {
  const extras = [];
  const signatures = [];
  let count = 0;
  try {
    count = await page.locator("[role='tab']").count();
  } catch {
    return extras;
  }
  let tried = 0;
  for (let i = 0; i < count && tried < 5; i += 1) {
    const tab = page.locator("[role='tab']").nth(i);
    const box = await tab.boundingBox().catch(() => null);
    if (!box || box.width < 24 || box.height < 20) continue;
    const shown = await tab.isVisible().catch(() => false);
    if (!shown) continue;
    const name = ((await tab.innerText().catch(() => "")) || `tab ${i + 1}`)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 48);
    const selected = await tab.getAttribute("aria-selected").catch(() => "");
    if (selected === "true") continue;
    tried += 1;
    const clicked = await tab.click({ timeout: 4000 }).then(() => true).catch(() => false);
    if (!clicked) continue;
    await page.waitForTimeout(500);
    const active = await tab.getAttribute("aria-selected").catch(() => "");
    if (active !== "true") {
      extras.push(
        specFinding({
          ruleId: "design.validation.tab-switch",
          element: `tab "${name}"`,
          selector: "",
          message: `Tab "${name}" did not become active`,
          expected: "aria-selected=true after click",
          actual: `aria-selected=${active || "missing"}`,
        }),
      );
      continue;
    }
    try {
      const result = await uiAudit(page, {
        pageName: `${entry.hub || ""} ${entry.name || ""} / ${name}`.trim(),
        viewport: { width: 1440, height: 900 },
        writeReport: false,
      });
      signatures.push({ name, tables: (result.snapshot && result.snapshot.tables) || [] });
      for (const finding of result.findings || []) {
        if (!TAB_PANEL_RULES.has(finding.ruleId) || !isUxFinding(finding)) continue;
        extras.push({
          ...finding,
          element: `${finding.element || finding.message} [tab: ${name}]`,
          message: `${finding.message} (tab "${name}")`,
          actual: `${finding.actual || ""}`.trim(),
        });
      }
    } catch (error) {
      extras.push(
        specFinding({
          ruleId: "design.validation.tab-switch",
          element: `tab "${name}"`,
          message: `Validation could not run after opening tab "${name}"`,
          expected: "audit completes on the tab panel",
          actual: error.message,
        }),
      );
    }
    if (overlayStats) {
      extras.push(
        ...(await auditOpenedSurfaces(page, entry, seenKeys, overlayStats, { limit: 1 }).catch(() => [])),
      );
    }
  }
  const comparable = signatures
    .map((item) => ({ name: item.name, spacing: tableSpacingSignature(item.tables) }))
    .filter((item) => item.spacing);
  if (comparable.length >= 2) {
    const topSpread =
      Math.max(...comparable.map((item) => item.spacing.topGap)) -
      Math.min(...comparable.map((item) => item.spacing.topGap));
    const leftSpread =
      Math.max(...comparable.map((item) => item.spacing.insetLeft)) -
      Math.min(...comparable.map((item) => item.spacing.insetLeft));
    if (topSpread > 16 || leftSpread > 16) {
      extras.push(
        specFinding({
          ruleId: "design.validation.tab-layout",
          element: "tables across tabs",
          message: "Related tabs do not share the same table spacing",
          expected: "top and left table spacing within 16px across tabs",
          actual: comparable
            .map(
              (item) =>
                `${item.name}: top ${Math.round(item.spacing.topGap)}px, left ${Math.round(item.spacing.insetLeft)}px`,
            )
            .join("; "),
        }),
      );
    }
  }
  return extras;
}

async function readPageSideMenu(page) {
  return page
    .evaluate(() => {
      const aside = document.querySelector('aside[aria-label="Home navigation"]');
      if (!aside) return [];
      const buttons = [...aside.querySelectorAll("button")].filter((el) => {
        const rect = el.getBoundingClientRect();
        const text = (el.innerText || "").replace(/\s+/g, " ").trim();
        if (rect.width < 80 || rect.height < 28 || rect.height > 72) return false;
        if (!text || text.length > 48) return false;
        if (!String(el.className || "").includes("tw-w-full")) return false;
        return true;
      });
      if (!buttons.some((el) => el.getAttribute("aria-current") === "page")) return [];
      buttons.forEach((el, index) => el.setAttribute("data-audit-side", String(index)));
      return buttons.map((el, index) => ({
        index,
        name: (el.innerText || "").replace(/\s+/g, " ").trim(),
        current: el.getAttribute("aria-current") === "page",
      }));
    })
    .catch(() => []);
}

async function auditSideMenuPages(page, entry, seenKeys, overlayStats) {
  const extras = [];
  let originPath = "";
  try {
    originPath = new URL(page.url()).pathname;
  } catch {
    return extras;
  }
  const items = await readPageSideMenu(page);
  const pending = items.filter((item) => !item.current).slice(0, 12);
  for (const item of pending) {
    const menu = await readPageSideMenu(page);
    const live = menu.find((entryItem) => entryItem.name === item.name) || item;
    const locator = page.locator(`[data-audit-side="${live.index}"]`).first();
    const clicked = await locator.click({ timeout: 4000 }).then(() => true).catch(() => false);
    if (!clicked) {
      extras.push(
        specFinding({
          ruleId: "design.validation.side-menu",
          element: `side menu "${item.name}"`,
          message: `Side menu "${item.name}" did not respond`,
          expected: "clicking the side menu opens that page view",
          actual: "click failed",
        }),
      );
      continue;
    }
    await page.waitForTimeout(600);
    let pathNow = originPath;
    try {
      pathNow = new URL(page.url()).pathname;
    } catch {
      pathNow = originPath;
    }
    if (pathNow !== originPath) {
      await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
      break;
    }
    await waitForAdminUiReady(page).catch(() => {});
    try {
      const result = await uiAudit(page, {
        pageName: `${entry.hub || ""} ${entry.name || ""} / ${item.name}`.trim(),
        viewport: { width: 1440, height: 900 },
        writeReport: false,
      });
      for (const finding of result.findings || []) {
        if (!isUxFinding(finding) || SIDE_MENU_CHROME_RULES.has(finding.ruleId)) continue;
        const key = findingKey(finding);
        if (seenKeys && seenKeys.has(key)) continue;
        if (seenKeys) seenKeys.add(key);
        extras.push({
          ...finding,
          element: `${finding.element || finding.message} [side: ${item.name}]`,
          message: `${finding.message} (side menu "${item.name}")`,
          actual: `${finding.actual || ""}`.trim(),
        });
      }
    } catch (error) {
      extras.push(
        specFinding({
          ruleId: "design.validation.side-menu",
          element: `side menu "${item.name}"`,
          message: `UI audit could not run after opening side menu "${item.name}"`,
          expected: "audit completes on that side menu view",
          actual: error.message,
        }),
      );
    }
    if (overlayStats) {
      extras.push(
        ...(await auditOpenedSurfaces(page, entry, seenKeys, overlayStats, { limit: 2 }).catch(() => [])),
      );
    }
  }
  return extras;
}

/**
 * The theme control is an unlabelled PrimeIcon in the top bar — it shows a sun in dark mode and a
 * moon in light mode. It carries no aria-label or data-testid (that gap is itself reported as
 * components.icon-button.accessible-name), so the old attribute-based selector matched nothing and
 * every page silently skipped its second theme.
 */
const THEME_TOGGLE = "i.pi-sun, i.pi-moon";

/**
 * The app records the active theme in localStorage.currenttheme and defaults to dark. Do NOT infer
 * it from document.body: this app keeps the body background dark in both modes, so a body-colour
 * diff reports "theme did not change" even on a successful switch.
 */
async function readTheme(page) {
  return page.evaluate(() => {
    const stored = String(localStorage.getItem("currenttheme") || "").toLowerCase();
    if (stored === "light" || stored === "dark") return stored;
    return document.querySelector("i.pi-moon") ? "light" : "dark";
  });
}

/** Computed background of the surfaces that do repaint, so we can tell a real switch from a no-op. */
async function themeSignature(page) {
  return page.evaluate(() =>
    ["body", "aside", "table", "thead th", "[class*=card]", ".oneca-suite-content"]
      .map((sel) => {
        const el = document.querySelector(sel);
        return el ? `${sel}:${getComputedStyle(el).backgroundColor}` : `${sel}:-`;
      })
      .join("|"),
  );
}

/**
 * Switch to `want` ("dark" | "light") and confirm it took. Returns null when the page has no theme
 * control (the audit then stays single-theme rather than inventing a finding).
 */
async function setTheme(page, want) {
  const toggle = page.locator(THEME_TOGGLE).first();
  if (!(await toggle.count().catch(() => 0))) return null;
  if ((await readTheme(page)) === want) return { changed: false, signature: await themeSignature(page) };

  const before = await themeSignature(page);
  await toggle.click({ timeout: 5000 });
  await page.waitForTimeout(900);
  await waitForDataLoad(page, { quietMs: 600, timeout: 15000 }).catch(() => {});

  const now = await readTheme(page);
  if (now !== want) throw new Error(`Theme did not switch to ${want} (still ${now})`);
  return { changed: true, signature: await themeSignature(page), before };
}

/**
 * Run the full rule set again in the other theme. Every page is audited dark first (the app's
 * default), then light, because this app applies light mode only to some surfaces — tables repaint
 * while the shell stays dark — and those defects exist only in the second theme.
 */
async function auditOtherTheme(page, entry, reload) {
  const extras = [];
  // The component and overlay passes probe dialogs and can leave the shell torn down, so the top
  // bar (and with it the theme control) may be gone by now — that is why this used to report
  // "single-theme" on pages that do have a toggle. Start the theme pass from a clean load.
  if (typeof reload === "function") {
    await reload().catch(() => {});
    await waitForDataLoad(page, { quietMs: 800, timeout: 20000 }).catch(() => {});
  }
  const switched = await setTheme(page, "light").catch((error) => {
    extras.push(
      specFinding({
        ruleId: "design.validation.theme-switch",
        element: "theme toggle",
        message: "Theme control did not switch to light mode",
        expected: "clicking the theme control switches the app to light mode",
        actual: error.message,
      }),
    );
    return undefined;
  });
  if (switched === null) {
    console.log(`[ux-audit] theme on ${entry.path || entry.name}: no theme control, dark only`);
    return extras;
  }
  if (!switched) return extras;

  if (switched.before && switched.signature === switched.before) {
    extras.push(
      specFinding({
        ruleId: "design.validation.theme-switch",
        element: "theme toggle",
        message: "Light mode did not repaint any surface",
        expected: "switching to light mode restyles the page",
        actual: "every sampled surface kept its dark-mode background",
      }),
    );
  }

  try {
    const result = await uiAudit(page, {
      pageName: `${entry.hub || ""} ${entry.name || ""} (light)`.trim(),
      viewport: { width: 1440, height: 900 },
      writeReport: false,
    });
    const kept = (result.findings || []).filter(isUxFinding);
    console.log(`[ux-audit] theme on ${entry.path || entry.name}: light pass found ${kept.length}`);
    for (const finding of kept) {
      extras.push({
        ...finding,
        element: `${finding.element || finding.message} [light mode]`,
        message: `${finding.message} (light mode)`,
      });
    }
  } catch (error) {
    extras.push(
      specFinding({
        ruleId: "design.validation.theme-switch",
        element: "theme toggle",
        message: "Validation could not run in light mode",
        expected: "audit completes in light mode",
        actual: error.message,
      }),
    );
  }

  // Leave the app as we found it: currenttheme persists across reloads and leaks into later specs.
  await setTheme(page, "dark").catch(() => {});
  return extras;
}

const MAX_OVERLAYS_PER_PAGE = 10;

function emptyOverlayStats() {
  return { modals: 0, popups: 0, sidebars: 0, opened: [] };
}

function stampOverlayCounts(reportDir, stats) {
  const file = path.join(reportDir, "report.md");
  if (!fs.existsSync(file)) return;
  const body = fs.readFileSync(file, "utf8");
  if (body.includes("Modals opened:")) return;
  const block = [
    "",
    `- Modals opened: ${stats.modals || 0}`,
    `- Popups opened: ${stats.popups || 0}`,
    `- Sliding sidebars opened: ${stats.sidebars || 0}`,
    "",
  ].join("\n");
  const lines = body.split("\n");
  lines.splice(1, 0, block.trimEnd());
  fs.writeFileSync(file, `${lines.join("\n")}`);
}

function isOverlayUiFinding(finding) {
  if (!finding) return false;
  if (String(finding.ruleId || "").startsWith("overlays.")) return true;
  return isUxFinding(finding);
}

function recordOpenedSurface(stats, kind, name, entry) {
  if (!stats || (kind !== "modal" && kind !== "popup" && kind !== "sidebar")) return;
  const label = String(name || kind).replace(/\s+/g, " ").trim().slice(0, 80);
  const key = `${kind}|${label}|${entry.path || ""}`;
  if (stats.opened.some((item) => item.key === key)) return;
  if (stats.opened.length >= MAX_OVERLAYS_PER_PAGE) return;
  stats.opened.push({ key, kind, name: label, path: entry.path || "", page: entry.name || "" });
  if (kind === "modal") stats.modals += 1;
  else if (kind === "popup") stats.popups += 1;
  else stats.sidebars += 1;
  console.log(`[ux-audit] opened ${kind} "${label}" on ${entry.path || entry.name || "page"}`);
}

async function listOverlayTriggers(page, limit, rootSelector) {
  return page
    .evaluate(({ limit: cap, rootSelector: rootSel }) => {
      const root = rootSel ? document.querySelector(rootSel) : document.body;
      if (!root) return [];
      const scope = root || document;
      scope.querySelectorAll("[data-audit-overlay-trigger]").forEach((el) => {
        el.removeAttribute("data-audit-overlay-trigger");
      });
      const unsafe =
        /delete|remove|logout|sign out|log out|destroy|void|refund|archive|deactivate|download|export|print|save|submit|confirm|apply|\bpay\b|pay now|disable|reset|discard/i;
      const scored = [];
      for (const el of root.querySelectorAll("button, [role=button]")) {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
        if (rect.width < 16 || rect.height < 16 || rect.bottom < 0 || rect.top > window.innerHeight) continue;
        if (!rootSel && el.closest("aside[aria-label='Home navigation'], .p-paginator, [role=tablist]")) continue;
        if (el.getAttribute("role") === "tab") continue;
        if (/\bp-dialog-header-close\b|\bp-sidebar-close\b/.test(String(el.className || ""))) continue;
        // Names start with an icon-font glyph (" Add New"): drop leading non-letters before matching.
        const text = ((el.innerText || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().replace(/^[^A-Za-z0-9]+/, "")).slice(0, 60);
        if (!text && !el.querySelector(".pi-plus, .pi-eye, .pi-pencil, .pi-filter, .pi-window-maximize")) continue;
        if (unsafe.test(text) || /^(close|cancel|dismiss)$/i.test(text)) continue;
        if (/^(today|yesterday|last 7 days|last 30 days|this week|this month|this year|custom|all time)$/i.test(text)) continue;
        if (el.getAttribute("type") === "submit") continue;
        const popup = el.getAttribute("aria-haspopup") || "";
        let score = 0;
        if (/dialog/i.test(popup)) score = 100;
        else if (/^(add|new|create|edit|view|details|open|filter|columns|preview|configure|manage|import)\b/i.test(text)) score = 80;
        else if (/\b(add|create|edit|view details|open|filter|columns)\b/i.test(text)) score = 70;
        else if (el.querySelector(".pi-plus, .pi-eye, .pi-pencil, .pi-filter, .pi-window-maximize, .pi-external-link")) score = 55;
        else if ((popup === "menu" || popup === "true") && text.length > 1) score = 30;
        if (!score) continue;
        const dup = scored.find((item) => item.name === (text || el.getAttribute("aria-label") || "icon"));
        if (dup) continue;
        scored.push({ el, score, name: text || el.getAttribute("aria-label") || "icon" });
      }
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, cap).map((item, index) => {
        item.el.setAttribute("data-audit-overlay-trigger", String(index));
        return { index, name: item.name, score: item.score };
      });
    }, { limit, rootSelector: rootSelector || "" })
    .catch(() => []);
}

async function readOpenSurfaces(page) {
  return page
    .evaluate(() => {
      const nodes = [
        ...document.querySelectorAll(
          "[role=dialog], [role=alertdialog], dialog, [aria-modal=true], .p-dialog, .p-sidebar, .p-drawer, .p-overlaypanel, [role=menu], .p-menu, .p-tieredmenu",
        ),
      ];
      const surfaces = [];
      for (const el of nodes) {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
        if (rect.width < 80 || rect.height < 48) continue;
        const onScreen =
          rect.right > 8 && rect.bottom > 8 && rect.left < window.innerWidth - 8 && rect.top < window.innerHeight - 8;
        if (!onScreen) continue;
        if (el.getAttribute("aria-label") === "Home navigation") continue;
        const cls = String(el.className || "");
        if (/\bp-dialog-mask\b|\bp-sidebar-mask\b|\bp-component-overlay\b/.test(cls)) continue;
        const role = (el.getAttribute("role") || "").toLowerCase();
        let kind = "";
        if (/\bp-sidebar\b|\bp-drawer\b|\bDrawer\b/.test(cls)) kind = "sidebar";
        else if (role === "menu" || /\bp-menu\b|\bp-tieredmenu\b/.test(cls)) kind = "menu";
        else if (/\bp-overlaypanel\b|\bpopover\b/i.test(cls)) kind = "popup";
        else if (
          role === "dialog" ||
          role === "alertdialog" ||
          el.tagName === "DIALOG" ||
          /\bp-dialog\b/.test(cls) ||
          el.getAttribute("aria-modal") === "true"
        ) {
          kind = "modal";
        } else if (
          (style.position === "fixed" || style.position === "absolute") &&
          rect.height > window.innerHeight * 0.45 &&
          rect.width >= 240 &&
          rect.width < window.innerWidth * 0.85 &&
          (rect.left <= 12 || rect.right >= window.innerWidth - 12)
        ) {
          kind = "sidebar";
        }
        if (!kind) continue;
        const heading = el.querySelector("h1,h2,h3,h4,[role=heading]");
        const name = (
          el.getAttribute("aria-label") ||
          (heading && heading.innerText) ||
          ""
        )
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 80);
        if (el.closest("aside[aria-label='Home navigation']")) continue;
        el.setAttribute("data-audit-open-surface", String(surfaces.length));
        const side = rect.left < window.innerWidth / 2 ? "L" : "R";
        surfaces.push({
          index: surfaces.length,
          kind,
          name,
          key: `${kind}|${name}|${side}|${Math.round(rect.x / 24)}|${Math.round(rect.width / 16)}`,
        });
      }
      // Custom (Tailwind) modals with no dialog role: a fixed full-screen backdrop holding a form panel.
      if (!surfaces.some((x) => x.kind === "modal" || x.kind === "sidebar")) {
        for (const backdrop of document.querySelectorAll("body div")) {
          const bs = getComputedStyle(backdrop);
          if (bs.position !== "fixed") continue;
          const br = backdrop.getBoundingClientRect();
          if (br.width < window.innerWidth * 0.9 || br.height < window.innerHeight * 0.9) continue;
          if (backdrop.closest("[data-audit-open-surface], aside[aria-label='Home navigation'], .oneca-app-top")) continue;
          const panel = [...backdrop.querySelectorAll("div, form, section")].find((p) => {
            const r = p.getBoundingClientRect();
            return r.width >= 240 && r.width < window.innerWidth * 0.9 && r.height >= 120 && p.querySelector("input:not([type=hidden]), textarea, select, button");
          });
          if (!panel) continue;
          const heading = panel.querySelector("h1,h2,h3,h4,[role=heading]");
          const name = ((heading && heading.innerText) || "").replace(/\s+/g, " ").trim().slice(0, 80);
          panel.setAttribute("data-audit-open-surface", String(surfaces.length));
          const r = panel.getBoundingClientRect();
          surfaces.push({ index: surfaces.length, kind: "modal", name, noRole: true, key: `modal|${name}|C|${Math.round(r.x / 24)}|${Math.round(r.width / 16)}` });
          break;
        }
      }
      return surfaces;
    })
    .catch(() => []);
}

async function dismissOpenSurfaces(page) {
  const close = page
    .locator(
      ".p-dialog-header-close, .p-sidebar-close, .p-drawer-header-close, [role=dialog] button[aria-label*='close' i], .p-sidebar button[aria-label*='close' i], .p-dialog-header-icons button, .p-sidebar-header button",
    )
    .first();
  if (await close.isVisible().catch(() => false)) {
    await close.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(200);
  }
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(150);
  await page.keyboard.press("Escape").catch(() => {});
}

async function auditSurfaceUi(page, entry, surface, seenKeys) {
  const findings = [];
  let result;
  try {
    result = await uiAudit(page, {
      pageName: `${entry.hub || ""} ${entry.name || ""} ${surface.kind} ${surface.name}`.trim(),
      viewport: { width: 1440, height: 900 },
      writeReport: false,
    });
  } catch (error) {
    return [
      specFinding({
        ruleId: "design.validation.dialog-open",
        element: `${surface.kind} "${surface.name}"`,
        message: `UI audit could not run on ${surface.kind} "${surface.name}"`,
        expected: "audit completes while the overlay is open",
        actual: error.message,
      }),
    ];
  }
  const candidates = (result.findings || []).filter(isOverlayUiFinding);
  const flags = await page
    .evaluate(({ index, selectors, overlayRules }) => {
      const host = document.querySelector(`[data-audit-open-surface="${index}"]`);
      return selectors.map((sel, i) => {
        if (overlayRules[i]) return true;
        if (!host || !sel) return false;
        try {
          const el = document.querySelector(sel);
          return !!(el && (host === el || host.contains(el)));
        } catch {
          return false;
        }
      });
    }, {
      index: surface.index,
      selectors: candidates.map((finding) => finding.selector || ""),
      overlayRules: candidates.map((finding) => String(finding.ruleId || "").startsWith("overlays.")),
    })
    .catch(() => candidates.map((finding) => String(finding.ruleId || "").startsWith("overlays.")));
  candidates.forEach((finding, i) => {
    const overlayRule = String(finding.ruleId || "").startsWith("overlays.");
    if (!flags[i] && !overlayRule) return;
    const key = findingKey(finding);
    if (seenKeys && seenKeys.has(key)) return;
    if (seenKeys) seenKeys.add(key);
    findings.push({
      ...finding,
      element: `${finding.element || finding.message} [${surface.kind}: ${surface.name}]`,
      message: `${finding.message} (${surface.kind} "${surface.name}")`,
    });
  });
  return findings;
}

async function clickSafeMenuItem(page) {
  const ready = await page
    .evaluate(() => {
      document.querySelectorAll("[data-audit-menu-item]").forEach((el) => el.removeAttribute("data-audit-menu-item"));
      const items = [...document.querySelectorAll("[role=menuitem], .p-menuitem-link, .p-menu-item-link")];
      const match = items.find((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (style.display === "none" || rect.width < 8 || rect.height < 8) return false;
        const text = (el.innerText || "").replace(/\s+/g, " ").trim();
        if (!text || text.length > 48) return false;
        if (/delete|remove|logout|export|download|print|save|submit|void|refund|archive|disable/i.test(text)) return false;
        if (!/view|edit|detail|add|open|create|new|filter|column|preview|info|manage/i.test(text)) return false;
        const href = el.getAttribute("href") || "";
        if (href && href !== "#" && !href.startsWith("javascript")) return false;
        el.setAttribute("data-audit-menu-item", "1");
        return true;
      });
      return !!match;
    })
    .catch(() => false);
  if (!ready) return false;
  return page.locator("[data-audit-menu-item='1']").click({ timeout: 3000 }).then(() => true).catch(() => false);
}

async function auditOpenedSurfaces(page, entry, seenKeys, stats, options = {}) {
  const extras = [];
  if (!stats || stats.opened.length >= MAX_OVERLAYS_PER_PAGE) return extras;
  const limit = options.limit || 4;
  try {
  return await auditOpenedSurfacesBody(page, entry, seenKeys, stats, { ...options, limit }, extras);
  } finally {
    if (!options.rootSelector) page.__uxAllowExtraPages = false;
  }
}

/** Add one component-coverage map into another ({ kind: { found, probed, failed } }). */
function mergeCoverage(into, add) {
  for (const [kind, c] of Object.entries(add || {})) {
    const t = (into[kind] = into[kind] || { found: 0, probed: 0, failed: 0 });
    t.found += c.found;
    t.probed += c.probed;
    t.failed += c.failed;
  }
  return into;
}

async function auditOpenedSurfacesBody(page, entry, seenKeys, stats, options, extras) {
  const limit = options.limit || 4;
  const triggers = await listOverlayTriggers(page, limit, options.rootSelector || "");
  if (process.env.UX_DEBUG) console.log('[ux-debug] triggers', JSON.stringify(triggers));
  for (const trigger of triggers) {
    if (stats.opened.length >= MAX_OVERLAYS_PER_PAGE) break;
    let originPath = "";
    try {
      originPath = new URL(page.url()).pathname;
    } catch {
      break;
    }
    const before = await readOpenSurfaces(page);
    page.__uxAllowExtraPages = true;
    let popup = null;
    const onPopup = (next) => {
      popup = next;
    };
    page.on("popup", onPopup);
    const clicked = await page
      .locator(`[data-audit-overlay-trigger="${trigger.index}"]`)
      .click({ timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (clicked) await page.waitForTimeout(450);
    page.off("popup", onPopup);
    if (!clicked) continue;
    let pathNow = originPath;
    try {
      pathNow = new URL(page.url()).pathname;
    } catch {
      pathNow = originPath;
    }
    if (pathNow !== originPath) {
      if (popup && !popup.isClosed()) await popup.close().catch(() => {});
      await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
      break;
    }
    if (popup && !popup.isClosed()) {
      recordOpenedSurface(stats, "popup", trigger.name || "popup", entry);
      try {
        const result = await uiAudit(popup, {
          pageName: `${entry.hub || ""} ${entry.name || ""} popup ${trigger.name}`.trim(),
          viewport: { width: 1440, height: 900 },
          writeReport: false,
        });
        for (const finding of result.findings || []) {
          if (!isOverlayUiFinding(finding)) continue;
          const key = findingKey(finding);
          if (seenKeys && seenKeys.has(key)) continue;
          if (seenKeys) seenKeys.add(key);
          extras.push({
            ...finding,
            element: `${finding.element || finding.message} [popup: ${trigger.name}]`,
            message: `${finding.message} (popup "${trigger.name}")`,
          });
        }
      } catch (error) {
        extras.push(
          specFinding({
            ruleId: "design.validation.dialog-open",
            element: `popup "${trigger.name}"`,
            message: `UI audit could not run on popup "${trigger.name}"`,
            expected: "audit completes in the popup window",
            actual: error.message,
          }),
        );
      }
      await popup.close().catch(() => {});
      continue;
    }
    let after = await readOpenSurfaces(page);
    let fresh = after.filter((surface) => !before.some((prev) => prev.key === surface.key));
    if (fresh.length && fresh.every((surface) => surface.kind === "menu") && !options.rootSelector) {
      const openedItem = await clickSafeMenuItem(page);
      if (openedItem) {
        await page.waitForTimeout(400);
        after = await readOpenSurfaces(page);
        fresh = after.filter((surface) => !before.some((prev) => prev.key === surface.key));
      }
    }
    const surface = fresh.find((item) => item.kind === "modal" || item.kind === "sidebar" || item.kind === "popup");
    if (!surface) {
      await dismissOpenSurfaces(page);
      continue;
    }
    surface.name = surface.name || trigger.name || surface.kind;
    recordOpenedSurface(stats, surface.kind, surface.name, entry);
    extras.push(...(await auditSurfaceUi(page, entry, surface, seenKeys)));
    if (surface.noRole) {
      extras.push(specFinding({
        ruleId: "overlays.modal-missing-role",
        element: `modal "${surface.name}"`,
        selector: `[data-audit-open-surface="${surface.index}"]`,
        message: `Modal "${surface.name}" has no role="dialog" / aria-modal, so screen readers do not announce it or keep focus in it`,
        expected: 'role="dialog" aria-modal="true" with an accessible name',
        actual: "plain <div> overlay",
      }));
    }
    // Components inside the dialog / sidebar (where the forms' inputs live) + empty-submit validation.
    const surfaceComponents = await auditComponents(page, {
      rootSelector: `[data-audit-open-surface="${surface.index}"]`,
      surfaceName: `${surface.kind}: ${surface.name}`,
      formProbe: UX_READ_ONLY,
    }).catch(() => ({ findings: [], coverage: {} }));
    extras.push(...surfaceComponents.findings);
    mergeCoverage((stats.componentCoverage = stats.componentCoverage || {}), surfaceComponents.coverage);
    if (!options.rootSelector && stats.opened.length < MAX_OVERLAYS_PER_PAGE) {
      const nested = await listOverlayTriggers(page, 2, `[data-audit-open-surface="${surface.index}"]`);
      if (nested.length) {
        extras.push(
          ...(await auditOpenedSurfaces(page, entry, seenKeys, stats, {
            limit: 2,
            rootSelector: `[data-audit-open-surface="${surface.index}"]`,
          })),
        );
      }
    }
    await dismissOpenSurfaces(page);
    // A modal with no close control (or a custom one Esc does not close) would block every later
    // trigger: start over from a fresh load and re-tag the triggers (same order, same indices).
    const stuck = await page.locator('[data-audit-open-surface="' + surface.index + '"]').first().isVisible().catch(() => false);
    if (stuck && !options.rootSelector) {
      await page.goto(page.url(), { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
      await waitForAdminUiReady(page).catch(() => {});
      await listOverlayTriggers(page, limit, '');
    }
  }
  if (!options.rootSelector && (stats.rowProbes || 0) < 2 && stats.opened.length < MAX_OVERLAYS_PER_PAGE) {
    stats.rowProbes = (stats.rowProbes || 0) + 1;
    extras.push(...(await probeTableDetail(page, entry, seenKeys, stats)));
  }
  if (!options.rootSelector) page.__uxAllowExtraPages = false;
  return extras;
}

async function probeTableDetail(page, entry, seenKeys, stats) {
  const extras = [];
  const cell = page.locator("table tbody tr td").nth(1);
  if (!(await cell.isVisible().catch(() => false))) return extras;
  let originPath = "";
  try {
    originPath = new URL(page.url()).pathname;
  } catch {
    return extras;
  }
  const before = await readOpenSurfaces(page);
  const clicked = await cell.click({ timeout: 3000 }).then(() => true).catch(() => false);
  if (!clicked) return extras;
  await page.waitForTimeout(500);
  let pathNow = originPath;
  try {
    pathNow = new URL(page.url()).pathname;
  } catch {
    pathNow = originPath;
  }
  if (pathNow !== originPath) {
    await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
    return extras;
  }
  const after = await readOpenSurfaces(page);
  const surface = after.find(
    (item) =>
      (item.kind === "modal" || item.kind === "sidebar" || item.kind === "popup") &&
      !before.some((prev) => prev.key === item.key),
  );
  if (!surface) {
    await dismissOpenSurfaces(page);
    return extras;
  }
  surface.name = surface.name || "row detail";
  recordOpenedSurface(stats, surface.kind, surface.name, entry);
  extras.push(...(await auditSurfaceUi(page, entry, surface, seenKeys)));
  await dismissOpenSurfaces(page);
  return extras;
}

async function runFullUxAudit(page, entry, reportFlowIssue, captureIssueScreenshot) {
  const captureShot =
    typeof captureIssueScreenshot === "function"
      ? captureIssueScreenshot
      : defaultCaptureShot;

  const t0 = Date.now();
  const lap = (label) => console.log(`[ux-audit] timing ${entry.path || entry.name}: ${label} ${Math.round((Date.now() - t0) / 1000)}s`);
  await waitForAdminUiReady(page);
  // Dark first, always: currenttheme persists in localStorage, so a page is otherwise audited in
  // whatever theme the previous spec happened to leave behind. auditOtherTheme() runs light after.
  await setTheme(page, "dark").catch((error) => {
    console.log(`[ux-audit] theme on ${entry.path || entry.name}: could not force dark — ${error.message}`);
  });
  const reportDir = path.join(
    process.cwd(),
    // Outside test-results/ (Playwright empties that on every run), so partial re-runs merge.
    "ux-audit-report",
    // hub + name: many hubs have a page called "Dashboard".
    `${entry.hub || ""} ${entry.name || entry.path || "page"}`.trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-"),
  );
  const result = await uiAudit(page, {
    pageName: `${entry.hub || ""} ${entry.name || ""}`.trim() || entry.path,
    viewport: { width: 1440, height: 900 },
    writeReport: true,
    reportDir,
  });

  lap("rules");
  const prefix = entry.stepPrefix || "UX";
  const reported = [];

  async function publishFindings(list, shotTag) {
    const capped = list.slice(0, 60 - reported.length);
    if (!capped.length) return;
    let pageFallbackShot = "";
    pageFallbackShot = await captureShot(page, `${prefix}-05-${shotTag}`, null, {
      force: true,
    });
    for (const finding of capped) {
      const index = reported.length + 1;
      const issueId = `${prefix}-05-${String(index).padStart(2, "0")}-${String(
        finding.ruleId || "rule",
      ).replace(/[^a-z0-9.-]+/gi, "-")}`;
      const priorShot = finding.evidence && (finding.evidence.clip || finding.evidence.screenshot);
      let screenshotFile = (shotTag === "interaction" && priorShot) || pageFallbackShot || "";
      if (shotTag !== "interaction" && finding.selector) {
        const elShot = await captureShot(page, issueId, finding.selector);
        if (elShot) screenshotFile = elShot;
      }
      const ref = referenceForFinding(finding);
      const referenceId = finding.referenceId || ref?.componentId || "";
      const referenceShot = ref?.inventoryRel || "";
      const payload = {
        id: issueId,
        step: `${prefix}-05`,
        title: `${finding.ruleId}: ${finding.element || finding.message}`,
        severity: finding.severity || "major",
        marker: "[UX]",
        ruleId: finding.ruleId || "",
        pagePath: entry.path || "",
        pageName: `${entry.hub || ""} / ${entry.name || ""}`.trim(),
        expected: finding.expected || ref?.expected || "",
        actual: finding.actual || "",
        selector: finding.selector || "",
        referenceId: referenceId || undefined,
        referenceShot: referenceShot || undefined,
        screenshotFile: screenshotFile || undefined,
        evidence: [
          finding.message,
          `Expected: ${finding.expected || ref?.expected || ""}`,
          `Actual: ${finding.actual || ""}`,
          finding.selector ? `Selector: ${finding.selector}` : "",
          entry.path ? `Page: ${entry.path}` : "",
          referenceId ? `Reference: ${referenceId}` : "",
          referenceShot ? `Reference shot: ${referenceShot}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      };
      await reportFlowIssue(payload);
      reported.push(payload);
    }
  }

  const pageFindings = (result.findings || [])
    .filter(isUxFinding)
    .sort((a, b) => {
      const rank = (item) => (String(item.ruleId || "").startsWith("design.validation.") ? 0 : 1);
      return rank(a) - rank(b);
    });
  await publishFindings(pageFindings, "page");

  const seenFindingKeys = new Set(pageFindings.map((finding) => findingKey(finding)));
  // Every component kind on the page: static checks + safe probes (lib/ui-audit/components.js).
  const pageUrl = page.url();
  const reloadPage = async () => {
    await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
    await waitForAdminUiReady(page).catch(() => {});
    // A reload drops whatever state the spec set up before auditing (the dashboard's date range
    // resets to Today), which would audit the reloaded passes against a different page than the
    // first one. entry.prepare lets a spec put it back.
    if (typeof entry.prepare === "function") {
      await entry.prepare(page).catch((error) => {
        console.log(`[ux-audit] prepare on ${entry.path || entry.name} failed: ${error.message}`);
      });
    }
  };
  // Start from a fresh load: the rule pass can leave a custom (non-PrimeReact) modal open over the page.
  await reloadPage();
  const components = await auditComponents(page, {
    reportDir,
    reload: reloadPage,
  }).catch((err) => ({ findings: [], coverage: {}, error: String(err && err.message) }));
  lap("components");
  const pageCoverageLine = Object.entries(components.coverage || {})
    .filter(([, c]) => c.found)
    .map(([kind, c]) => `${kind} ${c.found}/${c.probed}${c.failed ? `!${c.failed}` : ""}`)
    .join(", ");
  console.log(`[ux-audit] components on ${entry.path || entry.name}: ${pageCoverageLine || "(none)"} (found/probed!failed)`);
  const overlayStats = emptyOverlayStats();
  const interactionFindings = [
    ...components.findings,
    ...(await auditOpenedSurfaces(page, entry, seenFindingKeys, overlayStats, { limit: 6 }).catch(() => [])),
    ...(lap("overlays"), []),
    ...(UX_SIDE_MENU ? await auditSideMenuPages(page, entry, seenFindingKeys, overlayStats).catch(() => []) : []),
    ...(await auditInactiveTabs(page, entry, seenFindingKeys, overlayStats).catch(() => [])),
    ...(lap("tabs"), []),
    ...(await auditOtherTheme(page, entry, reloadPage).catch(() => [])),
    ...(lap("light theme"), []),
  ].filter((finding) => isUxFinding(finding) || /^(overlays|components)\./.test(String(finding.ruleId || "")));
  // User actions that failed earlier on this page (runUserActionSteps) are findings too.
  for (const f of page.__uxActionFailures || []) {
    interactionFindings.push(
      specFinding({
        ruleId: "interaction.user-action",
        severity: "major",
        element: `${f.action.type} "${f.action.name}"`,
        message: `User action ${f.id} failed: ${f.error}`,
        expected: "The control responds and the page can return to where it was",
        actual: f.error,
      }),
    );
  }
  page.__uxActionFailures = [];
  await publishFindings(interactionFindings, "interaction");
  console.log(
    `[ux-audit] overlays on ${entry.path || entry.name}: ${overlayStats.modals} modal, ${overlayStats.popups} popup, ${overlayStats.sidebars} sidebar`,
  );
  stampOverlayCounts(reportDir, overlayStats);
  const dialogCoverage = overlayStats.componentCoverage || {};
  const dialogLine = Object.entries(dialogCoverage)
    .filter(([, c]) => c.found)
    .map(([kind, c]) => `${kind} ${c.found}/${c.probed}${c.failed ? `!${c.failed}` : ""}`)
    .join(", ");
  console.log(`[ux-audit] components in dialogs on ${entry.path || entry.name}: ${dialogLine || "(none)"}`);
  components.coverage = mergeCoverage(mergeCoverage({}, components.coverage), dialogCoverage);
  try {
    fs.writeFileSync(path.join(reportDir, "component-coverage.json"), JSON.stringify(components.coverage, null, 2));
  } catch {
    // reporting must never break the audit
  }

  const findings = [...pageFindings, ...interactionFindings];
  try {
    fs.writeFileSync(path.join(reportDir, "findings.json"), JSON.stringify(findings, null, 2));
  } catch {
    // reporting must never break the audit
  }

  if (findings.length) {
    const counts = {};
    for (const finding of findings) {
      counts[finding.ruleId] = (counts[finding.ruleId] || 0) + 1;
    }
    const summary = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([id, n]) => `${id} (${n})`)
      .join(", ");
    const err = new Error(
      `${entry.hub || "Page"} / ${entry.name || entry.path} UI audit found ${findings.length} issue(s): ${summary}. Overlays opened: ${overlayStats.modals} modal, ${overlayStats.popups} popup, ${overlayStats.sidebars} sidebar`,
    );
    err.uxFindings = reported;
    err.uxFindingCount = findings.length;
    err.overlayStats = overlayStats;
    err.componentCoverage = components.coverage;
    throw err;
  }

  return { ...result, reportedIssues: reported, overlayStats, componentCoverage: components.coverage };
}

function overlayCell(row) {
  const parts = [];
  if (row.modals) parts.push(`${row.modals} modal`);
  if (row.popups) parts.push(`${row.popups} popup`);
  if (row.sidebars) parts.push(`${row.sidebars} sidebar`);
  return parts.join(", ") || "0";
}

function writeBatchSummary(rows, outDir, allIssues = []) {
  fs.mkdirSync(outDir, { recursive: true });
  const opened = rows.flatMap((row) =>
    (row.opened || []).map((item) => ({
      kind: item.kind,
      name: item.name,
      path: item.path || row.path || "",
      page: row.name || "",
      hub: row.hub || "",
    })),
  );
  const summary = {
    generatedAt: new Date().toISOString(),
    pages: rows.length,
    audited: rows.filter((row) => row.status === "audited").length,
    failedOpen: rows.filter((row) => row.status === "error").length,
    findings: rows.reduce((sum, row) => sum + (row.findings || 0), 0),
    modals: rows.reduce((sum, row) => sum + (row.modals || 0), 0),
    popups: rows.reduce((sum, row) => sum + (row.popups || 0), 0),
    sidebars: rows.reduce((sum, row) => sum + (row.sidebars || 0), 0),
    opened,
    rows,
  };
  fs.writeFileSync(path.join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  const lines = [
    `# UX Audit Batch Summary`,
    "",
    `- Modals opened: ${summary.modals}`,
    `- Popups opened: ${summary.popups}`,
    `- Sliding sidebars opened: ${summary.sidebars}`,
    "",
    `- Pages: ${summary.pages}`,
    `- Audited: ${summary.audited}`,
    `- Open errors: ${summary.failedOpen}`,
    `- Findings: ${summary.findings}`,
    "",
    "| Hub | Page | Path | Status | Findings | Overlays |",
    "|---|---|---|---|---|---|",
    ...rows.map(
      (row) =>
        `| ${row.hub} | ${row.name} | ${row.path} | ${row.status} | ${row.findings || 0} | ${overlayCell(row)} |`,
    ),
    "",
    `## Overlays opened`,
    "",
    opened.length
      ? [
          `| Page | Kind | Name |`,
          `|---|---|---|`,
          ...opened.slice(0, 80).map((item) => `| ${item.path || item.page} | ${item.kind} | ${item.name} |`),
          opened.length > 80 ? `| … | | ${opened.length - 80} more |` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "None opened.",
    "",
  ];
  fs.writeFileSync(path.join(outDir, "SUMMARY.md"), `${lines.join("\n")}\n`);
  writePatternRollup(allIssues, rows, outDir);
  return summary;
}

function writePatternRollup(allIssues, rows, outDir) {
  const byRule = {};
  const byPage = {};
  for (const issue of allIssues) {
    const rule = issue.ruleId || "unknown";
    byRule[rule] = byRule[rule] || [];
    byRule[rule].push(issue);
    const page = issue.pagePath || issue.pageName || "unknown";
    byPage[page] = byPage[page] || [];
    byPage[page].push(issue);
  }
  const ruleRank = Object.entries(byRule).sort((a, b) => b[1].length - a[1].length);
  const pageRank = Object.entries(byPage).sort((a, b) => b[1].length - a[1].length);

  const bySignature = {};
  for (const issue of allIssues) {
    const signature = [issue.ruleId || "unknown", issue.expected || "", issue.actual || ""]
      .join(" | ")
      .replace(/\s+/g, " ")
      .slice(0, 220);
    if (!bySignature[signature]) {
      bySignature[signature] = { issue, pages: new Set() };
    }
    bySignature[signature].pages.add(issue.pagePath || issue.pageName || "unknown");
  }
  const uniqueRank = Object.entries(bySignature).sort((a, b) => b[1].pages.size - a[1].pages.size || b[1].pages.size - a[1].pages.size);

  const modals = rows.reduce((sum, row) => sum + (row.modals || 0), 0);
  const popups = rows.reduce((sum, row) => sum + (row.popups || 0), 0);
  const sidebars = rows.reduce((sum, row) => sum + (row.sidebars || 0), 0);
  const lines = [
    `# UX Audit Pattern Rollup`,
    "",
    `Generated: ${new Date().toISOString()}`,
    `Modals opened: ${modals}`,
    `Popups opened: ${popups}`,
    `Sliding sidebars opened: ${sidebars}`,
    `Total reported issues: ${allIssues.length}`,
    `Unique issues: ${uniqueRank.length}`,
    `Pages in batch: ${rows.length}`,
    "",
    `## Unique issues`,
    "",
    `Repeated copies of the same rule, expected value, and actual value are one row. Page count is how many pages still show it.`,
    "",
    `| Rule | Pages | Expected | Actual | Sample |`,
    `|---|---:|---|---|---|`,
    ...uniqueRank.slice(0, 40).map(([, group]) => {
      const sample = group.issue || {};
      const expected = String(sample.expected || "").replace(/\|/g, "/").slice(0, 80);
      const actual = String(sample.actual || "").replace(/\|/g, "/").slice(0, 80);
      return `| ${sample.ruleId || "unknown"} | ${group.pages.size} | ${expected} | ${actual} | ${sample.pagePath || sample.pageName || "—"} |`;
    }),
    "",
    `## Top broken patterns (by rule)`,
    "",
    `| Rule | Count | Reference | Sample page |`,
    `|---|---:|---|---|`,
    ...ruleRank.slice(0, 20).map(([rule, list]) => {
      const sample = list[0] || {};
      return `| ${rule} | ${list.length} | ${sample.referenceId || "—"} | ${sample.pagePath || sample.pageName || "—"} |`;
    }),
    "",
    `## Page hotspots`,
    "",
    `| Page | Findings | Top rule |`,
    `|---|---:|---|`,
    ...pageRank.slice(0, 20).map(([page, list]) => {
      const counts = {};
      for (const issue of list) counts[issue.ruleId || "unknown"] = (counts[issue.ruleId || "unknown"] || 0) + 1;
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      return `| ${page} | ${list.length} | ${top ? `${top[0]} (${top[1]})` : "—"} |`;
    }),
    "",
    `## Fix lanes`,
    "",
    `- **Theme / surface:** catalog.metric-card, design.content-card, design.chart, design.validation.title-color, design.validation.component-contrast`,
    `- **Alignment / spacing:** design.common-ux, design.date-pills, design.sidebar-nav, design.validation.table-layout, design.validation.section-spacing, design.validation.card-geometry`,
    `- **Control contract:** design.primary-button, design.dropdown, design.search-input, design.table, design.pill-tabs, design.tab-underline, design.validation.button-roles, design.validation.badges, design.validation.calendar`,
    "",
  ];
  fs.writeFileSync(path.join(outDir, "PATTERN_ROLLUP.md"), `${lines.join("\n")}\n`);
  fs.writeFileSync(
    path.join(outDir, "issues.json"),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), issues: allIssues }, null, 2)}\n`,
  );
}


const USER_ACTION_SKIP =
  /delete|remove|logout|sign out|log out|destroy|void|refund|deactivate|archive|disable|reset password|pay now|submit|save changes|^save$|^confirm$|^cancel$|^close$|^dismiss$/i;

async function listUserActions(page) {
  return page
    .evaluate((skipSource) => {
      const skip = new RegExp(skipSource, "i");
      window.scrollTo(0, 0);
      document.querySelectorAll("button, [role=button], a").forEach((el) => {
        const label = (el.innerText || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
        if (/^(columns|export|filter|filters|add|import|new|create)\b/i.test(label)) {
          el.scrollIntoView({ block: "center", inline: "nearest" });
        }
      });
      document.querySelectorAll("[data-user-action]").forEach((el) => el.removeAttribute("data-user-action"));
      const actions = [];
      const seen = new Set();
      const dateLabel =
        /^(today|yesterday|last 7 days|last 30 days|this week|this month|this year|custom|all time)$/i;

      function push(el, type, extra) {
        if (!el || actions.length >= 24) return;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return;
        if (rect.width < 16 || rect.height < 16) return;
        if (rect.right < 0 || rect.left > window.innerWidth) return;
        if (rect.bottom < -160 || rect.top > window.innerHeight + 160) return;
        const name = ((el.innerText || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim()).slice(0, 60);
        if (!name || name.length < 2 || skip.test(name) || /^\d+$/.test(name)) return;
        if (el.closest("[class*=paginator], [class*=pagination], [aria-label*=pagination i]")) return;
        const key = `${type}|${name}`;
        if (seen.has(key)) return;
        seen.add(key);
        const index = actions.length;
        el.setAttribute("data-user-action", String(index));
        actions.push({ index, name, type, ...(extra || {}) });
      }

      const side = document.querySelector('aside[aria-label="Home navigation"]');
      let returnTo = "";
      if (side) {
        const items = [...side.querySelectorAll("button")].filter((el) => {
          const rect = el.getBoundingClientRect();
          const text = (el.innerText || "").replace(/\s+/g, " ").trim();
          return rect.width >= 80 && rect.height >= 28 && rect.height <= 72 && text && text.length <= 48 && String(el.className || "").includes("tw-w-full");
        });
        const current = items.find((el) => el.getAttribute("aria-current") === "page");
        returnTo = current ? (current.innerText || "").replace(/\s+/g, " ").trim() : "";
        if (current) {
          items.filter((el) => el !== current).forEach((el) => push(el, "side-menu", { returnTo }));
        }
      }

      let selectedTab = "";
      [...document.querySelectorAll("[role=tab]")].forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width < 24 || rect.height < 20) return;
        if (el.getAttribute("aria-selected") === "true") {
          selectedTab = ((el.innerText || "").replace(/\s+/g, " ").trim()).slice(0, 60);
        }
      });
      [...document.querySelectorAll("[role=tab]")].forEach((el) => {
        if (el.getAttribute("aria-selected") === "true") return;
        if (el.closest("aside[aria-label='Home navigation']")) return;
        push(el, "tab", { returnTo: selectedTab });
      });

      const nodes = [...document.querySelectorAll("button, [role=button], a")];
      nodes.forEach((el) => {
        if (el.closest("aside[aria-label='Home navigation'], .p-paginator, [role=tablist], tbody")) return;
        const name = ((el.innerText || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim());
        if (el.closest("thead") && !/columns|export|filter|add|import|create/i.test(name)) return;
        const rect = el.getBoundingClientRect();
        if (rect.x < 260 && el.closest("aside, nav")) return;
        if (rect.top >= 0 && rect.top < 64 && rect.x > window.innerWidth - 520) return;
        if (dateLabel.test(name)) return;
        if (el.tagName === "A") {
          const href = el.getAttribute("href") || "";
          if (!href || href === "#" || href.startsWith("javascript")) return;
        }
        push(el, el.tagName === "A" ? "link" : "button");
      });

      const cell = document.querySelector("table tbody tr td:nth-child(2), [role=row] [role=gridcell]:nth-child(2)");
      if (cell) push(cell, "row", { name: "first row" });
      return actions;
    }, USER_ACTION_SKIP.source)
    .catch(() => []);
}

async function returnToOrigin(page, originPath) {
  let pathNow = "";
  try {
    pathNow = new URL(page.url()).pathname;
  } catch {
    pathNow = "";
  }
  if (pathNow === originPath) return;
  await page.goBack({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
  try {
    pathNow = new URL(page.url()).pathname;
  } catch {
    pathNow = "";
  }
  if (pathNow !== originPath) {
    await page.goto(new URL(originPath, page.url()).href, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
  }
  await waitForAdminUiReady(page).catch(() => {});
  const backPath = new URL(page.url()).pathname;
  if (backPath !== originPath) {
    throw new Error(`Did not return to ${originPath}. Still on ${backPath}`);
  }
}

async function performUserAction(page, action) {
  const originPath = new URL(page.url()).pathname;
  let live = await listUserActions(page);
  let match = live.find((item) => item.type === action.type && item.name === action.name);
  if (!match && action.type === "row") {
    await page
      .waitForFunction(() => {
        const cell = document.querySelector("table tbody tr td:nth-child(2)");
        return !!cell && (cell.innerText || "").replace(/\s+/g, " ").trim().length > 1;
      }, { timeout: 8000 })
      .catch(() => {});
  }
  if (!match) {
    await page.waitForTimeout(700);
    live = await listUserActions(page);
    match = live.find((item) => item.type === action.type && item.name === action.name);
  }
  if (!match) {
    throw new Error(`Action is not on the page: ${action.type} "${action.name}"`);
  }
  page.__uxAllowExtraPages = true;
  let popup = null;
  const onPopup = (next) => {
    popup = next;
  };
  page.on("popup", onPopup);
  const trigger = page.locator(`[data-user-action="${match.index}"]`);
  const placed = await trigger
    .evaluate((el) => {
      let node = el.parentElement;
      while (node && node !== document.documentElement) {
        if (node.scrollTop > 0) node.scrollTop = 0;
        if (node.scrollLeft > 0) node.scrollLeft = 0;
        node = node.parentElement;
      }
      window.scrollTo(0, 0);
      el.scrollIntoView({ block: "center", inline: "nearest" });
      const rect = el.getBoundingClientRect();
      const visible =
        rect.width > 8 &&
        rect.height > 8 &&
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth;
      return visible;
    })
    .catch(() => false);
  let clickError = "";
  let clicked = false;
  if (placed) {
    clicked = await trigger
      .click({ timeout: 5000 })
      .then(() => true)
      .catch((error) => {
        clickError = error.message;
        return false;
      });
  }
  if (!clicked) {
    clicked = await trigger
      .evaluate((el) => {
        el.click();
        return true;
      })
      .catch((error) => {
        clickError = error.message;
        return false;
      });
  }
  if (!clicked) {
    await page.waitForTimeout(500);
    live = await listUserActions(page);
    match = live.find((item) => item.type === action.type && item.name === action.name);
    if (match) {
      clicked = await page
        .locator(`[data-user-action="${match.index}"]`)
        .click({ timeout: 5000 })
        .then(() => true)
        .catch(() => false);
    }
  }
  if (clicked) await page.waitForTimeout(600);
  page.off("popup", onPopup);
  page.__uxAllowExtraPages = false;
  if (!clicked) throw new Error(`Click failed for ${action.type} "${action.name}": ${clickError.slice(0, 180)}`);

  if (popup && !popup.isClosed()) {
    const text = await popup.locator("body").innerText().catch(() => "");
    if (!text || text.trim().length < 2) throw new Error(`Popup for "${action.name}" was empty`);
    await popup.close().catch(() => {});
    await returnToOrigin(page, originPath);
    return { result: "popup" };
  }

  let pathNow = originPath;
  try {
    pathNow = new URL(page.url()).pathname;
  } catch {
    pathNow = originPath;
  }
  if (pathNow !== originPath) {
    await waitForAdminUiReady(page).catch(() => {});
    if (/signin|\/login/i.test(page.url())) throw new Error(`"${action.name}" sent the browser to login`);
    const text = await page.locator("body").innerText().catch(() => "");
    if (!text || text.trim().length < 20) throw new Error(`"${action.name}" opened a blank page`);
    await returnToOrigin(page, originPath);
    return { result: "navigated-back", to: pathNow };
  }

  const surfaces = await readOpenSurfaces(page);
  const surface = surfaces.find((item) => item.kind === "modal" || item.kind === "sidebar" || item.kind === "popup");
  if (surface) {
    const text = await page.locator(`[data-audit-open-surface="${surface.index}"]`).innerText().catch(() => "");
    if (!text || text.trim().length < 2) throw new Error(`${surface.kind} opened by "${action.name}" was empty`);
    await dismissOpenSurfaces(page);
    await returnToOrigin(page, originPath);
    return { result: surface.kind, name: surface.name || action.name };
  }

  if (action.type === "side-menu") {
    const menu = await readPageSideMenu(page);
    const current = menu.find((item) => item.current);
    if (!current || current.name !== action.name) {
      throw new Error(`Side menu "${action.name}" did not become the current view`);
    }
    if (action.returnTo) {
      const back = await listUserActions(page);
      const home = back.find((item) => item.type === "side-menu" && item.name === action.returnTo);
      if (home) {
        await page.locator(`[data-user-action="${home.index}"]`).click({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(400);
      }
    }
    await returnToOrigin(page, originPath);
    return { result: "side-menu" };
  }

  if (action.type === "tab") {
    // Any VISIBLE selected tab (pages can hold several tab lists); the switch may land a moment later.
    const want = action.name.slice(0, 24);
    const isSelected = () =>
      page
        .evaluate((name) =>
          [...document.querySelectorAll("[role=tab][aria-selected=true]")].some((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && (el.innerText || "").replace(/\s+/g, " ").trim().includes(name);
          }), want)
        .catch(() => false);
    let ok = await isSelected();
    for (let i = 0; !ok && i < 10; i += 1) {
      await page.waitForTimeout(300);
      ok = await isSelected();
    }
    if (!ok) throw new Error(`Tab "${action.name}" did not become selected`);
    if (action.returnTo) {
      const back = await listUserActions(page);
      const home = back.find((item) => item.type === "tab" && item.name === action.returnTo);
      if (home) {
        await page.locator(`[data-user-action="${home.index}"]`).click({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(300);
      }
    }
    return { result: "tab" };
  }

  await returnToOrigin(page, originPath);
  return { result: "clicked" };
}

function userActionTitle(action) {
  if (action.type === "side-menu") {
    return `Open side menu "${action.name}", check that view, and return to ${action.returnTo || "the previous view"}`;
  }
  if (action.type === "tab") {
    return `Open tab "${action.name}", check it, and return to ${action.returnTo || "the previous tab"}`;
  }
  if (action.type === "row") {
    return "Open the first row, check it, and return to this page";
  }
  if (action.type === "link") {
    return `Open link "${action.name}", check that page, and return to this page`;
  }
  return `Click "${action.name}", check what opens, and return to this page`;
}

async function runUserActionSteps(page, entry, soft) {
  // Side-menu entries are other pages with their own audit spec: walk them only with UX_SIDE_MENU=1.
  const actions = (await listUserActions(page)).filter((a) => UX_SIDE_MENU || a.type !== "side-menu");
  const prefix = entry.stepPrefix || "UX";
  const typeOrder = { button: 0, link: 1, tab: 2, row: 3, "side-menu": 4 };
  actions.sort((a, b) => (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9));
  console.log(
    `[ux-audit] action list on ${entry.path || entry.name}: ${actions.map((item) => `${item.type}:${item.name}`).join(" | ") || "(none)"}`,
  );
  if (!actions.length) {
    await soft(`${prefix}-05A`, `No further user actions on ${entry.name || "this page"}`, async () => {});
    return [];
  }
  const outcomes = [];
  // A failing action is shown as failed in the live steps but does NOT stop the page: it becomes an
  // `interaction.user-action` finding that runFullUxAudit reports (and fails on) at the end.
  page.__uxActionFailures = page.__uxActionFailures || [];
  for (let i = 0; i < actions.length; i += 1) {
    const action = actions[i];
    const id = `${prefix}-05A-${String(i + 1).padStart(2, "0")}`;
    try {
      await soft(id, userActionTitle(action), async () => {
        const outcome = await performUserAction(page, action);
        outcomes.push({ ...action, outcome: outcome.result });
      });
    } catch (err) {
      outcomes.push({ ...action, outcome: "failed" });
      page.__uxActionFailures.push({ id, action, error: String((err && err.message) || err).slice(0, 300) });
      await returnToOrigin(page, new URL(entry.path, BASE_URL).pathname).catch(() => {});
    }
  }
  console.log(
    `[ux-audit] user actions on ${entry.path || entry.name}: ${outcomes.map((item) => `${item.name}=${item.outcome}`).join(", ")}`,
  );
  return outcomes;
}

async function collectAppRoutes(page) {
  return page
    .evaluate(() => {
      const routes = [];
      const seen = new Set();
      document.querySelectorAll("a[href]").forEach((el) => {
        const href = el.getAttribute("href") || "";
        if (!href.startsWith("/") || href.startsWith("//")) return;
        const path = href.split("?")[0].split("#")[0];
        if (!path || path === "/" || seen.has(path)) return;
        const name = (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 60);
        if (!name || name.length < 2) return;
        seen.add(path);
        routes.push({ path, name });
      });
      return routes;
    })
    .catch(() => []);
}

module.exports = {
  openSignIn,
  signIn,
  openAdminPage,
  waitForAdminUiReady,
  selectDateRange,
  scrollThroughPage,
  waitForDataLoad,
  setTheme,
  readTheme,
  runFullUxAudit,
  runUserActionSteps,
  listUserActions,
  collectAppRoutes,
  writeBatchSummary,
  writePatternRollup,
  BASE_URL,
};
