import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsClient } from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — client product catalog", () => {
  test("client can open the product catalog", async ({ page, soft }) => {
    await soft("OPH-CLIENT-PRODUCT-CATALOG", "Open client product catalog", async () => {
      await signInAsClient(page);
      await clickSidebarNav(page, "Product Catalog");

      await expect(
        page.getByRole("heading", { name: /Product Catalog|Catalog/i })
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(
        page
          .getByPlaceholder(/Search by title|SKU|UPC|search/i)
          .or(page.getByText(/Brand Directory|product|catalog|no products/i))
          .first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });
});
