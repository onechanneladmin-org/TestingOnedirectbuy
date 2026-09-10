import { test, expect, capturePageOrModal } from "../fixtures/oneProductHubV2Test.js";
import { signInAsBrand } from "../helpers/oneProductHubV2Auth.js";
import { STEP_TIMEOUT } from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — brand workspace shortcuts", () => {
  test("brand dashboard exposes AI credits, notifications, and view-all products", async ({
    page,
    soft,
  }) => {
    await soft("OPH-BRAND-AI-CREDITS-1", "Brand AI credits are visible", async () => {
      await signInAsBrand(page);
      await expect(page.getByRole("button", { name: /AI credits/i })).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
    });

    await soft("OPH-BRAND-NOTIFICATIONS-1", "Open brand activity and notifications", async () => {
      await page.getByRole("button", { name: /Open activity and notifications/i }).click();
      await expect(
        page.getByText(/notification|activity|no (new )?notification/i).first(),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await capturePageOrModal(page, "Brand notifications");
    });

    await soft("OPH-BRAND-VIEW-ALL-1", "View all products from dashboard", async () => {
      const viewAll = page.getByRole("button", { name: /View all products|View all/i }).first();
      await expect(viewAll).toBeVisible({ timeout: STEP_TIMEOUT });
      await viewAll.click();
      await expect(
        page.getByRole("heading", { name: /Product Catalog|AI Product|Studio/i }),
      ).toBeVisible({ timeout: STEP_TIMEOUT });
      await capturePageOrModal(page, "Brand view all products");
    });
  });
});
