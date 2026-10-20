import { test, expect } from "../fixtures/oneProductHubV2Test.js";
import {
  hasAdminCredentials,
  signInAsAdmin,
} from "../helpers/oneProductHubV2Auth.js";
import {
  clickSidebarNav,
  STEP_TIMEOUT,
} from "../helpers/oneProductHubV2Nav.js";

test.describe("One Product Hub V2 — admin settings", () => {
  test.beforeEach(() => {
    if (!hasAdminCredentials()) {
      test.skip(
        true,
        "Set ONEPRODUCTHUB_ADMIN_EMAIL and ONEPRODUCTHUB_ADMIN_PASSWORD"
      );
    }
  });

  test("admin can open settings", async ({ page, soft }) => {
    await soft("OPH-ADMIN-SETTINGS", "Open admin settings", async () => {
      await signInAsAdmin(page);
      await clickSidebarNav(page, "Settings");

      await expect(
        page.getByText(/Settings|Profile|Account|Security/i).first()
      ).toBeVisible({ timeout: STEP_TIMEOUT });
    });
  });
});
