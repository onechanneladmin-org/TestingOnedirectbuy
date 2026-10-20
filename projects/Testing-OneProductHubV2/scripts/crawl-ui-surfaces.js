/**
 * One-off crawl: sign in as Brand / Client / Admin and dump visible
 * headings, buttons, and fields per sidebar page. Used to find missing use cases.
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
  },
  Client: {
    email: process.env.ONEPRODUCTHUB_CLIENT_EMAIL || "anuragsinghg99@gmail.com",
    password: process.env.ONEPRODUCTHUB_CLIENT_PASSWORD || "Seed@123456",
    landing: /Welcome back,/i,
  },
  Admin: {
    email:
      process.env.ONEPRODUCTHUB_ADMIN_EMAIL ||
      "superadmin@seed.oneproducthub.com",
    password: process.env.ONEPRODUCTHUB_ADMIN_PASSWORD || "Seed@123456",
    landing: /Admin Dashboard/i,
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

async function dumpSurface(page) {
  return page.evaluate(() => {
    const text = (el) => (el.innerText || el.getAttribute("aria-label") || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 80);
    const unique = (arr) => [...new Set(arr.filter(Boolean))];
    return {
      url: location.href,
      hash: location.hash,
      headings: unique(
        [...document.querySelectorAll("h1,h2,h3")].map(text),
      ).slice(0, 20),
      buttons: unique(
        [...document.querySelectorAll("button,[role=button]")].map(text),
      ).slice(0, 60),
      fields: unique(
        [...document.querySelectorAll("input,select,textarea")].map(
          (el) =>
            el.getAttribute("aria-label") ||
            el.getAttribute("placeholder") ||
            el.getAttribute("name") ||
            el.id ||
            el.type,
        ),
      ).slice(0, 40),
      tabs: unique(
        [...document.querySelectorAll('[role=tab], [role=tablist] button')].map(
          text,
        ),
      ),
    };
  });
}

async function signIn(page, role) {
  const creds = CREDS[role];
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  const roleBtn = page.getByRole("button", { name: /Continue as (Brand|Client)/ });
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

async function crawlRole(browser, role) {
  const page = await browser.newPage();
  await rewriteApi(page);
  const result = { role, pages: [] };
  try {
    await signIn(page, role);
    const navLabels = await page.locator("nav button").allTextContents();
    result.sidebar = [...new Set(navLabels.map((t) => t.trim()).filter(Boolean))];
    result.pages.push({ nav: "(landing)", ...(await dumpSurface(page)) });

    for (const label of result.sidebar) {
      if (/sign out/i.test(label)) continue;
      try {
        await page
          .locator("nav")
          .getByRole("button", { name: new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") })
          .first()
          .click({ timeout: 10_000 });
        await page.waitForTimeout(1200);
        result.pages.push({ nav: label, ...(await dumpSurface(page)) });
      } catch (err) {
        result.pages.push({ nav: label, error: String(err.message || err) });
      }
    }
  } catch (err) {
    result.error = String(err.message || err);
  } finally {
    await page.close();
  }
  return result;
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: process.platform === "win32" ? "chrome" : undefined,
  });
  const out = [];
  for (const role of ["Brand", "Client", "Admin"]) {
    console.log(`[crawl] ${role}...`);
    out.push(await crawlRole(browser, role));
  }
  await browser.close();
  const dest = path.join(__dirname, "..", "docs", "oph-ui-crawl.json");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log(`[crawl] wrote ${dest}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
