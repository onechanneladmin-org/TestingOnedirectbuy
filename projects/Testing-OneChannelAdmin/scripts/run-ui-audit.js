/**
 * Log in to One Channel Admin and audit one page per module in light and dark.
 * Password comes from TEST_LOGIN_PASSWORD and is never written to disk.
 *
 *   TEST_LOGIN_PASSWORD=... node scripts/run-ui-audit.js
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { uiAudit } = require("../lib/ui-audit");
const { compareThemes } = require("../lib/ui-audit/rules/audit-doc");
const { exitCodeFor } = require("../lib/ui-audit/exit-code");
const { summarize, writeReport } = require("../lib/ui-audit/report");

const BASE = process.env.PLAYWRIGHT_BASE_URL || "https://admin.onechanneladmin.com";
const EMAIL = process.env.TEST_LOGIN_EMAIL || "admin@onechanneladmin.com";
const VIEWPORT = { width: 1280, height: 720 };

const MODULES = [
  { name: "Dashboard", url: "/home/dashboard" },
  { name: "Fulfillment", url: "/fulfill/orders/fulfill-orders" },
  { name: "Channel", button: "Channel" },
  { name: "Catalog", button: "Catalog", child: "Products" },
  { name: "WMS", url: "/wms/orders" },
  { name: "Marketing", button: "Marketing" },
  { name: "CRM", button: "CRM" },
  { name: "Analytics", button: "Analytics & Reports" },
  { name: "B2B", url: "/b2b/order" },
  { name: "3PL", button: "3PL" },
  { name: "Admin", button: "Admin" },
  { name: "Accounting", button: "Accounting" },
];

const MENU_SKIP = new Set([
  "Toggle navigation",
  "Close",
  "Collapse home menu",
  "Home",
  "Dashboard",
  "Today",
  "Last 7 days",
  "This month",
  "This year",
  "Custom",
  "Export",
]);

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function login(page) {
  const password = process.env.TEST_LOGIN_PASSWORD || "";
  if (!password) throw new Error("TEST_LOGIN_PASSWORD is required");
  await page.goto(`${BASE}/signin?returnUrl=%2F`, { waitUntil: "domcontentloaded" });
  await page.getByRole("textbox", { name: "Email address" }).fill(EMAIL);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForURL((url) => !/signin|login/i.test(url.pathname), { timeout: 30000 });
}

async function openModule(page, module) {
  if (module.url) return module.url.startsWith("http") ? module.url : `${BASE}${module.url}`;
  await page.goto(`${BASE}/home/dashboard`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: module.button, exact: true }).click({ timeout: 8000 });
  await page.waitForTimeout(500);
  let child = module.child;
  if (!child) {
    child = await page.evaluate((skip) => {
      const ignored = new Set(skip);
      const labels = [...document.querySelectorAll("button")]
        .map((button) => button.innerText.replace(/\s+/g, " ").trim())
        .filter((text) => text && text.length < 40 && !ignored.has(text));
      return labels[0] || null;
    }, [...MENU_SKIP, module.button, module.button.toUpperCase()]);
  }
  if (!child) return null;
  await page.getByRole("button", { name: child, exact: true }).first().click({ timeout: 8000 });
  await page.waitForTimeout(1500);
  return page.url();
}

async function bodyLuminance(page) {
  return page.evaluate(() => {
    const style = getComputedStyle(document.body).backgroundColor;
    const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(style);
    if (!match) return 1;
    const r = Number(match[1]) / 255;
    const g = Number(match[2]) / 255;
    const b = Number(match[3]) / 255;
    const channel = (value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  });
}

async function setTheme(page, theme) {
  const wantDark = theme === "dark";
  const current = await bodyLuminance(page);
  const already = wantDark ? current <= 0.45 : current >= 0.62;
  if (already) return;
  const toggle = page.getByRole("button", { name: /dark|light|theme/i }).first();
  if (await toggle.count()) {
    await toggle.click().catch(() => {});
    await page.waitForTimeout(400);
  }
  const after = await bodyLuminance(page);
  const ok = wantDark ? after <= 0.45 : after >= 0.62;
  if (ok) return;
  await page.evaluate((next) => {
    document.documentElement.setAttribute("data-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.classList.toggle("light", next === "light");
    document.body.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
      localStorage.setItem("isLight", String(next === "light"));
    } catch {
      /* ignore */
    }
  }, theme);
  await page.waitForTimeout(300);
}

async function auditPage(page, pageName, theme, reportDir) {
  await setTheme(page, theme);
  const result = await uiAudit(page, {
    pageName: `${pageName} (${theme})`,
    theme,
    viewport: VIEWPORT,
    writeReport: false,
    reportDir,
  });
  return result;
}

async function main() {
  const root = path.join(process.cwd(), "test-results", "ui-audit", `live-${stamp()}`);
  fs.mkdirSync(root, { recursive: true });
  const browser = await chromium.launch({ headless: process.env.PW_HEADLESS !== "0" });
  const page = await browser.newPage({ viewport: VIEWPORT });
  const findings = [];
  const pages = [];
  try {
    await login(page);
    for (const module of MODULES) {
      let url;
      try {
        url = await openModule(page, module);
      } catch (error) {
        pages.push({
          name: module.name,
          status: "skipped",
          reason: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
      if (!url) {
        pages.push({ name: module.name, status: "skipped", reason: "no menu destination" });
        continue;
      }
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(1200);
        if (/signin|login/i.test(page.url())) {
          pages.push({ name: module.name, url, status: "skipped", reason: "redirected to sign-in" });
          continue;
        }
        if (module.name !== "Dashboard" && /\/home\/dashboard\/?$/.test(page.url())) {
          pages.push({ name: module.name, url: page.url(), status: "skipped", reason: "menu stayed on the dashboard" });
          continue;
        }
        const lightDir = path.join(root, `${module.name}-light`);
        const darkDir = path.join(root, `${module.name}-dark`);
        const light = await auditPage(page, module.name, "light", lightDir);
        const dark = await auditPage(page, module.name, "dark", darkDir);
        const drift = compareThemes(light.snapshot, dark.snapshot).map((finding) => ({
          ...finding,
          page: module.name,
          confidence: finding.confidence == null ? 0.55 : finding.confidence,
        }));
        findings.push(...light.findings, ...dark.findings, ...drift);
        pages.push({
          name: module.name,
          url: page.url(),
          status: "audited",
          light: light.findings.length,
          dark: dark.findings.length,
          drift: drift.length,
        });
        console.log(`[audit] ${module.name} light=${light.findings.length} dark=${dark.findings.length} drift=${drift.length}`);
      } catch (error) {
        pages.push({
          name: module.name,
          url,
          status: "error",
          reason: error instanceof Error ? error.message : String(error),
        });
        console.error(`[audit] ${module.name} failed:`, error instanceof Error ? error.message : error);
      }
    }
  } finally {
    await browser.close();
  }

  const exitCode = exitCodeFor(findings);
  const report = {
    page: "OneChannelAdmin live",
    url: BASE,
    theme: "light+dark",
    viewport: VIEWPORT,
    generatedAt: new Date().toISOString(),
    exitCode,
    summary: summarize(findings),
    pages,
    findings,
  };
  const written = writeReport(report, root);
  console.log(`[audit] report ${written.markdown}`);
  console.log(`[audit] exit ${exitCode} findings ${findings.length}`);
  process.exitCode = exitCode;
}

main().catch((error) => {
  console.error("[audit] Fatal:", error instanceof Error ? error.message : error);
  process.exit(1);
});
