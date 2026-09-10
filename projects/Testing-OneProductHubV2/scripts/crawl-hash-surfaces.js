/**
 * Hash-route dump after brand/client/admin sign-in.
 */
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const BASE = process.env.ONEPRODUCTHUB_BASE_URL || "https://oneproducthub.com";
const API =
  process.env.ONEPRODUCTHUB_API_BASE_URL ||
  "https://oneproducthub-backend.onechanneladmin.com";

const CREDS = {
  Brand: {
    email: process.env.ONEPRODUCTHUB_BRAND_EMAIL || "anuragsinghg999@gmail.com",
    password: process.env.ONEPRODUCTHUB_BRAND_PASSWORD || "Seed@123456",
    landing: /Workspace Overview/i,
    hashes: [
      "dashboard",
      "products",
      "add-product",
      "distributions",
      "client-access",
      "data-quality",
      "export",
      "import",
      "changelog",
      "blog",
      "notifications",
    ],
  },
  Client: {
    email: process.env.ONEPRODUCTHUB_CLIENT_EMAIL || "anuragsinghg99@gmail.com",
    password: process.env.ONEPRODUCTHUB_CLIENT_PASSWORD || "Seed@123456",
    landing: /Welcome back,/i,
    hashes: [
      "dashboard",
      "brands",
      "catalog",
      "export",
      "changelog",
      "blog",
      "client-access-drafts",
      "client-team",
    ],
  },
  Admin: {
    email:
      process.env.ONEPRODUCTHUB_ADMIN_EMAIL ||
      "superadmin@seed.oneproducthub.com",
    password: process.env.ONEPRODUCTHUB_ADMIN_PASSWORD || "Seed@123456",
    landing: /Admin Dashboard/i,
    hashes: [
      "dashboard",
      "clients",
      "brand-registry",
      "brands",
      "catalog",
      "products",
      "rbac-admin",
      "blog",
    ],
  },
};

async function rewriteApi(page) {
  await page.route("**/localhost:4000/**", async (route) => {
    const target = route
      .request()
      .url()
      .replace("http://localhost:4000", API)
      .replace("https://localhost:4000", API);
    try {
      await route.fulfill({ response: await route.fetch({ url: target }) });
    } catch {
      try {
        await route.abort();
      } catch {
        /* ignore */
      }
    }
  });
}

async function dump(page) {
  return page.evaluate(() => {
    const text = (el) =>
      (el.innerText || el.getAttribute("aria-label") || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 90);
    const unique = (arr) => [...new Set(arr.filter(Boolean))];
    return {
      url: location.href,
      hash: location.hash,
      title: document.title,
      headings: unique([...document.querySelectorAll("h1,h2,h3")].map(text)).slice(
        0,
        12,
      ),
      buttons: unique(
        [...document.querySelectorAll("button,[role=button]")].map(text),
      )
        .filter((t) => !/Overview & workspace|Generate & enrich|Sync & manage/i.test(t))
        .slice(0, 35),
      fields: unique(
        [...document.querySelectorAll("input,select,textarea")].map(
          (el) =>
            el.getAttribute("placeholder") ||
            el.getAttribute("aria-label") ||
            el.name ||
            el.id,
        ),
      ).slice(0, 20),
    };
  });
}

async function signIn(page, role) {
  const creds = CREDS[role];
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  const roleBtn = page.getByRole("button", {
    name: /Continue as (Brand|Client)/,
  });
  if (!(await roleBtn.first().isVisible().catch(() => false))) {
    await page.getByRole("button", { name: /^log\s*in$/i }).first().click();
  }
  const portal = role === "Client" ? "Client" : "Brand";
  await page.getByRole("button", { name: `Continue as ${portal}` }).click();
  await page.getByRole("textbox", { name: "Email Address" }).fill(creds.email);
  await page.getByRole("textbox", { name: "Password" }).fill(creds.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.getByRole("heading", { name: creds.landing }).waitFor({
    timeout: 30_000,
  });
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: process.platform === "win32" ? "chrome" : undefined,
  });
  const out = [];
  for (const role of Object.keys(CREDS)) {
    console.log(`[hash] ${role}`);
    const page = await browser.newPage();
    await rewriteApi(page);
    const entry = { role, pages: [] };
    try {
      await signIn(page, role);
      for (const hash of CREDS[role].hashes) {
        await page.goto(`${BASE}#/${hash}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1500);
        entry.pages.push({ requested: hash, ...(await dump(page)) });
        console.log(`  #/${hash} -> ${page.url()}`);
      }
    } catch (err) {
      entry.error = String(err.message || err);
    }
    await page.close();
    out.push(entry);
  }
  await browser.close();
  const dest = path.join(__dirname, "..", "docs", "oph-hash-crawl.json");
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log(`[hash] wrote ${dest}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
