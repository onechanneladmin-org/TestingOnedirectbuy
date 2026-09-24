/**
 * Catalog UI audit. Signs in, opens each Catalog page from the sidebar,
 * and runs the shared rule engine.
 *
 *   TEST_LOGIN_PASSWORD=... npx playwright test tests/Onechanneladmin/catalog-ui-audit.spec.js --project=onechanneladmin
 */
const { test, expect } = require("@playwright/test");
const { uiAudit } = require("../../lib/ui-audit");

const LOGIN_EMAIL = process.env.TEST_LOGIN_EMAIL || "admin@onechanneladmin.com";
const LOGIN_PASSWORD = process.env.TEST_LOGIN_PASSWORD || "";
const VIEWPORT = { width: 1280, height: 720 };

const CATALOG_PAGES = [
  { name: "Dashboard", url: /\/products\/dashboard/ },
  { name: "Products", url: /\/products\/catalog/ },
  { name: "Inventory", url: /\/products\/inventory/ },
  { name: "Fitment", url: /\/products\/fitment/ },
  { name: "Addons", url: /\/products\/addons/ },
  { name: "Bundles", url: /\/products\/bundlekits/ },
  { name: "Pricing", url: /\/products\/pricing/ },
  { name: "Images", url: /\/products\/images/ },
  { name: "Import / Export", url: /\/products\/import-export/ },
];

async function login(page) {
  await page.goto("https://admin.onechanneladmin.com/signin?returnUrl=%2F");
  await page.getByRole("textbox", { name: "Email address" }).fill(LOGIN_EMAIL);
  await page.locator('input[name="password"]').fill(LOGIN_PASSWORD);
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForURL((url) => !/signin|login/i.test(url.pathname), { timeout: 30000 });
}

async function openCatalogPage(page, name) {
  await page.locator(".loader-container").waitFor({ state: "hidden", timeout: 20000 }).catch(() => {});
  await page.getByRole("button", { name: "Catalog", exact: true }).click();
  await page.getByRole("button", { name, exact: true }).click();
  await page.locator(".loader-container").waitFor({ state: "hidden", timeout: 20000 }).catch(() => {});
}

test.describe("Catalog UI audit", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!LOGIN_PASSWORD, "TEST_LOGIN_PASSWORD is required");
    await page.setViewportSize(VIEWPORT);
    await login(page);
  });

  for (const catalogPage of CATALOG_PAGES) {
    test(`audits Catalog ${catalogPage.name}`, async ({ page }) => {
      await openCatalogPage(page, catalogPage.name);
      await expect(page).toHaveURL(catalogPage.url);

      const result = await uiAudit(page, {
        pageName: `Catalog ${catalogPage.name}`,
        theme: "light",
        viewport: VIEWPORT,
      });

      expect(result.findings.length).toBe(result.report.summary.total);
      for (const finding of result.findings) {
        expect(finding).toEqual(
          expect.objectContaining({
            ruleId: expect.any(String),
            category: expect.any(String),
            severity: expect.any(String),
            confidence: expect.any(Number),
            kind: expect.any(String),
            page: `Catalog ${catalogPage.name}`,
            message: expect.any(String),
            expected: expect.any(String),
            actual: expect.any(String),
            evidence: expect.objectContaining({
              url: expect.any(String),
              viewport: VIEWPORT,
              theme: "light",
            }),
          }),
        );
      }
      expect(
        result.exitCode,
        result.findings.map((finding) => `${finding.ruleId}: ${finding.message}`).join("\n"),
      ).toBe(0);
    });
  }
});
