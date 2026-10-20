import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import { clickSidebarNav, STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — brand product catalog filters", () => {
  test("brand can filter, search, and paginate the product catalog", async ({
    page,
    soft,
  }) => {
    await soft("OPH-BRAND-CATALOG-STATUS-1", "Switch All Active Draft Archive chips", async () => {
      await signInAsBrand(page);
      await clickSidebarNav(page, "AI Product Studio");
      await expect(
        page.getByRole("heading", { name: /Product Catalog/i }),
      ).toBeVisible({ timeout: STEP_TIMEOUT });

      for (const chip of [/^All/i, /^Active/i, /^Draft/i, /^Archive/i]) {
        await page.getByRole("button", { name: chip }).first().click();
      }
      await page.getByRole("button", { name: /^All/i }).first().click();
      await capturePageOrModal(page, "Brand catalog status chips");
    });

    await soft("OPH-BRAND-CATALOG-SEARCH-1", "Search product catalog by SKU or title", async () => {
      const search = page.getByPlaceholder(/Search SKUs, Titles, UPC/i).first();
      await expect(search).toBeVisible({ timeout: STEP_TIMEOUT });
      await search.fill("PRD");
      await expect(page.getByRole("heading", { name: /Product Catalog/i })).toBeVisible();
    });

    await soft("OPH-BRAND-CATALOG-LIST-VIEW-1", "Toggle list view", async () => {
      await page.getByRole("button", { name: /List View/i }).click();
      await expect(page.getByRole("heading", { name: /Product Catalog/i })).toBeVisible();
      await capturePageOrModal(page, "Brand catalog list view");
    });

    await soft("OPH-BRAND-CATALOG-RESET-1", "Reset catalog filters", async () => {
      await page.getByRole("button", { name: /^Reset$/i }).click();
      await expect(page.getByPlaceholder(/Search SKUs, Titles, UPC/i).first()).toBeVisible();
    });

    await soft("OPH-BRAND-CATALOG-SELECT-ALL-1", "Select all catalog rows", async () => {
      const selectAll = page
        .getByRole("checkbox", { name: /Select all|PRODUCT/i })
        .or(page.locator('thead input[type="checkbox"], [role="checkbox"]').first());
      await expect(selectAll.first()).toBeVisible({ timeout: STEP_TIMEOUT });
      await selectAll.first().click();
      await capturePageOrModal(page, "Brand catalog select all");
    });

    await soft("OPH-BRAND-CATALOG-PAGINATION-1", "Catalog previous and next", async () => {
      const previous = page.getByRole("button", { name: /^Previous$/i });
      const next = page.getByRole("button", { name: /^Next$/i });
      await expect(previous).toBeVisible();
      await expect(next).toBeVisible();
      if (await next.isEnabled()) {
        await next.click();
        await previous.click();
      }
    });

    await soft("OPH-BRAND-CATALOG-MANAGE-PLAN-1", "Manage plan from catalog", async () => {
      await page.getByRole("button", { name: /Manage plan/i }).click();
      await expect(
        page.getByRole("heading", { name: /Choose Your Plan|Subscription/i }).first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await capturePageOrModal(page, "Brand catalog manage plan");
    });
  });
});
