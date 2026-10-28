// @flow A1 — 1CA login + menu walk. Guide: docs/qa/E2E-TEST-GUIDE.md § 5 A1.
// Use cases: Main_v2 Flow=A1. The sheet IDs are not in this repo yet, so the tests carry
// provisional IDs 1CA-A1-xx (mapping table in docs/qa/1CA-E2E-AUDIT.md § 4).
// Read-only: it only signs in and navigates (safe with E2E_READ_ONLY=1).
const { test, expect, expectTestOrg } = require("../../support/fixtures");
const { loadMenu, partitionLeaves, parseStoredList } = require("../../support/menu");
const { findErrorScreen, settle } = require("../../support/page-health");
const { checkStep } = require("../../support/check-step");

/** The 10 most-used pages (guide § 5 A1 "Add"): each gets a full checkStep (axe, layout, health). */
const KEY_PAGES = [
  { id: "1CA-A1-03", name: "fulfillment dashboard", path: "/fulfill/orders/dashboard" },
  { id: "1CA-A1-04", name: "orders list", path: "/fulfill/orders/fulfill-orders" },
  { id: "1CA-A1-05", name: "returns", path: "/fulfill/orders/return" },
  { id: "1CA-A1-06", name: "catalog products", path: "/products/catalog" },
  { id: "1CA-A1-07", name: "catalog inventory", path: "/products/inventory" },
  { id: "1CA-A1-08", name: "WMS orders", path: "/wms/orders?warehouse=wh1" },
  { id: "1CA-A1-09", name: "WMS pick and pack", path: "/wms/pickpack" },
  { id: "1CA-A1-10", name: "accounting dashboard", path: "/accounting/dashboard" },
  { id: "1CA-A1-11", name: "CRM dashboard", path: "/crm/dashboard" },
  { id: "1CA-A1-12", name: "CRM leads", path: "/crm/leads" },
];

async function storedAccess(page) {
  const stored = await page.evaluate(() => ({
    permissions: localStorage.getItem("permissions"),
    modules: localStorage.getItem("modules"),
  }));
  return { permissions: parseStoredList(stored.permissions), modules: parseStoredList(stored.modules) };
}

test.describe("A1 login + menu walk @flow @smoke", () => {
  test("1CA-A1-01 login lands on the test org, not the login page", async ({ page, settings, health }, testInfo) => {
    await page.goto("/");
    await settle(page);
    await expectTestOrg(page, settings);
    expect(new URL(page.url()).pathname, "signed-in user is not sent back to login").not.toMatch(/\/(v2\/)?login|\/signin/);
    expect(findErrorScreen(await page.locator("body").innerText())).toBeNull();
    const { permissions } = await storedAccess(page);
    expect(permissions.length, "the app loaded the user's permissions for the org").toBeGreaterThan(0);
    await checkStep(page, testInfo, { id: "1CA-A1-01", name: "landing page", health });
  });

  test("1CA-A1-02 every visible menu leaf opens with no error, console error or 5xx", async ({ page, settings, health }, testInfo) => {
    test.setTimeout(45 * 60_000); // ~100 leaves × settle time
    await page.goto("/");
    await settle(page);
    await expectTestOrg(page, settings);

    const access = await storedAccess(page);
    const { visible, hidden, external } = partitionLeaves(loadMenu(), { ...access, suites: settings.menuSuites });
    expect(visible.length, "QA user sees no menu leaves — check its role in the test org").toBeGreaterThan(0);

    const results = [];
    for (const leaf of visible) {
      await test.step(`${leaf.suite} › ${leaf.label} (${leaf.path})`, async () => {
        health.reset();
        const res = await page.goto(leaf.path, { waitUntil: "domcontentloaded" });
        await settle(page);
        const finalPath = new URL(page.url()).pathname;
        const row = {
          ...leaf,
          status: res ? res.status() : null,
          finalPath,
          errorScreen: findErrorScreen(await page.locator("body").innerText().catch(() => "")),
          issues: health.issues(),
        };
        results.push(row);
        expect.soft(row.status === null || row.status < 500, `${leaf.path}: document HTTP ${row.status}`).toBe(true);
        expect.soft(finalPath, `${leaf.path}: bounced to login`).not.toMatch(/\/(v2\/)?login|\/signin/);
        expect.soft(row.errorScreen, `${leaf.path}: error screen`).toBeNull();
        expect.soft(row.issues, `${leaf.path}: console errors / exceptions / 5xx`).toEqual([]);
      });
    }

    await testInfo.attach("menu-walk.json", {
      body: JSON.stringify(
        {
          org: settings.orgId,
          checked: results.length,
          failing: results.filter((r) => r.errorScreen || r.issues.length || (r.status && r.status >= 500)).length,
          results,
          hiddenForThisUser: hidden.map((h) => h.path),
          external: external.map((e) => e.path),
        },
        null,
        2
      ),
      contentType: "application/json",
    });
  });

  for (const p of KEY_PAGES) {
    test(`${p.id} ${p.name} passes checkStep (axe, layout, health)`, async ({ page, settings, health }, testInfo) => {
      const res = await page.goto(p.path, { waitUntil: "domcontentloaded" });
      await settle(page);
      await expectTestOrg(page, settings);
      expect(res && res.status(), `${p.path}: document status`).toBeLessThan(500);
      expect(new URL(page.url()).pathname, `${p.path}: bounced to login`).not.toMatch(/\/(v2\/)?login|\/signin/);
      expect(findErrorScreen(await page.locator("body").innerText())).toBeNull();
      // Outcome, not just "loaded": the page rendered its main content (a table, chart, card or page heading).
      await expect(
        page.locator(".p-datatable, table, canvas, .p-card, [class*='card'], [class*='dashboard'], main h1, main h2, h1").filter({ visible: true }).first(),
        `${p.path}: main content rendered`
      ).toBeVisible();
      await checkStep(page, testInfo, { id: p.id, name: p.name, health });
    });
  }

  test("1CA-A1-13 a permission-hidden menu item is not shown in the nav", async ({ page, settings }) => {
    await page.goto("/");
    await settle(page);
    await expectTestOrg(page, settings);
    const access = await storedAccess(page);
    test.skip(access.permissions.includes("superadmin"), "QA user is superadmin: every leaf is visible (use E2E_LOWPERM_* in A8)");
    const { visible, hidden } = partitionLeaves(loadMenu(), access);
    const visibleLabels = new Set(visible.map((v) => v.label));
    const onlyHidden = hidden.filter((h) => !visibleLabels.has(h.label));
    test.skip(!onlyHidden.length, "QA user has every permission in the menu");
    const nav = page.locator("nav, .layout-sidebar, .layout-menu, [class*='sidebar']").first();
    for (const h of onlyHidden.slice(0, 10)) {
      await expect.soft(nav.getByRole("link", { name: h.label, exact: true }), `${h.label} must be hidden`).toHaveCount(0);
    }
  });
});
