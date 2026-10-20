import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — brand AI product studio", () => {
  test("brand can open AI Product Studio with filters and views", async ({
    page,
    soft,
  }) => {
    await soft("OPH-BRAND-AI-STUDIO", "Open AI Product Studio with filters", async () => {
      await signInAsBrand(page);
      await clickSidebarNav(page, "AI Product Studio");

      await expect(
        page.getByRole("heading", { name: /Product Catalog|AI Product/i })
      ).toBeVisible({ timeout: STEP_TIMEOUT });

      await expect(page.getByRole("button", { name: /All/i }).first()).toBeVisible();
      await expect(
        page.getByPlaceholder(/Search SKUs|Search|SKU|Title/i).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(page.getByRole("button", { name: "Add Product" })).toBeVisible();
    });
  });
});
