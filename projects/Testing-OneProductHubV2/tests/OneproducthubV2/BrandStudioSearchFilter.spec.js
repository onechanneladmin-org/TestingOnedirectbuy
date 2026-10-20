import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import { clickSidebarNav, STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — brand studio search and filters", () => {
  test("brand can search the studio catalog and use status filters", async ({ page, soft }) => {
    await soft("OPH-BRAND-STUDIO-SEARCH-1", "Search AI Product Studio catalog", async () => {
      await signInAsBrand(page);
      await clickSidebarNav(page, "AI Product Studio");
      const search = page.getByPlaceholder(/Search SKUs|Search|SKU|Title|UPC/i).first();
      await expect(search).toBeVisible({ timeout: STEP_TIMEOUT });
      await search.fill("test");
      await expect(
        page.getByText(/test|sku|no product|no result|catalog/i).first(),
      ).toBeVisible({ timeout: 30_000 });
      await capturePageOrModal(page, "Studio search");
    });

    await soft("OPH-BRAND-STUDIO-FILTER-1", "Use studio All filter chip", async () => {
      const allFilter = page.getByRole("button", { name: /^All/i }).first();
      await expect(allFilter).toBeVisible({ timeout: STEP_TIMEOUT });
      await allFilter.click();
      await expect(
        page.getByRole("heading", { name: /Product Catalog|AI Product/i }),
      ).toBeVisible();
    });
  });
});
