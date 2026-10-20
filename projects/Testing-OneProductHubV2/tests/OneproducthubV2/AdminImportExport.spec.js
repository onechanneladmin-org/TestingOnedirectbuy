import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import {
  hasAdminCredentials,
  signInAsAdmin,
} from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — admin import export", () => {
  test.beforeEach(() => {
    if (!hasAdminCredentials()) {
      test.skip(
        true,
        "Set ONEPRODUCTHUB_ADMIN_EMAIL and ONEPRODUCTHUB_ADMIN_PASSWORD"
      );
    }
  });

  test("admin can open import and export centers", async ({ page, soft }) => {
    await soft("OPH-ADMIN-IMPORT-EXPORT", "Open import and export centers", async () => {
      await signInAsAdmin(page);

      await clickSidebarNav(page, "Import Center");
      await expect(
        page.getByRole("heading", { name: /Import/i }).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });

      await clickSidebarNav(page, "Export Center");
      await expect(
        page.getByRole("heading", { name: /Export/i }).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });
});
