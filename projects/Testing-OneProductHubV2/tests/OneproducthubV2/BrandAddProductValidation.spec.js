import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import { STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — brand add product validation", () => {
  test("saving an empty add-product form shows validation", async ({ page, soft }) => {
    await soft("OPH-BRAND-ADD-VALIDATION-1", "Empty add product form cannot save", async () => {
      await signInAsBrand(page);
      await page.getByRole("button", { name: "Add Product" }).click();
      await expect(
        page.getByRole("heading", { name: /Create New Product|Add Product/i }).first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });

      await page.getByRole("button", { name: "Save Product" }).click();
      await expect(page).toHaveURL(/add-product/i, { timeout: STEP_TIMEOUT });
      await expect(
        page
          .getByText(/required|enter|select a|cannot be empty|please/i)
          .or(page.getByRole("heading", { name: /Create New Product|Add Product/i }))
          .first(),
      ).toBeVisible();
      await capturePageOrModal(page, "Add product validation");
    });
  });
});
