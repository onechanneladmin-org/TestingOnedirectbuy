import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

/**
 * Pick the brand account's available brand option (seed brand name can change).
 * @param {import('@playwright/test').Page} page
 */
async function selectBrandOption(page) {
  const preferred =
    process.env.ONEPRODUCTHUB_BRAND_NAME ||
    process.env.ONEPRODUCTHUB_V2_BRAND_NAME ||
    "TestBrand";

  const brandSelect = page
    .locator("select")
    .filter({ hasText: /TestBrand|NewBrand1|Select a brand/i })
    .or(page.getByLabel(/^Brand\b/i))
    .first();

  await expect(brandSelect).toBeVisible({ timeout: STEP_TIMEOUT });

  const labels = (await brandSelect.locator("option").allTextContents())
    .map((text) => text.trim())
    .filter(Boolean);

  const match =
    labels.find((label) => label === preferred) ||
    labels.find((label) => /testbrand|newbrand/i.test(label)) ||
    labels.find((label) => !/^select/i.test(label));

  if (!match) {
    throw new Error(
      `No usable brand option found. Available: ${labels.join(", ") || "(none)"}`,
    );
  }

  await brandSelect.selectOption({ label: match });
}

/**
 * Select or create a category on the add-product form.
 * @param {import('@playwright/test').Page} page
 * @param {string} categoryName
 */
async function selectCategory(page, categoryName) {
  const categoryTrigger = page
    .getByText(/^Select a category$/i)
    .or(
      page
        .getByRole("combobox")
        .filter({ hasText: /Select a category|Select or type a category/i }),
    )
    .first();
  await expect(categoryTrigger).toBeVisible({ timeout: STEP_TIMEOUT });
  await categoryTrigger.click();
  await capturePageOrModal(page, "Category picker modal");

  const search = page.getByPlaceholder(/Search or type a new category/i).first();
  await expect(search).toBeVisible({ timeout: STEP_TIMEOUT });
  await search.fill(categoryName);

  const existing = page
    .getByRole("option", { name: new RegExp(`^${categoryName}$`, "i") })
    .or(page.getByText(new RegExp(`^${categoryName}$`, "i")))
    .first();
  if (await existing.isVisible().catch(() => false)) {
    await existing.click();
  } else {
    const addOption = page
      .getByText(new RegExp(`Add\\s*"?${categoryName}"?`, "i"))
      .or(page.getByText(/Add new category/i))
      .first();
    await expect(addOption).toBeVisible({ timeout: STEP_TIMEOUT });
    await addOption.click();
  }

  await expect(page.getByText(/^Select a category$/i)).toHaveCount(0, {
    timeout: STEP_TIMEOUT,
  });
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

      await selectBrandOption(page);
      await selectCategory(page, "Bedding");

      await page
        .getByRole("textbox", { name: /Description/i })
        .fill("Automated V2 test product");
      await page.getByRole("spinbutton", { name: /Stock Quantity/i }).fill("9");
    });

    await soft("OPH-BRAND-ADD-SAVE", "Save product", async () => {
      // Category must remain selected before save (custom picker can look "done" incorrectly).
      await expect(page.getByText(/^Select a category$/i)).toHaveCount(0);
      await expect(page.getByText(/^Bedding$/i).first()).toBeVisible();

      const saveResponse = page.waitForResponse(
        (res) =>
          /\/catalog\/products\b/i.test(res.url()) &&
          res.request().method() === "POST",
        { timeout: 30_000 },
      );

      await page.getByRole("button", { name: "Save Product" }).click();

      const response = await saveResponse.catch(() => null);
      if (response && !response.ok()) {
        let detail = `${response.status()}`;
        let code = "";
        try {
          const body = await response.json();
          detail = body?.message || body?.error || detail;
          code = body?.code || "";
        } catch {
          /* non-JSON body */
        }
        if (code === "trial_expired" || /trial/i.test(String(detail))) {
          throw new Error(
            `Cannot create product: brand free trial expired (${detail}). ` +
              "Upgrade/renew the TestBrand plan (or use a paid brand account) then re-run.",
          );
        }
        throw new Error(`Product create API failed: ${detail}`);
      }

      await expect
        .poll(() => String(page.url()), { timeout: 30_000 })
        .not.toMatch(/add-product/i);

      if (await page.getByText(/free trial has expired/i).isVisible().catch(() => false)) {
        throw new Error(
          "Cannot create product: brand free trial expired. Upgrade the TestBrand plan and re-run.",
        );
      }
    });

    await soft("OPH-BRAND-ADD-VERIFY", "Verify product created", async () => {
      if (/add-product/i.test(page.url())) {
        throw new Error(
          "Still on add-product after save — product was not created.",
        );
      }

      await clickSidebarNav(page, "AI Product Studio");

      const search = page
        .getByPlaceholder(/Search SKUs, Titles, UPC/i)
        .first();
      await expect(search).toBeVisible({ timeout: STEP_TIMEOUT });
      await search.fill(uniqueSku);

      await expect(
        page.getByText(productName).or(page.getByText(uniqueSku)).first(),
      ).toBeVisible({ timeout: 30_000 });
      await capturePageOrModal(page, "Product created");
    });
  });
});
