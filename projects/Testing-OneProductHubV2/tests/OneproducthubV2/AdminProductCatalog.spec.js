import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import {
  hasAdminCredentials,
  signInAsAdmin,
} from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — admin product catalog", () => {
  test.beforeEach(() => {
    if (!hasAdminCredentials()) {
      test.skip(
        true,
        "Set ONEPRODUCTHUB_ADMIN_EMAIL and ONEPRODUCTHUB_ADMIN_PASSWORD"
      );
    }
  });

  test("admin can browse the product catalog", async ({ page, soft }) => {
    await soft("OPH-ADMIN-PRODUCT-CATALOG", "Browse admin product catalog", async () => {
      await signInAsAdmin(page);
      await clickSidebarNav(page, "Product Catalog");

      await expect(
        page.getByRole("heading", { name: /Product Catalog|Catalog/i })
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });
});
