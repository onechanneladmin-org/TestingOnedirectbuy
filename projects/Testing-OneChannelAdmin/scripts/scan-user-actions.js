const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { chromium } = require("playwright");
const {
  openSignIn,
  signIn,
  openAdminPage,
  collectAppRoutes,
  runUserActionSteps,
} = require("../tests/Onechanneladmin/ux-flows/uxAuditSteps");

function loadSpecPaths() {
  const dir = path.join(__dirname, "../tests/Onechanneladmin/ux-flows");
  const paths = new Set(["/home/dashboard"]);
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".spec.js")) continue;
    const text = fs.readFileSync(path.join(dir, file), "utf8");
    const pagePath = (text.match(/"path":\s*"([^"]+)"/) || text.match(/path:\s*"([^"]+)"/) || [])[1];
    if (pagePath) paths.add(pagePath.split("?")[0]);
  }
  return paths;
}

async function soft(id, title, fn) {
  console.log(`STEP ${id} — ${title}`);
  await fn();
  console.log(`OK   ${id}`);
}

async function expandNav(page) {
  const labels = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("nav button, aside button")].filter((el) => {
      if (el.closest('aside[aria-label="Home navigation"]')) return false;
      const rect = el.getBoundingClientRect();
      const text = (el.innerText || "").replace(/\s+/g, " ").trim();
      return rect.width > 40 && rect.height > 20 && rect.x < 280 && text && text.length < 40;
    });
    buttons.forEach((el, index) => el.setAttribute("data-nav-hub", String(index)));
    return buttons.map((el) => (el.innerText || "").replace(/\s+/g, " ").trim());
  });
  const routes = [];
  for (let i = 0; i < Math.min(labels.length, 20); i += 1) {
    await page.locator(`[data-nav-hub="${i}"]`).click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
    routes.push(...(await collectAppRoutes(page)));
  }
  return routes;
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    channel: "chrome",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const known = loadSpecPaths();
  try {
    await openSignIn(page);
    await signIn(page);
    const routes = [...(await collectAppRoutes(page)), ...(await expandNav(page))];
    const missing = [];
    const seen = new Set();
    for (const route of routes) {
      const clean = route.path.split("?")[0];
      if (seen.has(clean) || known.has(clean)) continue;
      seen.add(clean);
      missing.push({ ...route, path: clean });
    }
    const routeFile = path.join(__dirname, "../test-results/user-actions-scan.json");
    fs.mkdirSync(path.dirname(routeFile), { recursive: true });
    fs.writeFileSync(
      routeFile,
      JSON.stringify({ generatedAt: new Date().toISOString(), knownPages: known.size, missing }, null, 2),
    );
    await openAdminPage(page, {
      hub: "Catalog",
      name: "Inventory",
      path: "/products/inventory",
      stepPrefix: "CATALOG-INVENTORY",
    });
    const outcomes = await runUserActionSteps(
      page,
      { hub: "Catalog", name: "Inventory", path: "/products/inventory", stepPrefix: "CATALOG-INVENTORY" },
      soft,
    );
    const out = {
      generatedAt: new Date().toISOString(),
      knownPages: known.size,
      discoveredRoutes: routes.length,
      missing,
      inventoryActions: outcomes,
    };
    const file = path.join(__dirname, "../test-results/user-actions-scan.json");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(out, null, 2));
    console.log(JSON.stringify({ missing: missing.length, actions: outcomes.length, back: page.url() }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
