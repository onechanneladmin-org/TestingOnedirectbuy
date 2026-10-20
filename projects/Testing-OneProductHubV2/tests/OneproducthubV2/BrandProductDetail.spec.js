import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — brand product detail", () => {
  test("brand can open a product from the studio", async ({ page, soft }) => {
    await soft("OPH-BRAND-PRODUCT-DETAIL", "Open product detail from studio", async () => {
      await signInAsBrand(page);
      await clickSidebarNav(page, "AI Product Studio");

      await expect(
        page.getByRole("heading", { name: /Product Catalog|AI Product/i })
      ).toBeVisible({ timeout: STEP_TIMEOUT });

      const productLink = page
        .getByRole("button", { name: /Test Prod|View|Edit/i })
        .or(page.locator("a, button").filter({ hasText: /Test Prod|Testsku/i }))
        .first();

      await expect(productLink).toBeVisible({ timeout: STEP_TIMEOUT });
      await productLink.click();

      await expect(
        page
          .getByText(/AI Generate|Edit|Status|SKU|Save|Publish|Product/i)
          .first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });
});
