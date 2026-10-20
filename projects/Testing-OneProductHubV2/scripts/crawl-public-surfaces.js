/**
 * Dump public home + footer destinations for OneProductHub marketing pages.
 */
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const BASE = process.env.ONEPRODUCTHUB_BASE_URL || "https://oneproducthub.com";

async function dump(page) {
  return page.evaluate(() => {
    const text = (el) =>
      (el.innerText || el.getAttribute("aria-label") || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 90);
    const unique = (arr) => [...new Set(arr.filter(Boolean))];
    const footer = document.querySelector("footer");
    return {
      url: location.href,
      hash: location.hash,
      title: document.title,
      headings: unique([...document.querySelectorAll("h1,h2,h3")].map(text)).slice(
        0,
        20,
      ),
      buttons: unique(
        [...document.querySelectorAll("button,[role=button]")].map(text),
      ).slice(0, 80),
      footerButtons: footer
        ? unique([...footer.querySelectorAll("button,[role=button],a")].map(text))
        : [],
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

(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: process.platform === "win32" ? "chrome" : undefined,
  });
  const page = await browser.newPage();
  const pages = [];

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  pages.push({ requested: "home", ...(await dump(page)) });

  const footerLabels = await page.evaluate(() => {
    const footer = document.querySelector("footer");
    if (!footer) return [];
    return [...footer.querySelectorAll("button,[role=button]")]
      .map((el) => (el.innerText || "").trim().replace(/\s+/g, " "))
      .filter(Boolean);
  });

  const uniqueLabels = [...new Set(footerLabels)];
  for (const label of uniqueLabels) {
    try {
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(800);
      const btn = page
        .locator("footer")
        .getByRole("button", { name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") })
        .first();
      if (!(await btn.isVisible().catch(() => false))) continue;
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      await page.waitForTimeout(1200);
      pages.push({ requested: `footer:${label}`, ...(await dump(page)) });
      console.log(`  footer ${label} -> ${page.url()}`);
    } catch (err) {
      pages.push({ requested: `footer:${label}`, error: String(err.message || err) });
    }
  }

  await browser.close();
  const dest = path.join(__dirname, "..", "docs", "oph-public-crawl.json");
  fs.writeFileSync(dest, JSON.stringify(pages, null, 2));
  console.log(`[public] wrote ${dest} (${pages.length} pages)`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
