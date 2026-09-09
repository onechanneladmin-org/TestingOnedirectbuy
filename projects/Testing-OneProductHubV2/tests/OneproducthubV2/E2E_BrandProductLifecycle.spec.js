import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

async function selectCategory(page, categoryName) {
  await page
    .getByRole("combobox")
    .filter({ hasText: /Select or type a category|category/i })
    .click();

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

test.describe("One Product Hub V2 — E2E brand product lifecycle", () => {
  test("brand can add a product and see it in AI Product Studio", async ({
    page,
    soft,
  }) => {
    const uniqueSku = `SKU-E2E-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const productName = `e2e-prod-${Date.now()}`;

    await soft("OPH-E2E-CREATE-PRODUCT", "Create brand product", async () => {
      await signInAsBrand(page);
      await page.getByRole("button", { name: "Add Product" }).click();

      await page.getByRole("textbox", { name: /Product Name/i }).fill(productName);
      await page.getByRole("textbox", { name: /SKU/i }).fill(uniqueSku);
      await page.getByRole("spinbutton", { name: /Price/i }).fill("15");

      const brandSelect = page.locator("select").filter({ hasText: "NewBrand1" }).first();
      await brandSelect.selectOption({ label: "NewBrand1" });

      await selectCategory(page, "Kitchen");

      await page
        .getByRole("textbox", { name: /Description/i })
        .fill("E2E lifecycle product");
      await page.getByRole("spinbutton", { name: /Stock Quantity/i }).fill("5");
      await page.getByRole("button", { name: "Save Product" }).click();

      await expect(
        page.getByText(productName).or(page.getByText(uniqueSku)).first()
      ).toBeVisible({ timeout: 30_000 });
    });

    await soft("OPH-E2E-VERIFY-STUDIO", "Verify product in AI Product Studio", async () => {
      await clickSidebarNav(page, "AI Product Studio");
      await expect(
        page.getByText(productName).or(page.getByText(uniqueSku)).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });
});
