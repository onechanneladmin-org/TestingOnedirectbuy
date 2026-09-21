import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import { dismissDialog, STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — brand add product fields", () => {
  test("brand can fill extra add-product fields and open AI generator without saving", async ({
    page,
    soft,
  }) => {
    await soft("OPH-BRAND-ADD-FIELDS-1", "Fill tags features specs shipping without save", async () => {
      await signInAsBrand(page);
      await page.getByRole("button", { name: "Add Product" }).click();
      await expect(
        page.getByRole("heading", { name: /Create New Product/i }),
      ).toBeVisible({ timeout: STEP_TIMEOUT });

      await expect(page.getByRole("heading", { name: /Basic Information/i })).toBeVisible();
      await expect(page.getByRole("heading", { name: /Inventory & Stock/i })).toBeVisible();
      await expect(page.getByRole("heading", { name: /Shipping Details/i })).toBeVisible();
      await expect(page.getByRole("heading", { name: /Product Tags/i })).toBeVisible();
      await expect(page.getByRole("heading", { name: /Product Features/i })).toBeVisible();
      await expect(page.getByRole("heading", { name: /Product Specifications/i })).toBeVisible();

      await page.getByPlaceholder(/e\.g\., 150g, 2\.5kg/i).fill("150g");
      await page.getByPlaceholder(/10cm x 5cm x 2cm/i).fill("10cm x 5cm x 2cm");
      await page.getByPlaceholder(/3-5 business days/i).fill("3-5 business days");
      await page.getByPlaceholder(/wireless, eco-friendly, premium/i).fill("wireless");
      await page.getByPlaceholder(/Premium Construction, Energy Efficient/i).fill("Premium Construction");
      await page.getByPlaceholder(/Color, Size, Material/i).fill("Color");
      await page.getByPlaceholder(/Blue, Large, Cotton/i).fill("Blue");
      await expect(page.getByRole("button", { name: /^Cancel$/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /Save Product/i })).toBeVisible();
      await capturePageOrModal(page, "Add product extra fields");
    });

    await soft("OPH-BRAND-ADD-GENERATOR-1", "Launch AI generator then dismiss", async () => {
      await expect(page.getByRole("heading", { name: /AI Content Generator/i })).toBeVisible();
      await page.getByRole("button", { name: /Launch Generator/i }).click();
      await capturePageOrModal(page, "AI generator opened");
      await dismissDialog(page);
      await expect(page.getByRole("heading", { name: /Create New Product/i })).toBeVisible();
    });

    await soft("OPH-BRAND-ADD-CANCEL-1", "Cancel add product without saving", async () => {
      await page.getByRole("button", { name: /^Cancel$/i }).click();
      await expect(
        page
          .getByRole("heading", { name: /Product Catalog|Workspace Overview|Create New Product/i })
          .first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await capturePageOrModal(page, "Add product cancelled");
    });
  });
});
