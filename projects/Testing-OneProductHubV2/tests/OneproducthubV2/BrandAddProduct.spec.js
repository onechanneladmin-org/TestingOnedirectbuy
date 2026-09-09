import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import { STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

async function selectCategory(page, categoryName) {
  await page
    .getByRole("combobox")
    .filter({ hasText: /Select or type a category|category/i })
    .click();
  await capturePageOrModal(page, "Category picker modal");

  const search = page.getByPlaceholder("Search or type a new category…");
  await expect(search).toBeVisible({ timeout: STEP_TIMEOUT });
  await search.fill(categoryName);

  const existing = page.getByRole("option", { name: categoryName }).first();
  if (await existing.isVisible().catch(() => false)) {
    await existing.click();
    return;
  }

  await page.getByText(new RegExp(`Create\\s+"?${categoryName}"?`, "i")).click();
}

test.describe("One Product Hub V2 — brand add product", () => {
  test("brand can create a product with required fields", async ({ page, soft }) => {
    const uniqueSku = `SKU-V2-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const productName = `v2-prod-${Date.now()}`;

    await soft("OPH-BRAND-ADD-OPEN", "Open add product form", async () => {
      await signInAsBrand(page);
      await page.getByRole("button", { name: "Add Product" }).click();

      await expect(
        page.getByRole("heading", { name: /Create New Product|Add Product/i }).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await capturePageOrModal(page, "Add product form");
    });

    await soft("OPH-BRAND-ADD-FILL", "Fill required product fields", async () => {
      await page.getByRole("textbox", { name: /Product Name/i }).fill(productName);
      await page.getByRole("textbox", { name: /SKU/i }).fill(uniqueSku);
      await page.getByRole("spinbutton", { name: /Price/i }).fill("12");

      const brandSelect = page.locator("select").filter({ hasText: "NewBrand1" }).first();
      await brandSelect.selectOption({ label: "NewBrand1" });

      await selectCategory(page, "Kitchen");

      await page
        .getByRole("textbox", { name: /Description/i })
        .fill("Automated V2 test product");
      await page.getByRole("spinbutton", { name: /Stock Quantity/i }).fill("9");
    });

    await soft("OPH-BRAND-ADD-SAVE", "Save product", async () => {
      await page.getByRole("button", { name: "Save Product" }).click();
    });

    await soft("OPH-BRAND-ADD-VERIFY", "Verify product created", async () => {
      await expect(
        page.getByText(productName).or(page.getByText(uniqueSku)).first()
      ).toBeVisible({ timeout: 30_000 });
      await capturePageOrModal(page, "Product created");
    });
  });
});
