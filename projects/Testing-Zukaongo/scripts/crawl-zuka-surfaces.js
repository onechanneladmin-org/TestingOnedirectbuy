/**
 * Crawl ZUKAongo surfaces per role and dump aria snapshots + screenshots.
 * Used to (re)discover selectors when the apps change.
 *
 * Usage:
 *   node scripts/crawl-zuka-surfaces.js [role ...] [--paths=/a,/b]
 *   roles: public customer admin kitchen grocery kitchenMulti driver
 * Output: docs/crawl/<role>/*.yml|png and docs/crawl/<role>.json
 */
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const { chromium } = require("@playwright/test");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "docs", "crawl");

const CUSTOMER = process.env.ZUKA_CUSTOMER_URL || "https://zukaongo.com";
const ADMIN = process.env.ZUKA_ADMIN_URL || "https://admin.zukaongo.com";
const PARTNER = process.env.ZUKA_PARTNER_URL || "https://drivers.zukaongo.com";
const TEST_PW = process.env.ZUKA_TEST_PASSWORD || "";

const ROLES = {
  public: { base: CUSTOMER, login: null },
  customer: {
    base: CUSTOMER,
    login: "/login",
    email: process.env.ZUKA_CUSTOMER_EMAIL || "test-customer@zuka.test",
    password: process.env.ZUKA_CUSTOMER_PASSWORD || TEST_PW,
  },
  admin: {
    base: ADMIN,
    login: "/",
    email: process.env.ZUKA_ADMIN_EMAIL || "admin@onechanneladmin.com",
    password: process.env.ZUKA_ADMIN_PASSWORD || "",
  },
  kitchen: {
    base: ADMIN,
    login: "/",
    email: process.env.ZUKA_KITCHEN_EMAIL || "test-kitchen@zuka.test",
    password: process.env.ZUKA_KITCHEN_PASSWORD || TEST_PW,
  },
  grocery: {
    base: ADMIN,
    login: "/",
    email: process.env.ZUKA_GROCERY_EMAIL || "test-grocery@zuka.test",
    password: TEST_PW,
  },
  kitchenMulti: {
    base: ADMIN,
    login: "/",
    email: process.env.ZUKA_KITCHEN_MULTI_EMAIL || "test-kitchen-multi@zuka.test",
    password: TEST_PW,
  },
  driver: {
    base: PARTNER,
    login: "/",
    email: process.env.ZUKA_DRIVER_EMAIL || "test-driver@zuka.test",
    password: process.env.ZUKA_DRIVER_PASSWORD || TEST_PW,
  },
};

async function settle(page) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(1200);
}

async function dump(page, role, name) {
  const dir = path.join(OUT, role);
  fs.mkdirSync(dir, { recursive: true });
  const safe = name.replace(/[^a-z0-9]+/gi, "_").slice(0, 60) || "root";
  const snap = await page.locator("body").ariaSnapshot({ timeout: 15000 }).catch((e) => `ERR ${e.message}`);
  fs.writeFileSync(path.join(dir, `${safe}.yml`), `# ${page.url()}\n${snap}\n`, "utf8");
  await page.screenshot({ path: path.join(dir, `${safe}.png`), fullPage: true }).catch(() => {});
  return { name, url: page.url(), title: await page.title().catch(() => "") };
}

async function login(page, cfg) {
  await page.goto(new URL(cfg.login, cfg.base).href, { waitUntil: "domcontentloaded" });
  await settle(page);
  const email = page.locator('input[type="email"], input[autocomplete="email"], input[placeholder*="mail" i]').first();
  await email.waitFor({ state: "visible", timeout: 30000 });
  await email.fill(cfg.email);
  await page.locator('input[type="password"]').first().fill(cfg.password);
  const btn = page.getByRole("button", { name: /^(sign in|log in|login|continue)$/i }).first();
  await btn.click();
  await page.waitForTimeout(4000);
  await settle(page);
}

async function crawlRole(browser, role, extraPaths) {
  const cfg = ROLES[role];
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    geolocation: { latitude: 19.3133, longitude: -81.3857 },
    permissions: ["geolocation"],
    timezoneId: "America/Cayman",
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text().slice(0, 300)));
  const visited = [];
  if (cfg.login) {
    await login(page, cfg);
  } else {
    await page.goto(cfg.base, { waitUntil: "domcontentloaded" });
    await settle(page);
  }
  visited.push(await dump(page, role, "landing"));

  for (const p of extraPaths) {
    await page.goto(new URL(p, cfg.base).href, { waitUntil: "domcontentloaded" }).catch(() => {});
    await settle(page);
    visited.push(await dump(page, role, p));
  }

  fs.writeFileSync(
    path.join(OUT, `${role}.json`),
    JSON.stringify({ role, visited, consoleErrors: consoleErrors.slice(0, 50) }, null, 2),
  );
  console.log(`[crawl] ${role}: ${visited.length} surfaces`);
  await context.close();
}

(async () => {
  const args = process.argv.slice(2);
  const pathsArg = args.find((a) => a.startsWith("--paths="));
  const extraPaths = pathsArg ? pathsArg.slice(8).split(",").filter(Boolean) : [];
  const roles = args.filter((a) => !a.startsWith("--"));
  const browser = await chromium.launch({ headless: process.env.PW_HEADED !== "1" });
  for (const role of roles.length ? roles : Object.keys(ROLES)) {
    try {
      await crawlRole(browser, role, extraPaths);
    } catch (err) {
      console.error(`[crawl] ${role} failed: ${err.message.split("\n")[0]}`);
    }
  }
  await browser.close();
})();
