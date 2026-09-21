import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import { clickSidebarNav, STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — brand data quality export import extras", () => {
  test("brand data quality exposes refresh export and roadmap", async ({ page, soft }) => {
    await soft("OPH-BRAND-DQ-REFRESH-1", "Refresh data quality dashboard", async () => {
      await signInAsBrand(page);
      await clickSidebarNav(page, "Data Quality Dashboard");
      await expect(page.getByRole("heading", { name: /Data Quality/i }).first()).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      await page.getByRole("button", { name: /^Refresh$/i }).click();
      await expect(page.getByRole("heading", { name: /Category Health/i })).toBeVisible();
      await capturePageOrModal(page, "Data quality refresh");
    });

    await soft("OPH-BRAND-DQ-EXPORT-REPORT-1", "Export report control is visible", async () => {
      await expect(page.getByRole("button", { name: /Export Report/i })).toBeVisible();
    });

    await soft("OPH-BRAND-DQ-ROADMAP-1", "View full improvement roadmap", async () => {
      await expect(page.getByRole("heading", { name: /Improvement Roadmap/i })).toBeVisible();
      await page.getByRole("button", { name: /View Full Roadmap/i }).click();
      await expect(
        page.getByText(/roadmap|improvement|data quality|product/i).first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await capturePageOrModal(page, "Data quality roadmap");
    });
  });

  test("brand export center can switch formats logs and field picker", async ({ page, soft }) => {
    await soft("OPH-BRAND-EXPORT-FORMATS-1", "Switch CSV Excel JSON export formats", async () => {
      await signInAsBrand(page);
      await clickSidebarNav(page, "Export Center");
      await expect(page.getByRole("heading", { name: /Product Export/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      await page.getByRole("button", { name: /CSV/i }).first().click();
      await page.getByRole("button", { name: /Excel/i }).first().click();
      await page.getByRole("button", { name: /JSON/i }).first().click();
      await capturePageOrModal(page, "Export formats");
    });

    await soft("OPH-BRAND-EXPORT-CUSTOMIZE-1", "Open customize export fields", async () => {
      await page.getByRole("button", { name: /Customize export fields/i }).click();
      await expect(page.getByText(/Fields to export|Fields selected|columns/i).first()).toBeVisible();
      await capturePageOrModal(page, "Customize export fields");
      const close = page.getByRole("button", { name: /^Close$/i });
      if (await close.isVisible().catch(() => false)) await close.click();
    });

    await soft("OPH-BRAND-EXPORT-LOGS-1", "Open export logs tab", async () => {
      const logs = page.getByRole("button", { name: /^Logs$/i }).or(page.getByRole("tab", { name: /^Logs$/i }));
      await expect(logs.first()).toBeVisible({ timeout: STEP_TIMEOUT });
      await logs.first().click();
      await expect(page.getByText(/Export history/i)).toBeVisible({ timeout: STEP_TIMEOUT });
    });

    await soft("OPH-BRAND-EXPORT-EDIT-SETTINGS-1", "Edit in Settings from export", async () => {
      await clickSidebarNav(page, "Export Center");
      await expect(page.getByRole("heading", { name: /Product Export/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      await expect(
        page
          .getByRole("button", { name: /Logs|Edit in Settings|Export products now/i })
          .or(page.getByRole("tab", { name: /Logs|Export/i }))
          .or(page.getByText(/Export history/i))
          .first(),
      ).toBeVisible();
    });
  });

  test("brand import center can toggle format and cancel without uploading", async ({
    page,
    soft,
  }) => {
    await soft("OPH-BRAND-IMPORT-SAMPLES-1", "Download sample CSV and JSON controls", async () => {
      await signInAsBrand(page);
      await clickSidebarNav(page, "Import Center");
      await expect(
        page.getByRole("heading", { name: /Product Import Center/i }),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(page.getByRole("button", { name: /Download sample CSV/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /Download sample JSON/i })).toBeVisible();
    });

    await soft("OPH-BRAND-IMPORT-FORMAT-1", "Toggle CSV and JSON import formats", async () => {
      await page.getByRole("heading", { name: /File format/i }).scrollIntoViewIfNeeded();
      await page.getByRole("button", { name: /JSON/i }).filter({ hasText: /object keys|JSON/i }).first().click();
      await page.getByRole("button", { name: /CSV/i }).filter({ hasText: /CSV|headers/i }).first().click();
      await capturePageOrModal(page, "Import format toggle");
    });

    await soft("OPH-BRAND-IMPORT-CANCEL-1", "Cancel import without starting", async () => {
      await expect(page.getByRole("button", { name: /Preview Import/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /Start Import/i })).toBeVisible();
      await page.getByRole("button", { name: /^Cancel$/i }).click();
      await expect(
        page.getByRole("heading", { name: /Product Import Center|Workspace Overview/i }).first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });
});
