const { expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { uiAudit } = require("../../../lib/ui-audit");
const { findingKey } = require("../../../lib/ui-audit/report");
const { getReference } = require("../../../lib/ui-audit/references");
const { captureIssueScreenshot: defaultCaptureShot } = require("../../helpers/flowStep");

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "https://admin.onechanneladmin.com";
const EMAIL = process.env.TEST_LOGIN_EMAIL || "admin@onechanneladmin.com";
const PASSWORD = process.env.TEST_LOGIN_PASSWORD || "";

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
  if (!isLoginUrl(page.url())) {
    await waitForAdminUiReady(page);
    if (!isLoginUrl(page.url())) return;
  }
  await performLogin(page);
}

async function openAdminPage(page, entry) {
  const target = new URL(entry.path, BASE_URL).href;
  await page.goto(target, { waitUntil: "domcontentloaded", timeout: 45000 });
  if (isLoginUrl(page.url())) {
    await performLogin(page);
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 45000 });
  }
  await waitForAdminUiReady(page);
  if (isLoginUrl(page.url())) {
    throw new Error(`Still on login after opening ${entry.path}: ${page.url()}`);
  }
  const pathOnly = String(entry.path || "").split("?")[0];
  await expect(page).toHaveURL(new RegExp(pathOnly.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
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

const THEME_RULES = new Set([
  "design.validation.title-color",
  "design.validation.component-contrast",
  "design.validation.scrollbar",
  "a11y.contrast",
  "forms.placeholder-contrast",
]);

function tableSpacingSignature(tables) {
  const rows = (tables || []).filter((table) => !table.hasEmptyMarker && (table.rowCount || 0) > 0);
  if (!rows.length) return null;
  const avg = (key) => rows.reduce((sum, table) => sum + (Number(table[key]) || 0), 0) / rows.length;
  return { topGap: avg("topGap"), insetLeft: avg("insetLeft"), insetRight: avg("insetRight") };
}

async function auditInactiveTabs(page, entry) {
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

async function auditSideMenuPages(page, entry, seenKeys) {
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
  }
  return extras;
}

async function auditOtherTheme(page, entry) {
  const extras = [];
  const toggle = page
    .locator(
      "[aria-label*='theme' i], [aria-label*='dark mode' i], [aria-label*='light mode' i], [data-testid*='theme' i]",
    )
    .first();
  const found = await toggle.count().catch(() => 0);
  if (!found) {
    if (entry && page) {
      extras.coverageTheme = "single-theme";
    }
    return extras;
  }
  const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor).catch(() => "");
  const clicked = await toggle.click({ timeout: 3000 }).then(() => true).catch(() => false);
  if (!clicked) {
    extras.push(
      specFinding({
        ruleId: "design.validation.theme-switch",
        element: "theme toggle",
        message: "Theme control did not respond",
        expected: "clicking the theme control switches mode",
        actual: "click failed",
      }),
    );
    return extras;
  }
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => getComputedStyle(document.body).backgroundColor).catch(() => "");
  if (!after || after === before) {
    extras.push(
      specFinding({
        ruleId: "design.validation.theme-switch",
        element: "theme toggle",
        message: "Theme control did not change the rendered theme",
        expected: "body background changes between light and dark mode",
        actual: `background stayed ${after || "unknown"}`,
      }),
    );
    return extras;
  }
  try {
    const result = await uiAudit(page, {
      pageName: `${entry.hub || ""} ${entry.name || ""}`.trim(),
      viewport: { width: 1440, height: 900 },
      writeReport: false,
    });
    const mode = (result.snapshot && result.snapshot.renderedTheme) || "other";
    for (const finding of result.findings || []) {
      if (!THEME_RULES.has(finding.ruleId)) continue;
      extras.push({
        ...finding,
        element: `${finding.element || finding.message} [${mode} mode]`,
        message: `${finding.message} (${mode} mode)`,
      });
    }
  } catch (error) {
    extras.push(
      specFinding({
        ruleId: "design.validation.theme-switch",
        element: "theme toggle",
        message: "Validation could not run after the theme switch",
        expected: "audit completes in the other theme",
        actual: error.message,
      }),
    );
  }
  await toggle.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);
  return extras;
}

async function probeDialog(page, entry) {
  const opener = page.locator("[aria-haspopup='dialog']").first();
  const found = await opener.count().catch(() => 0);
  if (!found) return [];
  const name = ((await opener.innerText().catch(() => "")) || "dialog trigger").replace(/\s+/g, " ").trim().slice(0, 40);
  const clicked = await opener.click({ timeout: 3000 }).then(() => true).catch(() => false);
  if (!clicked) {
    return [
      specFinding({
        ruleId: "design.validation.dialog-open",
        element: `dialog trigger "${name}"`,
        message: `Dialog trigger "${name}" did not respond`,
        expected: "click opens a modal",
        actual: "click failed",
      }),
    ];
  }
  await page.waitForTimeout(400);
  const dialog = page.locator("[role='dialog'], [role='alertdialog'], dialog").first();
  const open = await dialog.isVisible().catch(() => false);
  if (!open) {
    return [
      specFinding({
        ruleId: "design.validation.dialog-open",
        element: `dialog trigger "${name}"`,
        message: `Dialog trigger "${name}" did not open a modal`,
        expected: "a visible dialog after click",
        actual: "no dialog",
      }),
    ];
  }
  let extras = [];
  try {
    const result = await uiAudit(page, {
      pageName: `${entry.hub || ""} ${entry.name || ""} dialog`.trim(),
      viewport: { width: 1440, height: 900 },
      writeReport: false,
    });
    extras = (result.findings || []).filter(
      (finding) =>
        finding.ruleId === "design.validation.overlay-radius" ||
        finding.ruleId === "design.validation.title-color",
    );
  } catch (error) {
    extras = [
      specFinding({
        ruleId: "design.validation.dialog-open",
        element: `dialog "${name}"`,
        message: "Validation could not run on the open dialog",
        expected: "audit completes while the dialog is open",
        actual: error.message,
      }),
    ];
  }
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(200);
  return extras;
}

async function runFullUxAudit(page, entry, reportFlowIssue, captureIssueScreenshot) {
  const captureShot =
    typeof captureIssueScreenshot === "function"
      ? captureIssueScreenshot
      : defaultCaptureShot;

  await waitForAdminUiReady(page);
  const result = await uiAudit(page, {
    pageName: `${entry.hub || ""} ${entry.name || ""}`.trim() || entry.path,
    viewport: { width: 1440, height: 900 },
    writeReport: true,
    reportDir: path.join(
      process.cwd(),
      "test-results",
      "ux-audit-pages",
      String(entry.name || entry.path || "page")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-"),
    ),
  });

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
  const interactionFindings = [
    ...(await auditSideMenuPages(page, entry, seenFindingKeys).catch(() => [])),
    ...(await auditInactiveTabs(page, entry).catch(() => [])),
    ...(await auditOtherTheme(page, entry).catch(() => [])),
    ...(await probeDialog(page, entry).catch(() => [])),
  ].filter(isUxFinding);
  await publishFindings(interactionFindings, "interaction");

  const findings = [...pageFindings, ...interactionFindings];

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
      `${entry.hub || "Page"} / ${entry.name || entry.path} UI audit found ${findings.length} issue(s): ${summary}`,
    );
    err.uxFindings = reported;
    err.uxFindingCount = findings.length;
    throw err;
  }

  return { ...result, reportedIssues: reported };
}

function writeBatchSummary(rows, outDir, allIssues = []) {
  fs.mkdirSync(outDir, { recursive: true });
  const summary = {
    generatedAt: new Date().toISOString(),
    pages: rows.length,
    audited: rows.filter((row) => row.status === "audited").length,
    failedOpen: rows.filter((row) => row.status === "error").length,
    findings: rows.reduce((sum, row) => sum + (row.findings || 0), 0),
    rows,
  };
  fs.writeFileSync(path.join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  const lines = [
    `# UX Audit Batch Summary`,
    "",
    `- Pages: ${summary.pages}`,
    `- Audited: ${summary.audited}`,
    `- Open errors: ${summary.failedOpen}`,
    `- Findings: ${summary.findings}`,
    "",
    "| Hub | Page | Path | Status | Findings |",
    "|---|---|---|---|---|",
    ...rows.map(
      (row) =>
        `| ${row.hub} | ${row.name} | ${row.path} | ${row.status} | ${row.findings || 0} |`,
    ),
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

  const lines = [
    `# UX Audit Pattern Rollup`,
    "",
    `Generated: ${new Date().toISOString()}`,
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


module.exports = {
  openSignIn,
  signIn,
  openAdminPage,
  waitForAdminUiReady,
  runFullUxAudit,
  writeBatchSummary,
  writePatternRollup,
  BASE_URL,
};
