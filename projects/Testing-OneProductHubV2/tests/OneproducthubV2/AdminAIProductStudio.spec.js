import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import {
  hasAdminCredentials,
  signInAsAdmin,
} from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — admin AI product studio", () => {
  test.beforeEach(() => {
    if (!hasAdminCredentials()) {
      test.skip(
        true,
        "Set ONEPRODUCTHUB_ADMIN_EMAIL and ONEPRODUCTHUB_ADMIN_PASSWORD"
      );
    }
  });

  test("admin can open studio but cannot add products as platform admin", async ({
    page,
    soft,
  }) => {
    await soft("OPH-ADMIN-AI-STUDIO", "Open AI studio without add-product for admin", async () => {
      await signInAsAdmin(page);
      await clickSidebarNav(page, "AI Product Studio");

      await expect(
        page.getByRole("heading", { name: /Product Catalog|AI Product|Studio/i })
      ).toBeVisible({ timeout: STEP_TIMEOUT });

      const addProduct = page.getByRole("button", { name: "Add Product" });
      const addCount = await addProduct.count();
      if (addCount > 0) {
        await expect(
          page.getByText(/not available|platform admin|cannot|blocked|select a brand/i).first()
        ).toBeVisible({ timeout: STEP_TIMEOUT });
      } else {
        await expect(addProduct).toHaveCount(0);
      }
    });
  });
});
