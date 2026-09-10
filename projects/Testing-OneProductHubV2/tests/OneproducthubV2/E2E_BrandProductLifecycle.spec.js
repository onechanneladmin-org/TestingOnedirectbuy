import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

async function selectCategory(page, categoryName) {
  await page.getByText(/^Select a category$/i).first().click();

  const search = page.getByPlaceholder(/Search or type a new category/i).first();
  await expect(search).toBeVisible({ timeout: STEP_TIMEOUT });
  await search.fill(categoryName);

  const existing = page
    .getByRole("option", { name: new RegExp(`^${categoryName}$`, "i") })
    .or(page.getByText(new RegExp(`^${categoryName}$`, "i")))
    .first();
  if (await existing.isVisible().catch(() => false)) {
    await existing.click();
    return;
  }

  await page
    .getByText(new RegExp(`Add\\s*"?${categoryName}"?`, "i"))
    .or(page.getByText(/Add new category/i))
    .first()
    .click();
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

      const preferred =
        process.env.ONEPRODUCTHUB_BRAND_NAME ||
        process.env.ONEPRODUCTHUB_V2_BRAND_NAME ||
        "TestBrand";
      const brandSelect = page
        .locator("select")
        .filter({ hasText: /TestBrand|NewBrand1|Select a brand/i })
        .or(page.getByLabel(/^Brand\b/i))
        .first();
      const labels = (await brandSelect.locator("option").allTextContents())
        .map((text) => text.trim())
        .filter(Boolean);
      const match =
        labels.find((label) => label === preferred) ||
        labels.find((label) => /testbrand|newbrand/i.test(label)) ||
        labels.find((label) => !/^select/i.test(label));
      if (!match) {
        throw new Error(`No usable brand option found: ${labels.join(", ")}`);
      }
      await brandSelect.selectOption({ label: match });

      await selectCategory(page, "Bedding");

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
