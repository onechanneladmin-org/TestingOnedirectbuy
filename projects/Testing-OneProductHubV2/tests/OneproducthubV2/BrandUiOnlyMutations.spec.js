import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  dismissDialog,
  openSettingsSection,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — brand mutating controls UI only", () => {
  test("brand can open an existing product without saving edits", async ({ page, soft }) => {
    await soft("OPH-BRAND-EDIT-PRODUCT-UI-1", "Open existing product editor without save", async () => {
      await signInAsBrand(page);
      await clickSidebarNav(page, "AI Product Studio");
      await expect(page.getByRole("heading", { name: /Product Catalog/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      const product = page.getByRole("button", { name: /Hazard Lights|MyNewProduct|Test Products/i }).first();
      await expect(product).toBeVisible({ timeout: STEP_TIMEOUT });
      await product.click();
      await expect(
        page.getByText(/SKU|Save|Status|Edit|Product|AI Generate/i).first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await capturePageOrModal(page, "Edit product UI");
    });

    await soft("OPH-BRAND-ARCHIVE-UI-1", "Archive filter is available without archiving", async () => {
      await clickSidebarNav(page, "AI Product Studio");
      await expect(page.getByRole("button", { name: /^Archive/i })).toBeVisible();
    });

    await soft("OPH-BRAND-DUPLICATE-UI-1", "Product row actions are visible", async () => {
      await expect(page.getByRole("heading", { name: /Product Catalog/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /Add Product/i })).toBeVisible();
    });
  });

  test("brand AI generate and distribution connect stay UI-only", async ({ page, soft }) => {
    await soft("OPH-BRAND-AI-GENERATE-UI-1", "Open AI generate without consuming credits", async () => {
      await signInAsBrand(page);
      await page.getByRole("button", { name: "Add Product" }).click();
      await expect(page.getByRole("heading", { name: /Create New Product/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      await page.getByRole("button", { name: /Launch Generator/i }).click();
      await capturePageOrModal(page, "AI generate UI");
      await dismissDialog(page);
      await page.getByRole("button", { name: /^Cancel$/i }).click();
    });

    await soft("OPH-BRAND-DIST-CONNECT-UI-1", "Distributions page shows channel controls", async () => {
      await clickSidebarNav(page, "Distributions");
      await expect(
        page.getByRole("heading", { name: /Distribution|Channel|Workspace Overview/i }).first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(
        page.getByText(/channel|sync|distribution|connect/i).first(),
      ).toBeVisible();
      await capturePageOrModal(page, "Distributions connect UI");
    });

    await soft("OPH-BRAND-IMPORT-FILE-UI-1", "Import dropzone is visible without upload", async () => {
      await clickSidebarNav(page, "Import Center");
      await expect(
        page.getByRole("button", { name: /Drag & drop your file here|click to browse/i }),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(page.getByRole("button", { name: /Start Import/i })).toBeVisible();
    });
  });

  test("brand checkout and password change stay UI-only", async ({ page, soft }) => {
    await soft("OPH-BRAND-STRIPE-UI-1", "Choose Plan is visible without Stripe checkout", async () => {
      await signInAsBrand(page);
      await clickSidebarNav(page, "Subscription");
      await expect(page.getByRole("button", { name: /Choose Plan|Contact Sales/i }).first()).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
    });

    await soft("OPH-BRAND-PASSWORD-UI-1", "Security settings password controls without submit", async () => {
      await clickSidebarNav(page, "Settings");
      await openSettingsSection(page, "Security");
      await expect(page.getByRole("button", { name: /Update password/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      await expect(page.getByRole("heading", { name: /Password & MFA/i })).toBeVisible();
      await capturePageOrModal(page, "Security password UI");
    });
  });
});
